"""Thin Flask API that serves the dashboard and exposes the analysis engine.

Run from the repository root:   python -m backend.app
"""
import os

from flask import Flask, abort, jsonify, request, send_from_directory

from analysis.preprocessing.normalizer import representations
from backend import database as db
from backend import demo_data, execution
from backend import services as svc

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app = Flask(__name__, static_folder=os.path.join(ROOT, "frontend"), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024


def role():
    return request.headers.get("X-Role", "instructor")


def require_instructor():
    if role() != "instructor":
        abort(403, "Instructor access only")


@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(400)
def err(e):
    return jsonify(error=getattr(e, "description", str(e))), e.code


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/health")
def health():
    return jsonify(
        gcc=execution.gcc_version(),
        assignments=svc.one("SELECT COUNT(*) n FROM assignments")["n"],
        submissions=svc.one("SELECT COUNT(*) n FROM submissions")["n"],
        samples=list(demo_data.SAMPLES.keys()),
    )


@app.get("/api/users")
def users():
    return jsonify(svc.rows("SELECT user_id, name, role FROM users ORDER BY role DESC, name"))


@app.get("/api/assignments")
def assignments():
    out = svc.rows("SELECT assignment_id, title, description FROM assignments ORDER BY assignment_id")
    for a in out:
        a["tests"] = svc.one("SELECT COUNT(*) n FROM test_cases WHERE assignment_id=?", (a["assignment_id"],))["n"]
        a["submissions"] = svc.one("SELECT COUNT(*) n FROM submissions WHERE assignment_id=?", (a["assignment_id"],))["n"]
    return jsonify(out)


@app.get("/api/samples")
def samples():
    return jsonify(demo_data.SAMPLES)


@app.get("/api/assignments/<int:aid>/submissions")
def assignment_submissions(aid):
    subs = svc.list_submissions(assignment_id=aid)
    if role() != "instructor":
        uid = request.headers.get("X-User-Id", type=int)
        subs = [s for s in subs if s["user_id"] == uid]
    return jsonify(subs)


@app.post("/api/assignments/<int:aid>/submissions")
def submit(aid):
    if not svc.one("SELECT 1 x FROM assignments WHERE assignment_id=?", (aid,)):
        abort(404, "Unknown assignment")
    data = request.get_json(silent=True) or {}
    code = data.get("source_code") or ""
    if not code.strip():
        abort(400, "Source code is empty")
    if len(code) > 50_000:
        abort(400, "Source code too large (50 KB limit)")
    uid = data.get("user_id")
    if not uid:
        abort(400, "user_id required")
    sid = svc.add_submission(aid, int(uid), code, origin=data.get("origin", "upload"))
    return jsonify(svc.submission_detail(sid)), 201


@app.get("/api/submissions/<int:sid>")
def submission(sid):
    s = svc.submission_detail(sid)
    if not s:
        abort(404, "Unknown submission")
    if role() != "instructor" and s["user_id"] != request.headers.get("X-User-Id", type=int):
        abort(403, "You can only view your own submissions")
    return jsonify(s)


def _params():
    a = request.args
    weights = {k: a.get("w_" + k, type=float) for k in ("raw", "cosine", "ngram", "length", "lcs") if a.get("w_" + k) is not None}
    return dict(
        threshold=a.get("threshold", 0.75, type=float),
        candidate_ratio=a.get("candidate", 0.5, type=float),
        n=min(max(a.get("n", 3, type=int), 2), 5),
        weights=weights or None,
    )


@app.get("/api/assignments/<int:aid>/analysis")
def analysis(aid):
    require_instructor()
    subs = svc.rows(
        "SELECT s.submission_id AS id, u.name || ' v' || s.version AS label, s.source_code AS code, s.overall_status AS status, s.score "
        "FROM submissions s JOIN users u ON u.user_id=s.user_id WHERE s.assignment_id=? ORDER BY s.submission_id", (aid,))
    return jsonify(svc.ANALYSIS.analyze(subs, **_params()))


@app.get("/api/pairs/<int:a>/<int:b>")
def pair(a, b):
    require_instructor()
    sa, sb = svc.submission_detail(a), svc.submission_detail(b)
    if not sa or not sb:
        abort(404, "Unknown submission")
    p = _params()
    res = svc.ANALYSIS.pair(sa["source_code"], sb["source_code"], p["threshold"], p["n"], p["weights"], z=request.args.get("z", type=float))
    res["a"], res["b"] = sa, sb
    return jsonify(res)


@app.post("/api/demo/compare")
def demo_compare():
    require_instructor()
    d = request.get_json(silent=True) or {}
    a, b = d.get("a", ""), d.get("b", "")
    if not a.strip() or not b.strip():
        abort(400, "Both programs are required")
    return jsonify(svc.ANALYSIS.pair(a[:50_000], b[:50_000], float(d.get("threshold", 0.75)), int(d.get("n", 3)), d.get("weights")))


@app.get("/api/demo/pipeline/<int:sid>")
def demo_pipeline(sid):
    require_instructor()
    s = svc.submission_detail(sid)
    if not s:
        abort(404, "Unknown submission")
    r = representations(s["source_code"])
    r["student"] = s["student"]
    return jsonify(r)


@app.post("/api/demo/pipeline")
def demo_pipeline_code():
    require_instructor()
    return jsonify(representations((request.get_json(silent=True) or {}).get("code", "")[:50_000]))


@app.get("/api/demo/transformations/<int:sid>")
def demo_transformations(sid):
    require_instructor()
    s = svc.submission_detail(sid)
    if not s:
        abort(404, "Unknown submission")
    return jsonify(svc.run_transformation_experiment(s["source_code"], s["assignment_id"], run_tests=request.args.get("tests", "1") == "1"))


@app.post("/api/demo/plant")
def demo_plant():
    """Submit a disguised copy of an existing submission as 'Demo Student' and run the full pipeline."""
    require_instructor()
    from analysis.transforms import apply_transform
    d = request.get_json(silent=True) or {}
    s = svc.submission_detail(int(d.get("submission_id", 0)))
    if not s:
        abort(404, "Unknown submission")
    code = apply_transform(s["source_code"], d.get("kind", "rename"), seed=int(d.get("seed", 2)))
    if code is None:
        abort(400, "That transformation does not apply to this program")
    uid = svc.get_or_create_user(d.get("student") or "Demo Student")
    sid = svc.add_submission(s["assignment_id"], uid, code, origin="demo-copy")
    return jsonify(svc.submission_detail(sid)), 201


@app.get("/api/demo/scalability")
def demo_scalability():
    require_instructor()
    sizes = [int(x) for x in request.args.get("sizes", "10,20,40,80,160").split(",") if x.strip().isdigit()][:8]
    return jsonify(svc.scalability([min(n, 300) for n in sizes]))


@app.post("/api/demo/reset")
def demo_reset():
    require_instructor()
    svc.seed(reset=True)
    return jsonify(ok=True)


def create_app(seed_if_empty=True):
    db.init_db()
    if seed_if_empty and not svc.one("SELECT 1 x FROM assignments"):
        svc.seed(reset=False)
    return app


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    create_app()
    print("CodeLens dashboard: http://127.0.0.1:%d" % port)
    app.run(host="127.0.0.1", port=port, threaded=True)
