"""Business logic: submissions, assessment and cached similarity analysis."""
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from analysis.graph.network import bfs_traversal, build_similarity_graph, dfs_traversal, find_connected_components
from analysis.pipeline import generate_similarity_matrix
from analysis.prepare import ngram_set, prepare_submission
from analysis.similarity.metrics import (
    calculate_composite_score, calculate_cosine_similarity, calculate_jaccard_similarity,
    calculate_lcs_similarity, calculate_length_similarity, calculate_raw_similarity,
)
from analysis.statistics.outliers import compute_batch_statistics, filter_candidates
from analysis.transforms import TRANSFORMS, apply_transform
from backend import database as db
from backend import demo_data, execution

DEFAULT_WEIGHTS = {"raw": 0.10, "cosine": 0.25, "ngram": 0.55, "length": 0.10, "lcs": 0.0}


# --------------------------------------------------------------------------- data access
def rows(sql, args=()):
    with db.connect() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def one(sql, args=()):
    r = rows(sql, args)
    return r[0] if r else None


def get_tests(assignment_id):
    return rows("SELECT test_id, input_data, expected_output FROM test_cases WHERE assignment_id=? ORDER BY test_id", (assignment_id,))


def get_or_create_user(name, role="student"):
    with db.connect() as c:
        r = c.execute("SELECT user_id FROM users WHERE name=?", (name,)).fetchone()
        if r:
            return r["user_id"]
        return c.execute("INSERT INTO users(name, role) VALUES (?,?)", (name, role)).lastrowid


def create_submission(assignment_id, user_id, code, origin="upload"):
    with db.connect() as c:
        version = c.execute("SELECT COUNT(*) FROM submissions WHERE assignment_id=? AND user_id=?", (assignment_id, user_id)).fetchone()[0] + 1
        return c.execute(
            "INSERT INTO submissions(assignment_id,user_id,source_code,version,origin) VALUES (?,?,?,?,?)",
            (assignment_id, user_id, code, version, origin),
        ).lastrowid


def evaluate_submission(sid, timeout=2.0):
    """Compile the stored program, run every test and record the results."""
    sub = one("SELECT assignment_id, source_code FROM submissions WHERE submission_id=?", (sid,))
    result = execution.evaluate(sub["source_code"], get_tests(sub["assignment_id"]), timeout)
    with db.connect() as c:
        c.execute(
            "UPDATE submissions SET compile_status=?, compile_log=?, score=?, overall_status=? WHERE submission_id=?",
            (result["compile_status"], result["compile_log"], result["score"], result["overall_status"], sid),
        )
        c.executemany(
            "INSERT INTO executions(submission_id,test_id,status,execution_time,actual_output) VALUES (?,?,?,?,?)",
            [(sid, e["test_id"], e["status"], e["execution_time"], e["actual_output"]) for e in result["executions"]],
        )
    return result


def add_submission(assignment_id, user_id, code, origin="upload", timeout=2.0):
    sid = create_submission(assignment_id, user_id, code, origin)
    evaluate_submission(sid, timeout)
    return sid


def submission_detail(sid, with_source=True):
    s = one(
        "SELECT s.submission_id, s.assignment_id, s.user_id, u.name AS student, s.source_code, s.submission_time, s.version, "
        "s.compile_status, s.compile_log, s.score, s.overall_status, s.origin, a.title AS assignment "
        "FROM submissions s JOIN users u ON u.user_id=s.user_id JOIN assignments a ON a.assignment_id=s.assignment_id WHERE s.submission_id=?",
        (sid,),
    )
    if not s:
        return None
    s["executions"] = rows(
        "SELECT e.test_id, e.status, e.execution_time, e.actual_output, t.input_data, t.expected_output "
        "FROM executions e JOIN test_cases t ON t.test_id=e.test_id WHERE e.submission_id=? ORDER BY e.test_id", (sid,))
    if not with_source:
        s.pop("source_code", None)
    return s


