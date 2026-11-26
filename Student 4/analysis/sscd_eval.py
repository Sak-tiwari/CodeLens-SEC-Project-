"""Experiment 5: validate the similarity measures against the SSCD C clone pairs.

Positives  : the 80 known clone pairs in datasets/sscd/dataset_c.csv (code fragments cut
             out with the listed line ranges).
Negatives  : sampled comparison / non-clone candidates, NOT verified ground truth. Two
             fragments are drawn at random (fixed seed) from two *different* clone groups.
             A human should inspect a subset before the numbers are quoted.
"""
import csv
import os
import random
import time
from statistics import mean, median

from analysis.prepare import ngram_set, prepare_submission
from analysis.similarity import fast_edit
from analysis.similarity.metrics import (
    calculate_composite_score,
    calculate_cosine_similarity,
    calculate_jaccard_similarity,
    calculate_length_similarity,
)
from analysis.statistics.outliers import filter_candidates

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DIR = os.path.join(ROOT, "datasets", "sscd")
MEASURES = ["raw", "normalized", "cosine", "ngram", "length", "lcs", "composite"]
THRESHOLDS = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
FILTER_RATIOS = [0.4, 0.5, 0.6, 0.7, 0.8]
DEFAULT_WEIGHTS = {"raw": 0.10, "cosine": 0.25, "ngram": 0.55, "length": 0.10, "lcs": 0.0}


