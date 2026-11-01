import os
import sys
import json
import time
import pickle
import pandas as pd

# Ensure parent directory is accessible for package imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import metrics, graph, and pipeline engines
from analysis.similarity.metrics import (
    calculate_raw_similarity,
    calculate_cosine_similarity,
    calculate_jaccard_similarity,
    calculate_length_similarity,
    calculate_lcs_similarity,
    calculate_composite_score
)
from analysis.graph.network import (
    build_similarity_graph,
    find_connected_components
)
from analysis.pipeline import SimilarityAnalyzer

# Import visualization helper routines
from experiments.visualization_helpers import (
    plot_similarity_matrix_heatmap,
    plot_pairwise_scalability,
    plot_graph_topology,
    plot_candidate_filtering,
    plot_ngram_sensitivity,
    plot_zscore_distribution,
    plot_explainable_breakdown
)



# --- Pre-processed Data Ingestion & Validation ---
def load_itsp_submissions(filepath):
    """Loads and transforms Student 1's ITSP submissions file."""
    if not os.path.exists(filepath):
        print(f"ERROR: Submissions file not found at path: {filepath}")
        return []

    if filepath.endswith('.pkl') or filepath.endswith('.pickle'):
        with open(filepath, 'rb') as f:
            raw_data = pickle.load(f)
    else:
        with open(filepath, 'r') as f:
            raw_data = json.load(f)

    formatted_data = []
    for item in raw_data:
        formatted_data.append({
            'id': item.get('submission_id', ''),
            'text': " ".join(item.get('tokens', [])),
            'tokens': item.get('tokens', []),
            'freq': item.get('token_frequencies', {}),
            'ngrams': set(item.get('ngrams', [])),
            'length': item.get('length', 0),
            'problem_id': item.get('problem_id', '')
        })

    return formatted_data


def load_sscd_pairs(filepath):
    """Loads SSCD known clone pairs as order-independent sorted tuples."""
    if not os.path.exists(filepath):
        print(f"ERROR: SSCD clone pairs file not found at path: {filepath}")
        return set()

    if filepath.endswith('.pkl') or filepath.endswith('.pickle'):
        with open(filepath, 'rb') as f:
            raw_pairs = pickle.load(f)
    else:
        with open(filepath, 'r') as f:
            raw_pairs = json.load(f)

    return set(tuple(sorted([pair[0], pair[1]])) for pair in raw_pairs)


def validate_datasets(submissions, clone_pairs):
    """Verifies schema structure and reports errors if datasets are missing or invalid."""
    print("--- Dataset Validation Report ---")
    if not submissions:
        print("CRITICAL ERROR: Submissions dataset is empty or invalid. Halting execution.")
        return False

    sample = submissions[0]
    required_keys = {'id', 'tokens', 'freq', 'ngrams', 'length'}
    missing_keys = required_keys - set(sample.keys())

    if missing_keys:
        print(f"CRITICAL ERROR: Dataset missing required fields from Student 1: {missing_keys}")
        return False

    print(f"Total Submissions Loaded: {len(submissions)}")
    print(f"Total SSCD Clone Pairs Loaded: {len(clone_pairs)}")
    print("Schema Validation Status: PASS\n")
    return True



# --- Explainable Similarity Generator ---
def generate_explainable_similarity(submission_a, submission_b, weights=None):
    """Calculates multi-layer scores and returns diagnostic explanations."""
    if weights is None:
        weights = {'raw': 0.10, 'cosine': 0.25, 'ngram': 0.55, 'length': 0.10, 'lcs': 0.0}

    scores = {
        'length': calculate_length_similarity(submission_a.get('length', 0), submission_b.get('length', 0)),
        'raw': calculate_raw_similarity(submission_a.get('text', ''), submission_b.get('text', '')),
        'cosine': calculate_cosine_similarity(submission_a.get('freq', {}), submission_b.get('freq', {})),
        'ngram': calculate_jaccard_similarity(set(submission_a.get('ngrams', [])), set(submission_b.get('ngrams', []))),
        'lcs': calculate_lcs_similarity(submission_a.get('tokens', []), submission_b.get('tokens', []))
    }

    composite = calculate_composite_score(scores, weights)
    explanations = []

    if (scores['cosine'] > 0.8 or scores['ngram'] > 0.8) and scores['raw'] < 0.5:
        explanations.append("Identifiers renamed or reformatted, but core logical structure is identical.")
    if scores['length'] > 0.8 and scores['cosine'] < 0.5:
        explanations.append("Similar program size, but completely different logic.")
    if scores['lcs'] > 0.7:
        explanations.append("Strong sequence alignment indicating structural code reordering or shared code segments.")

    if not explanations:
        explanations.append("No unusual metric divergence detected.")

    explanation_text = " ".join(explanations)

    return {
        'sub_a_id': submission_a.get('id'),
        'sub_b_id': submission_b.get('id'),
        'scores': scores,
        'composite': composite,
        'explanation': explanation_text
    }


