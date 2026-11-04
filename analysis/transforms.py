"""Controlled source transformations (Transformations A-F of the project brief).

Used by the demo lab to show which similarity measures resist which
superficial edits.  Transformations are token-aware so strings and comments
are never corrupted.  Each function returns new source text, or None when the
transformation does not apply to the given program.
"""
import re

from analysis.tokenizer.c_tokenizer import KEYWORDS, STD_NAMES, tokenize

NAME_POOL = ["value", "count", "index", "result", "temp", "data", "acc", "item", "pos", "elem"]

TRANSFORMS = [
    ("A", "whitespace", "Whitespace changes"),
    ("B", "comments", "Comment changes"),
    ("C", "rename", "Variable renaming"),
    ("D", "literals", "Literal changes"),
    ("E", "for_to_while", "for → while"),
    ("F", "expression", "Equivalent expression (x += y → x = x + y)"),
]


def whitespace(code, seed=0):
    """Re-indent with tabs or 4 spaces, collapse/insert blank lines."""
    out, depth = [], 0
    for line in code.splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("}"):
            depth = max(0, depth - 1)
        if s.startswith("#"):
            out.append(s)
        else:
            out.append(("\t" if seed % 2 == 0 else "    ") * depth + s)
        if s.endswith("{"):
            depth += 1
    sep = "\n\n" if seed % 3 == 2 else "\n"
    return sep.join(out) + "\n"


def comments(code, seed=0):
    notes = ["handle the data", "update state", "step", "main work happens here", "keep going"]
    out = ["/* Student submission - edited %d */" % seed]
    k = 0
    for line in code.splitlines():
        s = line.rstrip()
        if s.endswith(";") and not s.lstrip().startswith("#"):
            s += "  // " + notes[(k + seed) % len(notes)]
            k += 1
        out.append(s)
    return "\n".join(out) + "\n"


def rename(code, seed=0):
    toks = tokenize(code)
    names = []
    for t in toks:
        if t.kind == "ident" and t.lexeme not in STD_NAMES and t.lexeme not in names:
            names.append(t.lexeme)
    if not names:
        return None
    mapping = {n: "%s%d" % (NAME_POOL[(i + seed) % len(NAME_POOL)], seed + i // len(NAME_POOL)) for i, n in enumerate(names)}
    out, pos = [], 0
    for t in toks:
        if t.kind == "ident" and t.lexeme in mapping:
            out.append(code[pos:t.start])
            out.append(mapping[t.lexeme])
            pos = t.end
    out.append(code[pos:])
    return "".join(out)


def literals(code, seed=0):
    toks = tokenize(code)
    out, pos, changed = [], 0, False
    for t in toks:
        if t.kind == "number" and re.fullmatch(r"\d+", t.lexeme) and int(t.lexeme) >= 2:
            out.append(code[pos:t.start])
            out.append(str(int(t.lexeme) + 3 + seed))
            pos = t.end
            changed = True
    out.append(code[pos:])
    return "".join(out) if changed else None


_FOR = re.compile(r"for\s*\(([^;(){}]*);([^;(){}]*);([^;(){}]*)\)\s*")


def _matching_brace(code, open_idx):
    depth = 0
    for i in range(open_idx, len(code)):
        if code[i] == "{":
            depth += 1
        elif code[i] == "}":
            depth -= 1
            if depth == 0:
                return i
    return -1


def for_to_while(code, seed=0):
    changed = False
    for _ in range(20):  # rewrite loops one at a time, left to right
        m = _FOR.search(code, 0)
        if not m:
            break
        init, cond, inc = (g.strip() for g in m.groups())
        body_start = m.end()
        if body_start < len(code) and code[body_start] == "{":
            end = _matching_brace(code, body_start)
            if end < 0:
                return None
            body = code[body_start + 1:end]
            tail = code[end + 1:]
            new = (init + ";\n    " if init else "") + "while (%s) {" % (cond or "1") + body.rstrip() + ("\n        " + inc + ";" if inc else "") + "\n    }"
        else:
            semi = code.find(";", body_start)
            if semi < 0:
                return None
            body = code[body_start:semi + 1]
            tail = code[semi + 1:]
            new = (init + ";\n    " if init else "") + "while (%s) { %s %s }" % (cond or "1", body, (inc + ";") if inc else "")
        code = code[:m.start()] + new + tail
        changed = True
        # mark so the same loop is not matched again: loops are consumed, so continue
    return code if changed else None


_AUG = re.compile(r"([A-Za-z_]\w*(?:\[[^\]\n]*\])?)\s*([-+*/])=\s*([^;\n]+);")


def expression(code, seed=0):
    new, n = _AUG.subn(lambda m: "%s = %s %s (%s);" % (m.group(1), m.group(1), m.group(2), m.group(3).strip()), code)
    return new if n else None


_FUNCS = {
    "whitespace": whitespace, "comments": comments, "rename": rename,
    "literals": literals, "for_to_while": for_to_while, "expression": expression,
}


def apply_transform(code, kind, seed=0):
    return _FUNCS[kind](code, seed)
