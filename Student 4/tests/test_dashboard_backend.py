"""Tests for the tokenizer, normalizer, GCC runner and dashboard API."""
import os
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["CODELENS_DB"] = os.path.join(tempfile.mkdtemp(prefix="codelens_test_"), "test.db")

from analysis.pipeline import SimilarityAnalyzer  # noqa: E402
from analysis.prepare import prepare_submission  # noqa: E402
from analysis.preprocessing.normalizer import canonical_text, strip_comments  # noqa: E402
from analysis.tokenizer.c_tokenizer import token_names  # noqa: E402
from analysis.transforms import apply_transform  # noqa: E402
from backend import demo_data, execution  # noqa: E402

LOOP = "for(i=0;i<n;i++)\n    sum += a[i];"


class TestTokenizerAndNormalizer(unittest.TestCase):
    def test_brief_example(self):
        self.assertEqual(token_names(LOOP), [
            "FOR", "LPAREN", "ID", "ASSIGN", "NUMBER", "SEMICOLON", "ID", "LESS_THAN", "ID", "SEMICOLON",
            "ID", "INCREMENT", "RPAREN", "ID", "PLUS_ASSIGN", "ID", "LBRACKET", "ID", "RBRACKET", "SEMICOLON"])

    def test_comments_removed_but_strings_kept(self):
        src = 'int x; // line\n/* block */ printf("a // b /* c */");'
        out = strip_comments(src)
        self.assertNotIn("line", out)
        self.assertNotIn("block", out)
        self.assertIn('"a // b /* c */"', out)

    def test_whitespace_variants_become_identical(self):
        a = "if(x>0){y++;}"
        b = "if (x > 0)\n{\n    y++;\n}\n"
        self.assertEqual(canonical_text(a), canonical_text(b))

    def test_renamed_variables_keep_token_sequence(self):
        src = demo_data.ALICE
        renamed = apply_transform(src, "rename", seed=2)
        self.assertNotEqual(src, renamed)
        self.assertEqual(token_names(src), token_names(renamed))

    def test_for_to_while_changes_structure_but_not_keywords_only(self):
        out = apply_transform(demo_data.ALICE, "for_to_while")
        self.assertIn("while", out)
        self.assertNotIn("for (", out)

    def test_empty_source(self):
        self.assertEqual(token_names(""), [])
        P = prepare_submission(1, "")
        self.assertEqual(P["length"], 0)


@unittest.skipUnless(execution.GCC, "GCC not installed")
class TestExecution(unittest.TestCase):
    TESTS = [{"test_id": 1, "input_data": "3\n1 2 3\n", "expected_output": "6\n"}]

    def run_code(self, code):
        return execution.evaluate(code, self.TESTS, timeout=1.0)

    def test_pass(self):
        r = self.run_code(demo_data.ALICE)
        self.assertEqual((r["overall_status"], r["score"]), ("PASS", 100.0))

    def test_wrong_answer(self):
        self.assertEqual(self.run_code(demo_data.FRANK)["overall_status"], "WRONG_ANSWER")

    def test_compile_error(self):
        r = self.run_code(demo_data.GINA)
        self.assertEqual(r["overall_status"], "COMPILATION_ERROR")
        self.assertTrue(r["compile_log"])

    def test_timeout(self):
        self.assertEqual(self.run_code(demo_data.HANK)["overall_status"], "TIMEOUT")

    def test_runtime_error(self):
        self.assertEqual(self.run_code(demo_data.IVAN)["overall_status"], "RUNTIME_ERROR")

    def test_trailing_whitespace_is_ignored(self):
        self.assertEqual(execution.normalize_output("6  \r\n\n"), "6")


class TestAnalysisMatchesTeamPipeline(unittest.TestCase):
    def test_service_equals_similarity_analyzer(self):
        from backend.services import AnalysisService
        codes = [demo_data.ALICE, demo_data.BOB, demo_data.ERIN, demo_data.FRANK]
        prepared = [prepare_submission(i, c) for i, c in enumerate(codes)]
        expected = SimilarityAnalyzer().analyze_all_submissions(prepared)
        subs = [{"id": i, "label": str(i), "code": c} for i, c in enumerate(codes)]
        got = AnalysisService().analyze(subs, threshold=0.75, candidate_ratio=0.5, n=3,
                                        weights={"raw": 0.10, "cosine": 0.25, "ngram": 0.55, "length": 0.10, "lcs": 0.0})
        self.assertEqual(sorted(map(sorted, got["components"] and [c["nodes"] for c in got["components"]])),
                         sorted(map(sorted, expected["connected_components"])))
        exp = {(r["sub_a"], r["sub_b"]): r["scores"]["composite"] for r in expected["pairwise_results"]}
        for p in got["pairs"]:
            self.assertAlmostEqual(p["composite"], exp[(p["a"], p["b"])], places=9)


@unittest.skipUnless(execution.GCC, "GCC not installed")
class TestApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from backend.app import create_app
        from backend import services
        services.seed(reset=True)
        cls.c = create_app(seed_if_empty=False).test_client()

    def test_seeded_statuses(self):
        subs = self.c.get("/api/assignments/1/submissions").get_json()
        self.assertEqual({s["overall_status"] for s in subs},
                         {"PASS", "WRONG_ANSWER", "COMPILATION_ERROR", "TIMEOUT", "RUNTIME_ERROR"})

    def test_students_cannot_reach_similarity(self):
        self.assertEqual(self.c.get("/api/assignments/1/analysis", headers={"X-Role": "student"}).status_code, 403)
        self.assertEqual(self.c.get("/api/pairs/1/2", headers={"X-Role": "student"}).status_code, 403)

    def test_student_sees_only_own_submissions(self):
        self.assertEqual(self.c.get("/api/submissions/1", headers={"X-Role": "student", "X-User-Id": "9999"}).status_code, 403)

    def test_analysis_shape_and_threshold_effect(self):
        lo = self.c.get("/api/assignments/1/analysis?threshold=0.6").get_json()
        hi = self.c.get("/api/assignments/1/analysis?threshold=0.95").get_json()
        self.assertEqual(lo["stats"]["total_pairs"], 45)
        self.assertGreater(lo["graph_stats"]["edges"], hi["graph_stats"]["edges"])
        self.assertEqual(len(lo["matrix"]), 10)

    def test_submit_and_validation(self):
        r = self.c.post("/api/assignments/1/submissions", json={"user_id": 2, "source_code": demo_data.ALICE})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.get_json()["overall_status"], "PASS")
        self.assertEqual(self.c.post("/api/assignments/1/submissions", json={"user_id": 2, "source_code": "  "}).status_code, 400)
        self.assertEqual(self.c.post("/api/assignments/99/submissions", json={"user_id": 2, "source_code": "x"}).status_code, 404)


if __name__ == "__main__":
    unittest.main()