# --- Main Experiment Suite Runner ---
def main():
    # Configure dataset paths
    ITSP_PATH = '/content/drive/MyDrive/CodeLens/itsp_submissions.json'
    SSCD_PATH = '/content/drive/MyDrive/CodeLens/sscd_clone_pairs.json'

    # 1. Ingest Data
    itsp_data = load_itsp_submissions(ITSP_PATH)
    sscd_clone_pairs = load_sscd_pairs(SSCD_PATH)

    # 2. Validate Data Integrity (Halt execution on missing/invalid input)
    if not validate_datasets(itsp_data, sscd_clone_pairs):
        sys.exit(1)

    analyzer = SimilarityAnalyzer()

  
    # EXPERIMENT 5: SSCD Clone Detection Evaluation
    print("--- Experiment 5: SSCD Clone Detection Evaluation ---")
    analysis_results = analyzer.analyze_all_submissions(itsp_data)
    pairwise = analysis_results.get('pairwise_results', [])

    thresholds_exp5 = [0.50, 0.60, 0.70, 0.80, 0.90]
    for t in thresholds_exp5:
        detected = 0
        for res in pairwise:
            pair_id = tuple(sorted([res['sub_a'], res['sub_b']]))
            if pair_id in sscd_clone_pairs and res['scores']['composite'] >= t:
                detected += 1

        recall = detected / len(sscd_clone_pairs) if sscd_clone_pairs else 0.0
        print(f"Threshold T={t:.2f} | CloneRecall(T) = {recall:.2%} ({detected}/{len(sscd_clone_pairs)})")


  
    # EXPERIMENT 4: Token N-Gram Evaluation
    print("\n--- Experiment 4: Token N-Gram Evaluation ---")
    def get_ngrams(tokens, n):
        return set("_".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1))

    sample_pair = (itsp_data[0]['tokens'], itsp_data[1]['tokens'])
    n_sizes = [2, 3, 4, 5]
    n_gram_scores = []

    for n in n_sizes:
        ngrams_a = get_ngrams(sample_pair[0], n)
        ngrams_b = get_ngrams(sample_pair[1], n)
        sim = calculate_jaccard_similarity(ngrams_a, ngrams_b)
        n_gram_scores.append(sim)
        print(f"N={n} | Jaccard Similarity: {sim:.4f}")

    plot_ngram_sensitivity(n_sizes, n_gram_scores)


  
    # EXPERIMENT 7: Graph Threshold Topology Analysis
    print("\n--- Experiment 7: Graph Threshold Topology Analysis ---")
    topology_results = []
    thresholds_exp7 = [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
    matrix = analysis_results['similarity_matrix']
    sub_ids = [sub['id'] for sub in itsp_data]

    t_vals, edges_list, comps_list, max_c_list, avg_deg_list, iso_list = [], [], [], [], [], []

    for t in thresholds_exp7:
        graph = build_similarity_graph(sub_ids, matrix, threshold=t)
        comps = find_connected_components(graph)

        edge_count = sum(len(neighbors) for neighbors in graph.values()) // 2
        comp_count = len(comps)
        max_comp = max((len(c) for c in comps), default=0) if comps else 0
        isolated = sum(1 for v in graph.values() if not v)
        avg_deg = (2 * edge_count / len(sub_ids)) if sub_ids else 0.0

        t_vals.append(t)
        edges_list.append(edge_count)
        comps_list.append(comp_count)
        max_c_list.append(max_comp)
        avg_deg_list.append(avg_deg)
        iso_list.append(isolated)

        topology_results.append({
            "Threshold": t,
            "Edge Count": edge_count,
            "Component Count": comp_count,
            "Max Component Size": max_comp,
            "Isolated Nodes": isolated
        })

    df_topology = pd.DataFrame(topology_results)
    print(df_topology.to_string(index=False))
    plot_graph_topology(t_vals, edges_list, comps_list, max_c_list, avg_deg_list, iso_list)

    
    # EXPERIMENT 8: Pairwise Runtime Scalability
    print("\n--- Experiment 8: Pairwise Runtime Scalability ---")
    sizes = [50, 100, 200, 400, 600]
    scalability_results = []
    valid_n_vals, exec_times = [], []

    for n in sizes:
        if n > len(itsp_data):
            continue

        data_n = itsp_data[:n]
        start = time.time()
        analyzer.analyze_all_submissions(data_n, candidate_ratio=0.7)
        exec_time = time.time() - start

        valid_n_vals.append(n)
        exec_times.append(exec_time)

        scalability_results.append({
            "N": n,
            "Theoretical P(N)": (n * (n - 1)) / 2,
            "Execution Time (s)": round(exec_time, 4)
        })

    df_scalability = pd.DataFrame(scalability_results)
    print(df_scalability.to_string(index=False))
    if valid_n_vals:
        plot_pairwise_scalability(valid_n_vals, exec_times)

    
    # EXPERIMENT 9: Candidate Filtering Efficiency
    print("\n--- Experiment 9: Candidate Filtering Efficiency ---")
    filter_thresholds = [0.4, 0.5, 0.6, 0.7, 0.8]
    n_subs = len(itsp_data)
    total_pairs = (n_subs * (n_subs - 1)) // 2

    precomputed_ratios = []
    for i in range(n_subs):
        len_a = itsp_data[i]['length']
        id_a = itsp_data[i]['id']

        for j in range(i + 1, n_subs):
            len_b = itsp_data[j]['length']
            id_b = itsp_data[j]['id']

            ratio = min(len_a, len_b) / max(len_a, len_b) if max(len_a, len_b) > 0 else 1.0
            is_clone = tuple(sorted([id_a, id_b])) in sscd_clone_pairs
            precomputed_ratios.append((ratio, is_clone))

    red_pct_list, ret_pct_list = [], []
    for t_l in filter_thresholds:
        candidates = sum(1 for r, _ in precomputed_ratios if r >= t_l)
        retained_clones = sum(1 for r, is_c in precomputed_ratios if r >= t_l and is_c)

        reduction_pct = (1 - (candidates / total_pairs)) * 100 if total_pairs else 0.0
        retention_pct = (retained_clones / len(sscd_clone_pairs)) * 100 if sscd_clone_pairs else 0.0

        red_pct_list.append(reduction_pct)
        ret_pct_list.append(retention_pct)

        print(f"TL={t_l:.1f} | Reduction: {reduction_pct:.2f}% | Clone Retention: {retention_pct:.2f}%")

    plot_candidate_filtering(filter_thresholds, red_pct_list, ret_pct_list)


  
    # Generate Heatmap, Z-Score Distribution, and Explainable Breakdown Plots
    if len(sub_ids) >= 2:
        plot_similarity_matrix_heatmap(matrix[:30, :30], sub_ids[:30])

    composite_scores = [res['scores']['composite'] for res in pairwise]
    if composite_scores:
        plot_zscore_distribution(composite_scores)

    # Generate Explainable breakdown on actual dataset sample pairs
    report_data = []
    sample_pairs = [
        ("Identical/Self", itsp_data[0], itsp_data[0]),
        ("Pair 1-2", itsp_data[0], itsp_data[1])
    ]
    if len(itsp_data) > 2:
        sample_pairs.append(("Pair 1-3", itsp_data[0], itsp_data[2]))

    for case_label, sub_a, sub_b in sample_pairs:
        diag = generate_explainable_similarity(sub_a, sub_b)
        for m_name, s_val in diag['scores'].items():
            report_data.append({'Case': case_label, 'Metric': m_name.capitalize(), 'Score': s_val})
        report_data.append({'Case': case_label, 'Metric': 'Composite', 'Score': diag['composite']})

    plot_explainable_breakdown(pd.DataFrame(report_data))
    print("\nExperiment suite execution complete. Generated high-resolution PNG charts.")


if __name__ == "__main__":
    main()
