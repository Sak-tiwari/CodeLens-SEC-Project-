import math

# 1. Import mathematical metric functions from metrics.py
from analysis.similarity.metrics import (
    calculate_raw_similarity,
    calculate_cosine_similarity,
    calculate_jaccard_similarity,
    calculate_length_similarity,
    calculate_lcs_similarity,
    calculate_composite_score
)

# 2. Import filtering and statistical functions from outliers.py
from analysis.statistics.outliers import (
    filter_candidates,
    calculate_z_scores,
    compute_batch_statistics
)

# 3. Import network and graph traversal functions from network.py
from analysis.graph.network import (
    build_similarity_graph,
    bfs_traversal,
    dfs_traversal,
    find_connected_components
)


def process_pairwise_similarities(submissions, weights_dict, threshold_ratio=0.5, max_lcs_len=1500):
    results = []
    n = len(submissions)

    for i in range(n):
        for j in range(i + 1, n):
            sub_a = submissions[i]
            sub_b = submissions[j]

            len_a = sub_a.get('length', 0)
            len_b = sub_b.get('length', 0)

            is_candidate = filter_candidates(len_a, len_b, threshold_ratio)

            scores = {}
            scores['length'] = calculate_length_similarity(len_a, len_b)

            if is_candidate:
                scores['raw'] = calculate_raw_similarity(sub_a.get('text', ''), sub_b.get('text', ''))
                scores['cosine'] = calculate_cosine_similarity(sub_a.get('freq', {}), sub_b.get('freq', {}))
                scores['ngram'] = calculate_jaccard_similarity(sub_a.get('ngrams', set()), sub_b.get('ngrams', set()))
                scores['lcs'] = calculate_lcs_similarity(sub_a.get('tokens', []), sub_b.get('tokens', []), max_lcs_len)
            else:
                scores['raw'] = 0.0
                scores['cosine'] = 0.0
                scores['ngram'] = 0.0
                scores['lcs'] = 0.0

            composite = calculate_composite_score(scores, weights_dict)

            results.append({
                'id_a': sub_a.get('id'),
                'id_b': sub_b.get('id'),
                'is_filtered': not is_candidate,
                'scores': scores,
                'composite_score': composite
            })

    return results


def generate_similarity_matrix(submissions_ids, pairwise_results):
    n = len(submissions_ids)
    matrix = [[0.0] * n for _ in range(n)]

    id_to_index = {sub_id: idx for idx, sub_id in enumerate(submissions_ids)}

    for i in range(n):
        matrix[i][i] = 1.0

    for result in pairwise_results:
        idx_a = id_to_index.get(result['id_a'])
        idx_b = id_to_index.get(result['id_b'])

        if idx_a is not None and idx_b is not None:
            score = result['composite_score']
            matrix[idx_a][idx_b] = score
            matrix[idx_b][idx_a] = score

    return matrix

def filter_candidates(len_a, len_b, threshold_ratio=0.5):
    if len_a == 0 and len_b == 0:
        return True

    min_len = min(len_a, len_b)
    max_len = max(len_a, len_b)

    # Guard against division by zero
    if max_len == 0:
        return False

    return (min_len / max_len) >= threshold_ratio


def build_similarity_matrix(submissions, weight_dict, score_func=None):
    n = len(submissions)
    matrix = [[0.0] * n for _ in range(n)]

    for i in range(n):
        for j in range(i, n):
            if i == j:
                matrix[i][j] = 1.0
            else:
                # Use provided score_func, fallback to 0.0 if not provided
                score = score_func(submissions[i], submissions[j], weight_dict) if score_func else 0.0
                matrix[i][j] = score
                matrix[j][i] = score

    return matrix


def build_similarity_graph(submissions_ids, similarity_matrix, threshold=0.75):
    n = len(submissions_ids)
    graph = {node_id: [] for node_id in submissions_ids}

    for i in range(n):
        for j in range(i + 1, n):
            if similarity_matrix[i][j] >= threshold:
                graph[submissions_ids[i]].append(submissions_ids[j])
                graph[submissions_ids[j]].append(submissions_ids[i])

    return graph


def bfs_traversal(graph, start_node):
    visited = []
    queue = [start_node]
    visited_set = {start_node}

    while queue:
        current = queue.pop(0)
        visited.append(current)

        for neighbor in graph.get(current, []):
            if neighbor not in visited_set:
                visited_set.add(neighbor)
                queue.append(neighbor)

    return visited


def dfs_traversal(graph, start_node):
    visited = []
    stack = [start_node]
    visited_set = {start_node}

    while stack:
        current = stack.pop()
        visited.append(current)

        # Reverse to maintain standard left-to-right traversal order
        for neighbor in reversed(graph.get(current, [])):
            if neighbor not in visited_set:
                visited_set.add(neighbor)
                stack.append(neighbor)

    return visited


def find_connected_components(graph):
    visited = set()
    components = []

    for node in graph:
        if node not in visited:
            component = bfs_traversal(graph, node)
            visited.update(component)
            components.append(component)

    return components


def calculate_z_scores(pairwise_scores):
    n = len(pairwise_scores)

    if n == 0:
        return []

    population_mean = sum(pairwise_scores) / n
    variance = sum((score - population_mean) ** 2 for score in pairwise_scores) / n
    population_std_dev = math.sqrt(variance)

    # Guard against division by zero for uniform datasets
    if population_std_dev == 0.0:
        return [0.0 for _ in pairwise_scores]

    z_scores = [(score - population_mean) / population_std_dev for score in pairwise_scores]

    return z_scores




class SimilarityAnalyzer:
    def analyze_all_submissions(self, processed_submissions, weights_dict=None, similarity_threshold=0.75, candidate_ratio=0.5):
        if weights_dict is None:
            weights_dict = {
                'raw': 0.10,
                'cosine': 0.25,
                'ngram': 0.55,
                'length': 0.10,
                'lcs': 0.0
            }

        pairwise_raw_results = process_pairwise_similarities(
            processed_submissions,
            weights_dict,
            candidate_ratio
        )

        updated_results, stats = compute_batch_statistics(pairwise_raw_results)

        submissions_ids = [sub.get('id') for sub in processed_submissions]

        matrix = generate_similarity_matrix(submissions_ids, updated_results)

        graph = build_similarity_graph(submissions_ids, matrix, similarity_threshold)

        components = find_connected_components(graph)

        formatted_pairwise_results = []
        for result in updated_results:
            is_unusual = result.get('unusually_similar', False)
            explanation = "High structural similarity; candidate for human review" if is_unusual else "Similarity within normal range"

            formatted_pairwise_results.append({
                "sub_a": result.get("id_a"),
                "sub_b": result.get("id_b"),
                "scores": {
                    "raw": result["scores"].get("raw", 0.0),
                    "cosine": result["scores"].get("cosine", 0.0),
                    "ngram": result["scores"].get("ngram", 0.0),
                    "length": result["scores"].get("length", 0.0),
                    "lcs": result["scores"].get("lcs", 0.0),
                    "composite": result.get("composite_score", 0.0)
                },
                "z_score": result.get("z_score", 0.0),
                "unusually_similar": is_unusual,
                "explanation": explanation
            })

        return {
            "pairwise_results": formatted_pairwise_results,
            "similarity_matrix": matrix,
            "graph": graph,
            "connected_components": components,
            "stats": stats
        }
