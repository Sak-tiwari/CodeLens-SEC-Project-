"""Lightweight C tokenizer (not a full parser).

Produces tokens such as FOR LPAREN ID ASSIGN NUMBER SEMICOLON.  Every token
keeps its source span so that other modules (normalizer, transforms) can
rewrite the original text safely without touching strings or comments.
"""
import re
from collections import namedtuple

KEYWORDS = {
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline",
    "int", "long", "register", "return", "short", "signed", "sizeof", "static",
    "struct", "switch", "typedef", "union", "unsigned", "void", "volatile",
    "while",
}

# Library names that are part of the language environment, not "user" names.
STD_NAMES = {
    "main", "printf", "scanf", "puts", "gets", "fgets", "getchar", "putchar",
    "malloc", "calloc", "realloc", "free", "strlen", "strcpy", "strcmp",
    "strcat", "strncpy", "abs", "sqrt", "pow", "NULL", "EOF", "size_t", "FILE",
    "stdin", "stdout", "stderr", "fopen", "fclose", "exit", "rand", "srand",
    "atoi", "memset", "memcpy", "fprintf", "fscanf", "sprintf", "sscanf",
}

OP_NAMES = {
    "<<=": "LSHIFT_ASSIGN", ">>=": "RSHIFT_ASSIGN", "...": "ELLIPSIS",
    "++": "INCREMENT", "--": "DECREMENT", "->": "ARROW", "<<": "LSHIFT",
    ">>": "RSHIFT", "<=": "LESS_EQUAL", ">=": "GREATER_EQUAL", "==": "EQUAL",
    "!=": "NOT_EQUAL", "&&": "AND", "||": "OR", "+=": "PLUS_ASSIGN",
    "-=": "MINUS_ASSIGN", "*=": "MUL_ASSIGN", "/=": "DIV_ASSIGN",
    "%=": "MOD_ASSIGN", "&=": "AND_ASSIGN", "|=": "OR_ASSIGN",
    "^=": "XOR_ASSIGN", "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH",
    "%": "PERCENT", "=": "ASSIGN", "<": "LESS_THAN", ">": "GREATER_THAN",
    "!": "NOT", "&": "AMPERSAND", "|": "PIPE", "^": "CARET", "~": "TILDE",
    "?": "QUESTION", ":": "COLON", ".": "DOT", ",": "COMMA", ";": "SEMICOLON",
    "(": "LPAREN", ")": "RPAREN", "{": "LBRACE", "}": "RBRACE",
    "[": "LBRACKET", "]": "RBRACKET",
}

_TOKEN_RE = re.compile(
    r"""
    (?P<comment>//[^\n]*|/\*.*?\*/)
   |(?P<preproc>^[ \t]*\#[^\n]*)
   |(?P<string>"(?:\\.|[^"\\\n])*")
   |(?P<char>'(?:\\.|[^'\\\n])+')
   |(?P<number>0[xX][0-9a-fA-F]+[uUlL]*|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fFuUlL]*)
   |(?P<ident>[A-Za-z_]\w*)
   |(?P<op><<=|>>=|\.\.\.|\+\+|--|->|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|/=|%=|&=|\|=|\^=|[-+*/%=<>!&|^~?:.,;(){}\[\]])
    """,
    re.S | re.X | re.M,
)

Token = namedtuple("Token", "kind lexeme start end name")


def scan(code):
    """Yield every token including comments (kind == 'comment')."""
    for m in _TOKEN_RE.finditer(code):
        kind = m.lastgroup
        lex = m.group()
        if kind == "ident":
            name = lex.upper() if lex in KEYWORDS else "ID"
            kind = "keyword" if lex in KEYWORDS else "ident"
        elif kind == "number":
            name = "NUMBER"
        elif kind == "string":
            name = "STRING"
        elif kind == "char":
            name = "CHAR"
        elif kind == "preproc":
            name = "PREPROC"
            lex = lex.strip()
        elif kind == "op":
            name = OP_NAMES[lex]
        else:
            name = "COMMENT"
        yield Token(kind, lex, m.start(), m.end(), name)


def tokenize(code):
    """Tokens without comments."""
    return [t for t in scan(code) if t.kind != "comment"]


def token_names(code, normalize_identifiers=True, normalize_literals=True):
    """Token sequence used by the similarity measures.

    With both flags on (default) user identifiers become ID and literals
    become NUMBER / STRING / CHAR while keywords and operators are preserved.
    """
    out = []
    for t in tokenize(code):
        if t.kind == "ident" and not normalize_identifiers:
            out.append(t.lexeme)
        elif t.kind in ("number", "string", "char") and not normalize_literals:
            out.append(t.lexeme)
        else:
            out.append(t.name)
    return out


def user_identifiers(code):
    """Set of identifier lexemes that are not keywords or library names."""
    return {t.lexeme for t in tokenize(code) if t.kind == "ident" and t.lexeme not in STD_NAMES}