def list_submissions(assignment_id=None, user_id=None):
    sql = ("SELECT s.submission_id, s.assignment_id, s.user_id, u.name AS student, s.version, s.compile_status, s.score, "
           "s.overall_status, s.submission_time, s.origin FROM submissions s JOIN users u ON u.user_id=s.user_id WHERE 1=1")
    args = []
    if assignment_id:
        sql += " AND s.assignment_id=?"
        args.append(assignment_id)
    if user_id:
        sql += " AND s.user_id=?"
        args.append(user_id)
    out = rows(sql + " ORDER BY s.submission_id", args)
    for s in out:
        s["executions"] = rows("SELECT test_id, status FROM executions WHERE submission_id=? ORDER BY test_id", (s["submission_id"],))
    return out


def seed(reset=True):
    if reset:
        db.reset_db()
    else:
        db.init_db()
    get_or_create_user(demo_data.INSTRUCTOR, "instructor")
    sids = []
    for a in demo_data.ASSIGNMENTS:
        with db.connect() as c:
            aid = c.execute("INSERT INTO assignments(title, description, external_ref) VALUES (?,?,?)", (a["title"], a["description"], "demo")).lastrowid
            c.executemany("INSERT INTO test_cases(assignment_id,input_data,expected_output) VALUES (?,?,?)", [(aid, i, o) for i, o in a["tests"]])
        for name, code in a["submissions"]:
            sids.append(create_submission(aid, get_or_create_user(name), code, origin="seed"))
    get_or_create_user("Demo Student")
    # Run the real compile/test pipeline for every seeded program (in parallel; runs are independent).
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(evaluate_submission, sids))
    ANALYSIS.clear()


