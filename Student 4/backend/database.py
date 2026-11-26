"""SQLite schema (follows the suggested CodeLens ER design)."""
import os
import sqlite3

DB_PATH = os.environ.get("CODELENS_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "codelens.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('instructor','student'))
);
CREATE TABLE IF NOT EXISTS assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    external_ref TEXT
);
CREATE TABLE IF NOT EXISTS test_cases (
    test_id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    source_code TEXT NOT NULL,
    submission_time TEXT NOT NULL DEFAULT (datetime('now')),
    version INTEGER NOT NULL DEFAULT 1,
    compile_status TEXT,
    compile_log TEXT,
    score REAL,
    overall_status TEXT,
    origin TEXT DEFAULT 'upload'
);
CREATE TABLE IF NOT EXISTS executions (
    execution_id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    test_id INTEGER NOT NULL REFERENCES test_cases(test_id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    execution_time REAL,
    actual_output TEXT
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect() as c:
        c.executescript(SCHEMA)


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
