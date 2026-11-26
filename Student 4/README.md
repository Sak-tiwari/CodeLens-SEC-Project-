# Student 4: dashboard, statistics, SSCD evaluation, scalability

Self-contained, runnable copy of CodeLens with Student 4's responsibilities completed:
instructor dashboard, similarity matrix, pair viewer, statistical analysis, SSCD evaluation
and scalability experiments. Nothing outside this folder is changed.

```bash
cd "Student 4"
pip install -r requirements.txt
python -m backend.app            # http://127.0.0.1:5000  (needs GCC on PATH)
python -m pytest tests           # 44 tests
python experiments/run_sscd_evaluation.py
python experiments/run_scalability.py 50,100,200,400,600
```

## What is where

| Responsibility | Where |
|---|---|
| Dashboard (beige / ink / blue theme, magnifier logo) | `frontend/` |
| Similarity matrix (heatmap) and graph | `frontend/app.js` `drawHeat`, `drawGraph`; Similarity view |
| Pair viewer (side by side, score breakdown, explanation) | `showPair`, `showSscdPair` |
| Statistical analysis (mean, std dev, z-scores, histograms, outliers) | Statistics view; `analysis/statistics/outliers.py` |
| SSCD evaluation (Experiments 4, 5, 9 on real clones) | `analysis/sscd_eval.py`, `experiments/run_sscd_evaluation.py`, SSCD evaluation view |
| Scalability (Experiments 8, 9) | `backend/services.py` `scalability`, `experiments/run_scalability.py`, Scalability view |
| Fast edit distance and LCS (bit-parallel, checked against the DP) | `analysis/similarity/fast_edit.py` |
| Real data | `datasets/sscd/` (SSCD `dataset_c`, MIT licence) |
| Saved results | `experiments/results/` |

## Findings (seed 42, weights 0.10 / 0.25 / 0.55 / 0.10)

* **SSCD:** 80 known clone pairs vs 160 sampled non-clone pairs. At T = 0.70 the composite score
  detects 80/80 clones with 0 non-clones flagged; raw text detects 53/80, normalized text 61/80,
  n-gram Jaccard 66/80, LCS 75/80. Token cosine alone flags all 160 non-clones (it ignores order).
  Composite recall at T = 0.75 is 78/80 and at T = 0.85 only 18/80, so thresholds matter.
* **Best n for n-grams:** AUC 0.998 for n = 2 and 1.000 for n = 3, 4, 5; the mean score of
  non-clones falls from 0.37 (n = 2) to 0.08 (n = 5), so larger n separates more, while clone scores fall too.
* **Candidate filter:** T_L = 0.6 saves 29% of the 12,720 fragment pairs and keeps 80/80 clones;
  T_L = 0.7 saves 45% but keeps 78/80; T_L = 0.8 saves 63% and keeps only 53/80.
* **Scalability:** pair count follows N(N-1)/2 exactly. Similarity time grows with exponent
  about 2.0 (N = 50 to 600: 12 ms to 1.9 s); tokenizing grows linearly.

## Limitations (read before quoting numbers)

* The negatives are **sampled comparison pairs**, not verified ground truth. They were not hand-inspected
  and are mostly easy (random functions from different clone groups), so AUC saturates at 1.000 for
  several measures. Use threshold behaviour, not AUC, to compare them.
* The SSCD clones are mostly lightly edited copies, so they are already similar as raw text; this dataset
  cannot show the benefit of identifier normalization. The controlled-transformation lab does.
* The scalability inputs are edited copies of the 10 demo programs, not the 661 ITSP programs; the ITSP
  dataset is not in this repository. Raw Levenshtein is excluded from the timing runs.
* Raw/normalized/LCS in the SSCD evaluation use the bit-parallel implementation in `fast_edit.py`;
  `tests/test_student4_sscd_and_scalability.py` checks it against the textbook DP in `metrics.py`.
* Similarity flags structural similarity for human review. It never decides plagiarism.