# --------------------------------------------------------------------------- analysis
class AnalysisService:
    """Computes and caches pairwise component scores so that sliders are instant."""

    def __init__(self):
        self.lock = threading.RLock()
        self.prepared = {}
        self.base = {}
        self.ng = {}

    def clear(self):
        with self.lock:
            self.prepared.clear(); self.base.clear(); self.ng.clear()

    def prep(self, code):
        P = prepare_submission(0, code)
        with self.lock:
            return self.prepared.setdefault(P["hash"], P)

    def components(self, A, B, n):
        key = tuple(sorted((A["hash"], B["hash"])))
        with self.lock:
            base = self.base.get(key)
        if base is None:
            base = {
                "raw": calculate_raw_similarity(A["text"], B["text"]),
                "normalized": calculate_raw_similarity(A["norm_text"], B["norm_text"]),
                "cosine": calculate_cosine_similarity(A["freq"], B["freq"]),
                "lcs": calculate_lcs_similarity(A["tokens"], B["tokens"]),
            }
            with self.lock:
                self.base[key] = base
        nkey = key + (n,)
        with self.lock:
            ng = self.ng.get(nkey)
        if ng is None:
            ng = calculate_jaccard_similarity(ngram_set(A["tokens"], n), ngram_set(B["tokens"], n))
            with self.lock:
                self.ng[nkey] = ng
        return dict(base, ngram=ng, length=calculate_length_similarity(A["length"], B["length"]))

    @staticmethod
    def weights(w):
        w = dict(DEFAULT_WEIGHTS, **(w or {}))
        w = {k: max(0.0, float(v)) for k, v in w.items()}
        total = sum(w.values()) or 1.0
        return {k: v / total for k, v in w.items()}

    def score_pair(self, A, B, n, w, candidate_ratio):
        comps = self.components(A, B, n)
        is_candidate = filter_candidates(A["length"], B["length"], candidate_ratio)
        scores = comps if is_candidate else {k: 0.0 for k in comps} | {"length": comps["length"]}
        return comps, scores, is_candidate, calculate_composite_score(scores, w)

    def analyze(self, subs, threshold=0.75, candidate_ratio=0.5, n=3, weights=None):
        """subs: list of dict(id, label, code, status, score)."""
        t0 = time.perf_counter()
        w = self.weights(weights)
        prepared = []
        for s in subs:
            P = self.prep(s["code"])
            prepared.append(dict(P, id=s["id"]))
        results = []
        for i in range(len(prepared)):
            for j in range(i + 1, len(prepared)):
                A, B = prepared[i], prepared[j]
                comps, scores, cand, comp_score = self.score_pair(A, B, n, w, candidate_ratio)
                results.append({"id_a": A["id"], "id_b": B["id"], "is_filtered": not cand, "scores": scores, "composite_score": comp_score, "_raw": comps})
        results, stats = compute_batch_statistics(results)
        ids = [s["id"] for s in subs]
        matrix = generate_similarity_matrix(ids, results)
        graph = build_similarity_graph(ids, matrix, threshold)
        components = find_connected_components(graph)
        edges = [(a, b) for a in graph for b in graph[a] if a < b]
        nodes = len(ids)
        total_pairs = len(results)
        candidates = total_pairs - stats["filtered_pairs"]
        pairs = []
        for r in sorted(results, key=lambda r: -r["composite_score"]):
            pairs.append({
                "a": r["id_a"], "b": r["id_b"], "composite": r["composite_score"], "z": r["z_score"],
                "unusual": r["unusually_similar"], "filtered": r["is_filtered"],
                "above": r["composite_score"] >= threshold,
                "scores": {k: r["scores"].get(k, 0.0) for k in ("raw", "cosine", "ngram", "length", "lcs")},
            })
        return {
            "params": {"threshold": threshold, "candidate_ratio": candidate_ratio, "n": n, "weights": w},
            "submissions": [{"id": s["id"], "label": s["label"], "status": s.get("status"), "score": s.get("score")} for s in subs],
            "matrix": matrix,
            "pairs": pairs,
            "edges": [{"a": a, "b": b, "w": matrix[ids.index(a)][ids.index(b)]} for a, b in edges],
            "components": [{"nodes": c, "bfs": bfs_traversal(graph, c[0]), "dfs": dfs_traversal(graph, c[0])} for c in components],
            "graph_stats": {
                "vertices": nodes, "edges": len(edges), "components": len(components),
                "largest_component": max((len(c) for c in components), default=0),
                "isolated": sum(1 for c in components if len(c) == 1),
                "avg_degree": (2 * len(edges) / nodes) if nodes else 0.0,
            },
            "stats": {
                "total_pairs": total_pairs, "candidate_pairs": candidates, "filtered_pairs": stats["filtered_pairs"],
                "reduction": (1 - candidates / total_pairs) if total_pairs else 0.0,
                "mean": stats["mean"], "std_dev": stats["std_dev"], "unusual": sum(1 for p in pairs if p["unusual"]),
            },
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
        }

    def pair(self, code_a, code_b, threshold=0.75, n=3, weights=None, z=None):
        A, B = self.prep(code_a), self.prep(code_b)
        w = self.weights(weights)
        comps = self.components(A, B, n)
        composite = calculate_composite_score(comps, w)
        return {
            "scores": dict(comps, composite=composite),
            "reasons": explain(A, B, comps),
            "classification": classify(composite, threshold, z),
            "z": z,
            "weights": w,
        }


ANALYSIS = AnalysisService()


def classify(composite, threshold, z=None):
    labels = []
    if composite >= threshold:
        labels.append("Structural Similarity")
    if z is not None and z > 2.0:
        labels.append("Unusually High Similarity")
    if composite >= threshold or (z is not None and z > 2.0):
        labels.append("Requires Review")
    return labels or ["Below threshold"]


