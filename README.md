# CodeLens
#### Automated C Programming Assessment and Structural Code Similarity Analysis Platform made as SEC project for 3rd SEM.

## Table of Contents

1. [Overview](#1-overview)
2. [Ethical Scope](#2-ethical-scope)
3. [Key Features](#3-key-features)
4. [System Architecture](#4-system-architecture)
5. [Tech Stack](#5-tech-stack)
6. [Repository Structure](#6-repository-structure)
7. [Datasets](#7-datasets)
8. [Installation and Setup](#8-installation-and-setup)
9. [Usage](#9-usage)
10. [API Reference](#10-api-reference)
11. [Similarity Methodology](#11-similarity-methodology)
12. [Experiments and Results](#12-experiments-and-results)
13. [Testing](#13-testing)
14. [Execution Safety and Limitations](#14-execution-safety-and-limitations)
15. [Screenshots](#15-screenshots)
16. [Team and Contributions](#16-team-and-contributions)
17. [Documentation and Presentation](#17-documentation-and-presentation)
18. [References](#18-references)

---

## 1. Overview

CodeLens is a Python web platform with two cooperating halves:

1. **Automated assessment.** It imports introductory C assignments and student submissions, compiles them with GCC, runs them against test cases under strict timeouts, and records PASS / FAIL outcomes and scores.
2. **Structural similarity analysis.** It preprocesses and tokenizes C source code, computes several similarity measures, builds pairwise similarity matrices and graphs, finds connected groups of similar submissions, flags statistical outliers, and presents everything in an instructor dashboard for human review.

**Central research question:** Which representations of introductory C source code are most robust for identifying structural similarity, and how can similarity analysis be scaled and explained well enough to support practical assessment and code-review workflows?

**Analysis progression:**

`Raw code → Normalized code → Token representation → N-grams → Composite similarity → Graph analysis`

**Primary use cases:**

| # | Use case | Actor |
|---|---|---|
| UC1 | Upload a C file, see compile result, per-test results and score | Student |
| UC2 | View own submission history | Student |
| UC3 | Browse assignments, submissions and test results | Instructor |
| UC4 | Review ranked similar pairs, matrix heatmap, graph and components | Instructor |
| UC5 | Open a side-by-side pair comparison with an explained score breakdown | Instructor |
| UC6 | Validate similarity algorithms against known clones (research mode) | Team / evaluator |

---

## 2. Ethical Scope

CodeLens **never declares plagiarism**. High similarity is not proof of copying, because short programs that solve the same task legitimately look alike. The final judgement is always made by a human reviewer.

The only labels the system uses are:

- `Structural Similarity`
- `Unusually Similar Pair`
- `Potential Code Clone`
- `Requires Review`
- `Unusually High Similarity`

All experiments run only on known public dataset programs.

---

## 3. Key Features

**Assessment**
- ITSP dataset importer
- GCC compilation with diagnostics
- Test runner with timeouts (statuses: `PASS`, `WRONG_ANSWER`, `COMPILATION_ERROR`, `RUNTIME_ERROR`, `TIMEOUT`)
- Score = (passed tests / total tests) x 100

**Code processing**
- Four normalization levels (whitespace, comments, literals, identifiers)
- Custom C tokenizer (no full parser)

**Similarity**
- Raw (Levenshtein), token-frequency cosine, n-gram Jaccard, length ratio, composite score
- Optional: LCS

**Graph and statistics**
- Similarity matrix and heatmap
- Hand-implemented BFS and DFS, connected components, graph statistics
- Candidate filter to reduce pair comparisons
- Z-score outlier flagging

**Web interface**
- Student view: upload, compile result, test results, history
- Instructor view: assignments, submissions, ranked pairs, matrix, graph, components, side-by-side pair comparison with explanation

---

## 4. System Architecture

CodeLens is a modular monolith. The web/backend layer and the analysis library are separate, and a relational database connects them. Analysis is written as pure functions, so it can run offline in notebooks or be called by the backend.

```
Instructor / Student (browser: HTML + CSS + JS)
        |  HTTP/JSON
        v
 Backend (Flask / FastAPI)  ──►  SQLite
        |                          ^
        +─► Execution engine (GCC + subprocess, timeouts, temp dirs)
        |
        +─► Analysis library
              preprocessing → tokenizer → similarity → matrix → graph → statistics
```

**Pipeline:** `Assignment → Submission → {Test Execution → Test Results} and {Code Processing → Tokenization → Similarity → Similarity Graph → Human Review}`

> `[WAITING: final architecture diagram image -> docs/figures/architecture.png]`

> `[WAITING: ER diagram from Student 1 -> docs/figures/er_diagram.png]`

**Final design decisions**

| Decision | Outcome |
|---|---|
| Backend framework | `[WAITING: Flask or FastAPI]` |
| Database | `[WAITING: SQLite only or PostgreSQL too]` |
| Authentication model | `[WAITING: role field with login or mock role switch]` |
| Execution timing | `[WAITING: synchronous or background queue]` |
| Where analysis runs | `[WAITING: on demand in backend or stored batch job]` |

---

## 5. Tech Stack

| Layer | Choice |
|---|---|
| Language | Python |
| Backend | `[WAITING: Flask / FastAPI]` |
| Database | SQLite |
| Execution | GCC + `subprocess.run(..., timeout=...)` |
| Frontend | Plain HTML, CSS, JavaScript |
| Graph and plots | `[WAITING: networkx or hand-written]`, `matplotlib` (BFS and DFS are hand-implemented) |
| Testing | `pytest` |
| Version control | Git / GitHub with peer pull-request review |

---

## 6. Repository Structure

```
codelens/
├── datasets/        (itsp/, sscd/)
├── backend/         (database/, submissions/, execution/, api/)
├── analysis/        (preprocessing/, tokenizer/, similarity/, graph/, statistics/)
├── frontend/
├── tests/
├── experiments/
├── docs/
├── requirements.txt
└── README.md
```

> `[WAITING: confirm this matches the actual repo; update if folders changed]`

---

## 7. Datasets

| Dataset | Content | Role |
|---|---|---|
| **ITSP** (IIT Kanpur, ESEC/FSE 2017 artifacts) | `[WAITING: confirmed program count]` real student C programs from Labs 3-12, with problem statements, buggy and corrected versions, input files and expected outputs | Execution, assessment, preprocessing, buggy-vs-correct analysis |
| **SSCD** (`dataset_c` portion) | `[WAITING: confirmed pair count]` known C clone pairs with line ranges and granularity | Validation of similarity algorithms |

**How ITSP maps to the database:**

- Each unique problem becomes an `ASSIGNMENT`.
- Each C file becomes a `SUBMISSION`.
- Input and output files become `TEST_CASE` rows.

> `[WAITING: confirmed ITSP folder layout and buggy/corrected linking from Students 1 and 2]`

> `[WAITING: where to download the datasets and where to place them in datasets/]`

---

## 8. Installation and Setup

### Prerequisites

- Python `[WAITING: version]`
- GCC `[WAITING: version]`
- Git

### Steps

```bash
# 1. Clone the repository
git clone [WAITING: repository URL]
cd codelens

# 2. Create and activate a virtual environment
[WAITING: commands]

# 3. Install dependencies
pip install -r requirements.txt

# 4. Download datasets into datasets/itsp and datasets/sscd
[WAITING: instructions]

# 5. Initialize the database
[WAITING: command]

# 6. Import the ITSP dataset
[WAITING: command or endpoint POST /admin/import/itsp]

# 7. Start the server
[WAITING: command]
```

> `[WAITING: how to run on Google Colab, if supported]`

---

## 9. Usage

### Student

1. `[WAITING: how to log in or switch role]`
2. Open an assignment and upload a `.c` file.
3. View the compile result, per-test results and score.
4. View submission history.

### Instructor

1. `[WAITING: how to log in or switch role]`
2. Browse assignments, submissions and test results.
3. Trigger the similarity analysis for an assignment.
4. Review ranked pairs, the matrix heatmap, the graph and the components.
5. Open a pair for a side-by-side comparison with the score breakdown.

### Running experiments offline

> `[WAITING: how to open and run the experiment notebook in experiments/]`

---

## 10. API Reference

> `[WAITING: confirm final endpoints from Student 1; the table below is the proposed list]`

| Method and path | Purpose |
|---|---|
| `GET /assignments`, `GET /assignments/{id}` | List and detail |
| `POST /assignments/{id}/submissions` | Upload a C file, then compile, run and return results |
| `GET /submissions/{id}` | Source, compile status, executions, score |
| `GET /users/{id}/submissions` | Student history |
| `GET /assignments/{id}/similarity?threshold=` | Ranked pairs and flags (instructor only) |
| `GET /assignments/{id}/matrix`, `/graph`, `/components` | Analysis outputs (instructor only) |
| `GET /pairs/{a}/{b}` | Pair comparison with explanation (instructor only) |
| `POST /assignments/{id}/analyze` | Trigger similarity computation |
| `POST /admin/import/itsp` | Run the dataset importer |

---

## 11. Similarity Methodology

### 11.1 Normalization levels

| Level | Transformation |
|---|---|
| Baseline | Raw text |
| 1 | Whitespace normalization |
| 2 | Comment removal (`//` and `/* */`), preserving string literals |
| 3 | Literal normalization (numbers become `NUMBER`) |
| 4 | Identifier normalization (user identifiers become `ID`, keywords preserved) |

### 11.2 Tokenizer

Recognizes keywords, identifiers, literals, operators and separators. Output looks like `FOR LPAREN ID ASSIGN NUMBER SEMICOLON`.

> `[WAITING: real input -> normalized -> tokens example from Student 2]`

### 11.3 Similarity measures

| Measure | Definition |
|---|---|
| Raw | `S_raw = 1 - D(A,B) / max(|A|,|B|)` with Levenshtein distance D |
| Token cosine | `S_cos = A.B / (‖A‖‖B‖)` over token-frequency vectors |
| N-gram Jaccard | `S_ngram = |G_A ∩ G_B| / |G_A ∪ G_B|` |
| Length | `S_length = min(L_A,L_B) / max(L_A,L_B)` |
| **Composite** | `S = w_r*S_raw + w_c*S_cos + w_n*S_ngram + w_l*S_length` |

- Final weights: `[WAITING: w_r, w_c, w_n, w_l from Student 2]`
- Best n-gram size: `[WAITING: n from Experiment 4]`

### 11.4 Graph analysis

- **Similarity matrix:** `M` is N x N, symmetric, with `M_ii = 1`, shown as a heatmap.
- **Pair count:** `P(N) = N(N-1)/2`.
- **Graph:** vertices are submissions, and an edge exists when `S >= T`.
- **Connected components:** found with hand-written BFS and DFS.
- **Graph statistics:** vertices, edges, components, largest component, isolated nodes, average degree.
- **Candidate filter:** exclude a pair when the token-length ratio is below `T_L`.
- **Z-score:** `z = (S - mu) / sigma`; `z > 2` is labelled `Unusually High Similarity`.
- Default `T`: `[WAITING]`
- Default `T_L`: `[WAITING]`

### 11.5 Explainability

Each pair shows every component score plus plain-language reasons (for example "Identifiers mostly renamed" or "Token ordering strongly similar").

> `[WAITING: sample explanation output from Student 3]`

---

## 12. Experiments and Results

| # | Experiment | Owner | Key result |
|---|---|---|---|
| 1 | Raw vs whitespace-normalized | Student 2 | `[WAITING]` |
| 2 | Before vs after comment removal | Student 2 | `[WAITING]` |
| 3 | Before vs after identifier normalization | Student 2 | `[WAITING]` |
| 4 | N-gram size comparison (n = 2, 3, 4, 5) | Student 2 | `[WAITING]` |
| 5 | SSCD known-clone detection | Student 2 | `[WAITING: clone recall at T]` |
| 6 | Buggy vs corrected ITSP versions | Student 3 | `[WAITING]` |
| 7 | Graph changes vs threshold T | Student 3 | `[WAITING]` |
| 8 | Pairwise runtime vs submission count | Student 3 | `[WAITING]` |
| 9 | Candidate-filter reduction | Student 3 | `[WAITING]` |
| 10 | Manual analysis of false-positive pairs | Student 2 | `[WAITING]` |

### Threshold sweep

> `[WAITING: table for T = 0.50 ... 0.95 (edges, components, largest component, SSCD clones detected, non-clones flagged)]`

### Runtime vs submission count

> `[WAITING: plot -> docs/figures/runtime.png, plus comparison to the O(N^2) theory]`

### Candidate filter

> `[WAITING: reduction %, share of known similar pairs retained, for each T_L]`

### Summary of findings

> `[WAITING: answer to the central research question, written after all results are in]`

---

## 13. Testing

- **Unit tests:** comment removal, tokenization, identifier normalization, edit distance, cosine, Jaccard, n-gram extraction, graph creation, BFS, DFS, connected components
- **Boundary tests:** empty source, one-line program, compilation failure, infinite loop, identical programs, whitespace-only differences, comment-only differences, renamed variables, completely unrelated programs
- **Integration test:** Dataset → Import → Compile → Test → Preprocess → Tokenize → Similarity → Graph → Dashboard

```bash
pytest tests/
```

> `[WAITING: final test count, pass rate and integration test result]`

---

## 14. Execution Safety and Limitations

Student code is treated as untrusted. Safeguards:

- Per-run temporary directories
- Strict timeouts and output size limits
- No elevated privileges
- No `shell=True`; uploaded filenames are sanitized
- Role-based access (students cannot reach instructor routes)

**Known limitations:**

- `subprocess` is not a sandbox: there is no syscall filtering, network isolation or memory/CPU limiting. A production system would need containers, seccomp or a dedicated judge system.
- High similarity on very short programs does not imply copying.
- Only 80 known clone pairs are available, so threshold choices can overfit. Recall is reported together with false-positive counts.
- Normalizing all identifiers can make unrelated programs look alike.
- Buggy and corrected versions from the same student are similar by design.

> `[WAITING: Student 1's final execution-safety writeup]`

---

## 15. Screenshots

> `[WAITING: student upload and results page -> docs/figures/ui_student.png]`

> `[WAITING: instructor dashboard -> docs/figures/ui_instructor.png]`

> `[WAITING: similarity matrix heatmap -> docs/figures/heatmap.png]`

> `[WAITING: similarity graph and components -> docs/figures/graph.png]`

> `[WAITING: side-by-side pair comparison -> docs/figures/pair_view.png]`

---

## 16. Team and Contributions

| Student | Role | Responsibilities |
|---|---|---|
| `[WAITING: name]` | Student 1: Backend, Execution Engine and Web App | Database schema and ER diagram, ITSP importer, GCC runner, APIs, student and instructor interface |
| `[WAITING: name]` | Student 2: Code Processing and Similarity Engine | SSCD importer, normalization, tokenizer, similarity measures, composite score, Experiments 1-5 and 10 |
| `[WAITING: name]` | Student 3: Graph, Statistics and Experiments | Matrix and heatmap, graph algorithms, z-score, candidate filter, explainability, Experiments 6-9 |
| `[WAITING: name]` | Student 4: Documentation and Presentation | README, technical report, diagrams, presentation, demo script |

All team members review each other's pull requests.

---

## 17. Documentation and Presentation

| Document | Location |
|---|---|
| Technical report | `[WAITING: docs/report.pdf]` |
| Presentation | `[WAITING: docs/presentation.pptx]` |
| Demo script | `[WAITING: docs/demo_script.md]` |
| ER diagram and schema | `[WAITING: docs/figures/er_diagram.png]` |
| Experiment notebook | `[WAITING: experiments/<notebook name>]` |

---

## 18. References

1. `[WAITING: ITSP dataset paper, ESEC/FSE 2017]`
2. `[WAITING: SSCD dataset reference]`
3. `[WAITING: additional references cited in the technical report]`

---

*CodeLens flags structural similarity for human review. It does not determine plagiarism.*
