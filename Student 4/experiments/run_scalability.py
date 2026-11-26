"""Experiment 8: pairwise runtime against N. Writes experiments/results/scalability.json.

    python experiments/run_scalability.py [N1,N2,...]
Inputs are edited copies of the demo programs (synthetic, timing only).
"""
import json
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from backend import services as svc  # noqa: E402


def exponent(rows, key):
    """Slope of ln(time) against ln(N): ~2 means quadratic growth, as N(N-1)/2 predicts."""
    pts = [(math.log(r["n"]), math.log(max(r[key], 1e-6))) for r in rows if r["n"] > 1]
    mx, my = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    return sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)


def main():
    sizes = [int(x) for x in (sys.argv[1] if len(sys.argv) > 1 else "50,100,200,400,600").split(",")]
    rows = svc.scalability(sizes)
    out = {"rows": rows, "similarity_exponent": exponent(rows, "similarity_ms"), "total_exponent": exponent(rows, "total_ms")}
    os.makedirs(os.path.join(ROOT, "experiments", "results"), exist_ok=True)
    with open(os.path.join(ROOT, "experiments", "results", "scalability.json"), "w") as f:
        json.dump(out, f, indent=1)
    for r in rows:
        print(r)
    print("similarity-time exponent %.2f, total-time exponent %.2f (theory for pair count: 2.00)" % (out["similarity_exponent"], out["total_exponent"]))


if __name__ == "__main__":
    main()