# ----------------------------------------------------------------- loading
def load_pairs(dataset_dir=DEFAULT_DIR):
    """Read dataset_c.csv -> list of clone-pair records (fragment text included)."""
    out = []
    with open(os.path.join(dataset_dir, "dataset_c.csv"), newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            frags = []
            for path_col, start_col, end_col in (("private_path", "private_start_line", "private_end_line"),
                                                 ("os_path", "os_path_start_line", "os_path_end_line")):
                rel, start, end = row[path_col], int(row[start_col]), int(row[end_col])
                frags.append({"file": rel, "start": start, "end": end, "code": _cut(os.path.join(dataset_dir, rel), start, end)})
            out.append({"group": int(row["private_path"].split("/")[1]), "granularity": row["granularity"], "a": frags[0], "b": frags[1]})
    return out


def _cut(path, start, end):
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.read().splitlines()
    return "\n".join(lines[start - 1:end])


def sample_negatives(pairs, per_positive=2, seed=42):
    """Random fragment pairs drawn from two different clone groups (reproducible)."""
    rng = random.Random(seed)
    frags = [(i, side) for i in range(len(pairs)) for side in ("a", "b")]
    negatives, seen = [], set()
    target = per_positive * len(pairs)
    while len(negatives) < target:
        (i, si), (j, sj) = rng.sample(frags, 2)
        if i == j or (i, si, j, sj) in seen or (j, sj, i, si) in seen:
            continue
        seen.add((i, si, j, sj))
        negatives.append({"group": None, "granularity": "sampled", "a": dict(pairs[i][si], origin=pairs[i]["group"]),
                          "b": dict(pairs[j][sj], origin=pairs[j]["group"])})
    return negatives


# ----------------------------------------------------------------- scoring
def score_pair(A, B, n=3, weights=None):
    """All similarity measures for two prepared fragments (see analysis.prepare)."""
    s = {
        "raw": fast_edit.raw_similarity(A["text"], B["text"]),
        "normalized": fast_edit.raw_similarity(A["norm_text"], B["norm_text"]),
        "cosine": calculate_cosine_similarity(A["freq"], B["freq"]),
        "ngram": calculate_jaccard_similarity(ngram_set(A["tokens"], n), ngram_set(B["tokens"], n)),
        "length": calculate_length_similarity(A["length"], B["length"]),
        "lcs": fast_edit.lcs_similarity(A["tokens"], B["tokens"]),
    }
    s["composite"] = calculate_composite_score(s, weights or DEFAULT_WEIGHTS)
    return s


def auc(pos, neg):
    """P(score of a random clone pair > score of a random non-clone pair); ties count 1/2."""
    if not pos or not neg:
        return 0.0
    wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return wins / (len(pos) * len(neg))


def curve(pos, neg, thresholds=THRESHOLDS):
    rows = []
    for t in thresholds:
        tp = sum(1 for x in pos if x >= t)
        fp = sum(1 for x in neg if x >= t)
        recall = tp / len(pos) if pos else 0.0
        precision = tp / (tp + fp) if tp + fp else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        rows.append({"t": t, "tp": tp, "fp": fp, "recall": recall, "fpr": fp / len(neg) if neg else 0.0,
                     "precision": precision, "f1": f1})
    return rows


# ----------------------------------------------------------------- experiments
def evaluate(dataset_dir=DEFAULT_DIR, n=3, seed=42, weights=None):
    t0 = time.perf_counter()
    pairs = load_pairs(dataset_dir)
    negatives = sample_negatives(pairs, 2, seed)
    prep_cache = {}

    def prep(frag):
        key = (frag["file"], frag["start"], frag["end"])
        if key not in prep_cache:
            prep_cache[key] = prepare_submission(0, frag["code"], n)
        return prep_cache[key]

    records = []
    for kind, group in (("clone", pairs), ("non-clone", negatives)):
        for idx, p in enumerate(group):
            A, B = prep(p["a"]), prep(p["b"])
            rec = {"kind": kind, "index": idx, "group": p["group"], "granularity": p["granularity"],
                   "a": {k: p["a"][k] for k in ("file", "start", "end")} | {"tokens": A["length"]},
                   "b": {k: p["b"][k] for k in ("file", "start", "end")} | {"tokens": B["length"]},
                   "scores": score_pair(A, B, n, weights)}
            records.append(rec)
    pos = [r for r in records if r["kind"] == "clone"]
    neg = [r for r in records if r["kind"] == "non-clone"]

    summary, curves = {}, {}
    for m in MEASURES:
        ps, ns = [r["scores"][m] for r in pos], [r["scores"][m] for r in neg]
        cv = curve(ps, ns)
        best = max(cv, key=lambda r: r["f1"])
        summary[m] = {"auc": auc(ps, ns), "mean_pos": mean(ps), "mean_neg": mean(ns), "median_pos": median(ps),
                      "median_neg": median(ns), "best_t": best["t"], "best_f1": best["f1"]}
        curves[m] = cv

    # Experiment 4 on real clones: which n-gram size separates clones from non-clones best?
    ngram_sizes = []
    for k in (2, 3, 4, 5):
        ps = [calculate_jaccard_similarity(ngram_set(prep(p["a"])["tokens"], k), ngram_set(prep(p["b"])["tokens"], k)) for p in pairs]
        ns = [calculate_jaccard_similarity(ngram_set(prep(p["a"])["tokens"], k), ngram_set(prep(p["b"])["tokens"], k)) for p in negatives]
        ngram_sizes.append({"n": k, "auc": auc(ps, ns), "mean_pos": mean(ps), "mean_neg": mean(ns), "curve": curve(ps, ns)})

    by_gran = {}
    for r in pos:
        by_gran.setdefault(r["granularity"], []).append(r["scores"]["composite"])

    # Experiment 9 on real fragments: how much work does the length filter save, and
    # how many known clone pairs does it keep?
    filt = filter_study(pairs, prep)

    return {
        "meta": {"positives": len(pos), "negatives": len(neg), "seed": seed, "n": n,
                 "weights": weights or DEFAULT_WEIGHTS, "fragments": len(pairs) * 2,
                 "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
                 "negatives_note": "Sampled comparison / non-clone candidates (two fragments from different clone groups). "
                                   "Not verified ground truth; inspect a subset by hand."},
        "thresholds": THRESHOLDS, "measures": MEASURES, "summary": summary, "curves": curves,
        "ngram_sizes": ngram_sizes,
        "granularity": {g: {"count": len(v), "mean_composite": mean(v)} for g, v in by_gran.items()},
        "filter": filt, "pairs": records,
    }


def filter_study(pairs, prep, ratios=FILTER_RATIOS):
    """Candidate filtering on the 160 SSCD fragments: pairs removed vs. clone pairs kept."""
    lengths = [prep(p[s])["length"] for p in pairs for s in ("a", "b")]
    total = len(lengths) * (len(lengths) - 1) // 2
    clone_ratio = []
    for p in pairs:
        la, lb = prep(p["a"])["length"], prep(p["b"])["length"]
        clone_ratio.append(min(la, lb) / max(la, lb, 1))
    rows = []
    for tl in ratios:
        kept = sum(1 for i in range(len(lengths)) for j in range(i + 1, len(lengths)) if filter_candidates(lengths[i], lengths[j], tl))
        retained = sum(1 for r in clone_ratio if r >= tl)
        rows.append({"t_l": tl, "all_pairs": total, "candidates": kept, "reduction": 1 - kept / total,
                     "clones_retained": retained, "clones_total": len(pairs), "retained_pct": retained / len(pairs)})
    return rows


def pair_detail(dataset_dir, kind, index, n=3, seed=42):
    """Source of one evaluated pair (for the pair viewer)."""
    pairs = load_pairs(dataset_dir)
    items = pairs if kind == "clone" else sample_negatives(pairs, 2, seed)
    return items[index]
