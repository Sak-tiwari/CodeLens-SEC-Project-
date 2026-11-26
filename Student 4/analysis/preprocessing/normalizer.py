"""Normalization levels from the CodeLens methodology.

Level 0  raw text (baseline)
Level 1  whitespace normalization
Level 2  comment removal (string-literal safe)
Level 3  literal normalization  (NUMBER / STRING / CHAR)
Level 4  identifier normalization (ID)
"""
import re

from analysis.tokenizer.c_tokenizer import scan, tokenize, token_names

_WORD = re.compile(r"[A-Za-z0-9_]")


def strip_comments(code):
    """Remove // and /* */ comments without touching string/char literals."""
    out, pos = [], 0
    for t in scan(code):
        if t.kind == "comment":
            out.append(code[pos:t.start])
            out.append(" " if t.lexeme.startswith("/*") else "")
            pos = t.end
    out.append(code[pos:])
    return "".join(out)


def normalize_whitespace(code):
    """Collapse runs of blanks, trim lines, drop blank lines."""
    lines = []
    for line in code.splitlines():
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def canonical_text(code):
    """Comment-free text with all insignificant whitespace removed.

    `if(x>0){y++;}` and the same statement spread over four indented lines
    produce identical output.
    """
    parts = []
    prev = ""
    for t in tokenize(code):
        if t.kind == "preproc":
            parts.append("\n" + t.lexeme + "\n")
            prev = "\n"
            continue
        if prev and prev != "\n" and _WORD.match(prev[-1]) and _WORD.match(t.lexeme[0]):
            parts.append(" ")
        parts.append(t.lexeme)
        prev = t.lexeme
    return "".join(parts).strip()


def representations(code):
    """All normalization stages for one program (used by the pipeline viewer)."""
    no_comments = strip_comments(code)
    return {
        "raw": code,
        "whitespace": normalize_whitespace(code),
        "no_comments": normalize_whitespace(no_comments),
        "canonical": canonical_text(code),
        "tokens_literals": token_names(code, normalize_identifiers=False, normalize_literals=True),
        "tokens": token_names(code),
    }