def explain(A, B, c):
    """Plain-language reasons behind a similarity score (never a plagiarism verdict)."""
    r = []
    if A["text"] == B["text"]:
        r.append("Source text is identical.")
        return r
    if c["normalized"] - c["raw"] >= 0.15:
        r.append("Formatting and/or comments differ substantially (normalized text is %.0f points closer than raw text)." % ((c["normalized"] - c["raw"]) * 100))
    if A["norm_text"] == B["norm_text"]:
        r.append("After removing comments and whitespace the programs are identical.")
    ida, idb = A["identifiers"], B["identifiers"]
    if ida and idb:
        overlap = len(ida & idb) / len(ida | idb)
        if overlap <= 0.4 and c["ngram"] >= 0.6:
            r.append("Identifiers mostly renamed, yet the token structure matches.")
    if c["ngram"] >= 0.75:
        r.append("Token ordering strongly similar (n-gram overlap %.2f)." % c["ngram"])
    elif c["ngram"] <= 0.3:
        r.append("Token ordering differs (n-gram overlap %.2f)." % c["ngram"])
    if c["cosine"] >= 0.9 and c["ngram"] < 0.5:
        r.append("Similar token counts but different order: the programs may use the same constructs in a different way.")
    if c["length"] >= 0.9:
        r.append("Program lengths almost identical.")
    elif c["length"] < 0.6:
        r.append("Program lengths differ considerably.")
    if not r:
        r.append("No strong structural signal.")
    r.append("High similarity is a reason to review the code, not proof of copying.")
    return r


# --------------------------------------------------------------------------- demo lab
def run_transformation_experiment(base_code, assignment_id, run_tests=True):
    tests = get_tests(assignment_id) if run_tests else []
    base = ANALYSIS.prep(base_code)
    out = []
    for key, kind, label in TRANSFORMS:
        new = apply_transform(base_code, kind, seed=1)
        if new is None:
            out.append({"key": key, "kind": kind, "label": label, "applicable": False})
            continue
        comps = ANALYSIS.components(base, ANALYSIS.prep(new), 3)
        ev = execution.evaluate(new, tests) if tests else None
        out.append({
            "key": key, "kind": kind, "label": label, "applicable": True, "code": new,
            "scores": dict(comps, composite=calculate_composite_score(comps, DEFAULT_WEIGHTS)),
            "tests": {"passed": ev["passed"], "total": ev["total"], "status": ev["overall_status"]} if ev else None,
        })
    return out


def scalability(sizes):
    """Time the token-level pipeline for growing N using transformed copies of the seed programs."""
    bases = [s[1] for s in demo_data.ASSIGNMENTS[0]["submissions"]] + [s[1] for s in demo_data.ASSIGNMENTS[1]["submissions"]]
    kinds = [t[1] for t in TRANSFORMS]
    out = []
    for N in sizes:
        codes = []
        for i in range(N):
            code = bases[i % len(bases)]
            kind = kinds[(i // len(bases)) % len(kinds)]
            codes.append(apply_transform(code, kind, seed=i) or code)
        t0 = time.perf_counter()
        prepared = [dict(prepare_submission(i, c)) for i, c in enumerate(codes)]
        t1 = time.perf_counter()
        n_pairs, matrix = 0, [[1.0] * N for _ in range(N)]
        for i in range(N):
            for j in range(i + 1, N):
                A, B = prepared[i], prepared[j]
                s = (0.25 * calculate_cosine_similarity(A["freq"], B["freq"]) + 0.55 * calculate_jaccard_similarity(A["ngrams"], B["ngrams"]) + 0.10 * calculate_length_similarity(A["length"], B["length"])) / 0.90
                matrix[i][j] = matrix[j][i] = s
                n_pairs += 1
        t2 = time.perf_counter()
        g = build_similarity_graph(list(range(N)), matrix, 0.75)
        comps = find_connected_components(g)
        t3 = time.perf_counter()
        out.append({
            "n": N, "pairs": n_pairs, "theory_pairs": N * (N - 1) // 2,
            "tokenize_ms": round((t1 - t0) * 1000, 2), "similarity_ms": round((t2 - t1) * 1000, 2),
            "graph_ms": round((t3 - t2) * 1000, 2), "total_ms": round((t3 - t0) * 1000, 2), "components": len(comps),
        })
    return out
