"""Turn C source into the dictionary shape expected by analysis.pipeline."""
import hashlib
from collections import Counter

from analysis.preprocessing.normalizer import canonical_text
from analysis.tokenizer.c_tokenizer import token_names, user_identifiers


def ngram_set(tokens, n):
    if not tokens:
        return set()
    if len(tokens) < n:
        return {" ".join(tokens)}
    return {" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)}


def prepare_submission(sub_id, code, n=3):
    tokens = token_names(code)
    return {
        "id": sub_id,
        "hash": hashlib.sha1(code.encode("utf-8", "replace")).hexdigest(),
        "text": code,                       # raw baseline stays format-sensitive
        "norm_text": canonical_text(code),  # comments + whitespace removed
        "tokens": tokens,
        "freq": dict(Counter(tokens)),
        "ngrams": ngram_set(tokens, n),
        "length": len(tokens),
        "identifiers": user_identifiers(code),
    }
