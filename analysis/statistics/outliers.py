import math

def filter_candidates(len_a, len_b, threshold_ratio=0.5):
    if len_a == 0 and len_b == 0:
        return True

    min_len = min(len_a, len_b)
    max_len = max(len_a, len_b)

    # Guard against division by zero
    if max_len == 0:
        return False

    return (min_len / max_len) >= threshold_ratio


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


def compute_batch_statistics(pairwise_results):
    total_pairs = len(pairwise_results)

    # Guard against empty results
    if total_pairs == 0:
        return pairwise_results, {
            'mean': 0.0,
            'std_dev': 0.0,
            'total_pairs': 0,
            'filtered_pairs': 0
        }

    filtered_pairs = sum(1 for r in pairwise_results if r.get('is_filtered', False))

    total_score = sum(r['composite_score'] for r in pairwise_results)
    mean = total_score / total_pairs

    variance = sum((r['composite_score'] - mean) ** 2 for r in pairwise_results) / total_pairs
    std_dev = math.sqrt(variance)

    for result in pairwise_results:
        score = result['composite_score']

        if std_dev > 0:
            z_score = (score - mean) / std_dev
        else:
            z_score = 0.0

        result['z_score'] = z_score
        result['unusually_similar'] = (z_score > 2.0)

    summary_stats = {
        'mean': mean,
        'std_dev': std_dev,
        'total_pairs': total_pairs,
        'filtered_pairs': filtered_pairs
    }

    return pairwise_results, summary_stats
