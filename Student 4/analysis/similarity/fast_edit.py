"""Bit-parallel Levenshtein distance and LCS length (Python big integers).

Same results as the textbook O(mn) dynamic programs in metrics.py, but each text
character costs a handful of big-integer operations instead of a Python loop over
a whole row. Used for the SSCD evaluation and the scalability experiments, where
fragments reach several thousand characters.
"""


def levenshtein(a, b):
    """Edit distance (Myers 1999 / Hyyro 2003)."""
    if len(a) < len(b):
        a, b = b, a            # bit-vector runs over the shorter string
    m = len(b)
    if m == 0:
        return len(a)
    peq = {}
    for i, ch in enumerate(b):
        peq[ch] = peq.get(ch, 0) | (1 << i)
    mask = (1 << m) - 1
    high = 1 << (m - 1)
    pv, mv, score = mask, 0, m
    for ch in a:
        eq = peq.get(ch, 0)
        xv = eq | mv
        xh = (((eq & pv) + pv) ^ pv) | eq
        ph = (mv | ~(xh | pv)) & mask
        mh = pv & xh
        if ph & high:
            score += 1
        elif mh & high:
            score -= 1
        ph = ((ph << 1) | 1) & mask
        mh = (mh << 1) & mask
        pv = (mh | ~(xv | ph)) & mask
        mv = ph & xv
    return score


def raw_similarity(a, b):
    """1 - D(A,B)/max(|A|,|B|), identical definition to calculate_raw_similarity."""
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return 1.0 - levenshtein(a, b) / longest


def lcs_length(a, b):
    """Length of the longest common subsequence of two sequences (Hyyro 2004)."""
    m = len(a)
    if m == 0 or not b:
        return 0
    masks = {}
    for i, x in enumerate(a):
        masks[x] = masks.get(x, 0) | (1 << i)
    full = (1 << m) - 1
    v = full
    for y in b:
        mk = masks.get(y, 0)
        v = ((v + (v & mk)) | (v & ~mk)) & full
    return m - bin(v).count("1")


def lcs_similarity(a, b):
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return lcs_length(a, b) / longest
