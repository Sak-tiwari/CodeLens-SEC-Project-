import math

def calculate_raw_similarity(text_a, text_b):
    len_a, len_b = len(text_a), len(text_b)

    # Guard against division by zero
    if len_a == 0 and len_b == 0:
        return 1.0

    dp = [[0] * (len_b + 1) for _ in range(len_a + 1)]

    for i in range(len_a + 1):
        dp[i][0] = i
    for j in range(len_b + 1):
        dp[0][j] = j

    for i in range(1, len_a + 1):
        for j in range(1, len_b + 1):
            cost = 0 if text_a[i - 1] == text_b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # Deletion
                dp[i][j - 1] + 1,       # Insertion
                dp[i - 1][j - 1] + cost # Substitution
            )

    distance = dp[len_a][len_b]
    max_len = max(len_a, len_b)

    return 1.0 - (distance / max_len)


def calculate_cosine_similarity(freq_a, freq_b):
    mag_a = math.sqrt(sum(count ** 2 for count in freq_a.values()))
    mag_b = math.sqrt(sum(count ** 2 for count in freq_b.values()))

    # Guard against division by zero
    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0

    dot_product = sum(freq_a.get(token, 0) * count for token, count in freq_b.items())

    return dot_product / (mag_a * mag_b)


def calculate_jaccard_similarity(set_a, set_b):
    set_a = set(set_a)
    set_b = set(set_b)

# Guard against division by zero
    if not set_a and not set_b:
        return 1.0

    intersection_size = len(set_a.intersection(set_b))
    union_size = len(set_a.union(set_b))

    if union_size == 0:
        return 0.0

    return intersection_size / union_size


def calculate_length_similarity(len_a, len_b):
    # Guard against division by zero
    if len_a == 0 and len_b == 0:
        return 1.0

    min_len = min(len_a, len_b)
    max_len = max(len_a, len_b)

    if max_len == 0:
        return 0.0

    return min_len / max_len


def calculate_lcs_similarity(tokens_a, tokens_b, max_len=1500):
    len_a, len_b = len(tokens_a), len(tokens_b)

    # Prevent computational slowdown for very large lists
    if len_a > max_len or len_b > max_len:
        return 0.0

    # Guard against division by zero
    if len_a == 0 and len_b == 0:
        return 1.0

    dp = [[0] * (len_b + 1) for _ in range(len_a + 1)]

    for i in range(1, len_a + 1):
        for j in range(1, len_b + 1):
            if tokens_a[i - 1] == tokens_b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    lcs_length = dp[len_a][len_b]
    max_len_ab = max(len_a, len_b)

    return lcs_length / max_len_ab


def calculate_composite_score(scores_dict, weights_dict):
    composite_score = 0.0

    for metric, weight in weights_dict.items():
        score = scores_dict.get(metric, 0.0)
        composite_score += score * weight

    return composite_score
