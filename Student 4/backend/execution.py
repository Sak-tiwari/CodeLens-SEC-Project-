"""Compile and run untrusted C submissions with GCC.

Safety measures (this is NOT a production sandbox - see README section 14):
  * every run happens in its own temporary directory that is deleted afterwards
  * strict wall-clock timeout, runaway process groups are killed
  * on POSIX: CPU time, memory, output-file size and process count limits
  * output is written to a size-limited file, never held in memory unbounded
  * stdin size is capped
"""
import os
import shutil
import signal
import subprocess
import tempfile
import time

IS_POSIX = os.name == "posix"
GCC = shutil.which("gcc") or shutil.which("cc")
MAX_INPUT = 100_000
MAX_OUTPUT = 64 * 1024
COMPILE_TIMEOUT = 20

PASS, WRONG, COMPILE_ERR, RUNTIME_ERR, TIMEOUT = "PASS", "WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR", "TIMEOUT"


def gcc_version():
    if not GCC:
        return None
    try:
        out = subprocess.run([GCC, "--version"], capture_output=True, text=True, timeout=5).stdout
        return out.splitlines()[0] if out else "gcc"
    except Exception:
        return "gcc"


def _limits(timeout):
    if not IS_POSIX:
        return None
    import resource

    def apply():
        resource.setrlimit(resource.RLIMIT_CPU, (int(timeout) + 1, int(timeout) + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_OUTPUT * 4, MAX_OUTPUT * 4))
        try:
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
        except (ValueError, OSError):
            pass
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
        except (ValueError, OSError):
            pass
    return apply


def normalize_output(text):
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def compile_c(code, workdir):
    if not GCC:
        return False, None, "GCC was not found on this machine. Install GCC (MinGW-w64 on Windows) to enable compilation."
    src = os.path.join(workdir, "main.c")
    exe = os.path.join(workdir, "prog.exe" if os.name == "nt" else "prog")
    with open(src, "w", encoding="utf-8", newline="\n") as f:
        f.write(code)
    try:
        p = subprocess.run([GCC, "-std=gnu11", "-O0", "-w", "-o", exe, src, "-lm"], capture_output=True, text=True, timeout=COMPILE_TIMEOUT, cwd=workdir)
    except subprocess.TimeoutExpired:
        return False, None, "Compilation timed out."
    log = (p.stderr or "").replace(workdir + os.sep, "").replace(workdir, "")[:4000]
    return p.returncode == 0, exe, log


def run_one(exe, workdir, stdin_text, timeout):
    out_path = os.path.join(workdir, "stdout.txt")
    start = time.perf_counter()
    status, note = None, ""
    with open(out_path, "wb") as out_f:
        kwargs = {}
        if IS_POSIX:
            kwargs["preexec_fn"] = _limits(timeout)
            kwargs["start_new_session"] = True
        elif hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        proc = subprocess.Popen([exe], stdin=subprocess.PIPE, stdout=out_f, stderr=subprocess.PIPE, cwd=workdir, **kwargs)
        try:
            _, err = proc.communicate(stdin_text[:MAX_INPUT].encode("utf-8", "replace"), timeout=timeout)
            rc = proc.returncode
            if rc != 0:
                status = RUNTIME_ERR
                if rc < 0:
                    try:
                        note = "Terminated by signal %s" % signal.Signals(-rc).name
                    except Exception:
                        note = "Terminated by signal %d" % -rc
                else:
                    note = "Exited with code %d" % rc
        except subprocess.TimeoutExpired:
            status, note = TIMEOUT, "Exceeded %.1f s time limit" % timeout
            try:
                if IS_POSIX:
                    os.killpg(proc.pid, signal.SIGKILL)
                else:
                    proc.kill()
            except Exception:
                proc.kill()
            proc.communicate()
    elapsed = time.perf_counter() - start
    with open(out_path, "rb") as f:
        actual = f.read(MAX_OUTPUT).decode("utf-8", "replace")
    return status, actual, elapsed, note


def evaluate(code, tests, timeout=2.0):
    """Compile `code` and run every test.

    tests: list of dicts with test_id, input_data, expected_output.
    Returns dict(compile_status, compile_log, executions=[...], passed, total, score, overall_status).
    """
    workdir = tempfile.mkdtemp(prefix="codelens_")
    try:
        ok, exe, log = compile_c(code, workdir)
        if not ok:
            execs = [{"test_id": t["test_id"], "status": COMPILE_ERR, "execution_time": 0.0, "actual_output": "", "note": ""} for t in tests]
            return {"compile_status": COMPILE_ERR, "compile_log": log, "executions": execs, "passed": 0, "total": len(tests), "score": 0.0, "overall_status": COMPILE_ERR}
        execs, passed = [], 0
        for t in tests:
            status, actual, elapsed, note = run_one(exe, workdir, t["input_data"], timeout)
            if status is None:
                status = PASS if normalize_output(actual) == normalize_output(t["expected_output"]) else WRONG
            passed += status == PASS
            execs.append({"test_id": t["test_id"], "status": status, "execution_time": round(elapsed, 4), "actual_output": actual[:2000], "note": note})
        total = len(tests)
        score = round(100.0 * passed / total, 2) if total else 0.0
        if passed == total:
            overall = PASS
        else:
            bad = [e["status"] for e in execs if e["status"] != PASS]
            overall = next((s for s in (TIMEOUT, RUNTIME_ERR, WRONG) if s in bad), WRONG)
        return {"compile_status": "OK", "compile_log": log, "executions": execs, "passed": passed, "total": total, "score": score, "overall_status": overall}
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
