"""Experiments 5 and 9 on the SSCD C clone pairs. Writes experiments/results/sscd_*.{json,csv}.

    python experiments/run_sscd_evaluation.py
"""
import csv
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from analysis import sscd_eval  # noqa: E402

OUT = os.path.join(ROOT, "experiments", "results")


def main():
    os.makedirs(OUT, exist_ok=True)
    res = sscd_eval.evaluate()
    with open(os.path.join(OUT, "sscd_evaluation.json"), "w") as f:
        json.dump(res, f, indent=1)
    with open(os.path.join(OUT, "sscd_threshold_table.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["measure", "threshold", "clones_detected", "clone_recall", "non_clones_flagged", "false_positive_rate", "precision", "f1"])
        for m, rows in res["curves"].items():
            for r in rows:
                w.writerow([m, r["t"], r["tp"], round(r["recall"], 4), r["fp"], round(r["fpr"], 4), round(r["precision"], 4), round(r["f1"], 4)])
    with open(os.path.join(OUT, "sscd_pair_scores.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "index", "granularity", "file_a", "lines_a", "file_b", "lines_b"] + sscd_eval.MEASURES)
        for r in res["pairs"]:
            w.writerow([r["kind"], r["index"], r["granularity"], r["a"]["file"], f'{r["a"]["start"]}-{r["a"]["end"]}',
                        r["b"]["file"], f'{r["b"]["start"]}-{r["b"]["end"]}'] + [round(r["scores"][m], 4) for m in sscd_eval.MEASURES])
    print(f'{res["meta"]["positives"]} clone pairs, {res["meta"]["negatives"]} sampled non-clone pairs, {res["meta"]["elapsed_ms"]} ms')
    print(f'{"measure":<11}{"AUC":>7}{"mean clone":>12}{"mean non-clone":>16}')
    for m, s in res["summary"].items():
        print(f'{m:<11}{s["auc"]:>7.3f}{s["mean_pos"]:>12.2f}{s["mean_neg"]:>16.2f}')


if __name__ == "__main__":
    main()
