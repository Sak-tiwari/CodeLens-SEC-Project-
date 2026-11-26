"""Tests for the bit-parallel edit distance, the SSCD evaluation and its API."""
import os
import random
import sys
import tempfile
import unittest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["CODELENS_DB"] = os.path.join(tempfile.mkdtemp(prefix="codelens_test_s4_"), "test.db")

from analysis import sscd_eval  # noqa: E402
from analysis.similarity import fast_edit  # noqa: E402
from analysis.similarity.metrics import calculate_lcs_similarity, calculate_raw_similarity  # noqa: E402


class TestFastEdit(unittest.TestCase):
    def test_matches_dynamic_programming(self):
        rng = random.Random(7)
        for _ in range(300):
            a = "".join(rng.choice("abc") for _ in range(rng.randint(0, 20)))
            b = "".join(rng.choice("abc") for _ in range(rng.randint(0, 20)))
            self.assertAlmostEqual(fast_edit.raw_similarity(a, b), calculate_raw_similarity(a, b))
            self.assertAlmostEqual(fast_edit.lcs_similarity(list(a), list(b)), calculate_lcs_similarity(list(a), list(b)))

    def test_boundaries(self):
        self.assertEqual(fast_edit.levenshtein("", ""), 0)
        self.assertEqual(fast_edit.levenshtein("abc", ""), 3)
        self.assertEqual(fast_edit.raw_similarity("", ""), 1.0)
        self.assertEqual(fast_edit.raw_similarity("same", "same"), 1.0)
        self.assertEqual(fast_edit.lcs_length([], ["a"]), 0)


class TestSscdEvaluation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.res = sscd_eval.evaluate()

    def test_dataset_loaded(self):
        pairs = sscd_eval.load_pairs()
        self.assertEqual(len(pairs), 80)
        self.assertTrue(all(p["a"]["code"].strip() and p["b"]["code"].strip() for p in pairs))
        self.assertEqual(sum(p["granularity"] == "function" for p in pairs), 77)

    def test_negatives_are_reproducible_and_cross_group(self):
        pairs = sscd_eval.load_pairs()
        n1, n2 = sscd_eval.sample_negatives(pairs, 2, 42), sscd_eval.sample_negatives(pairs, 2, 42)
        self.assertEqual(len(n1), 160)
        self.assertEqual([(x["a"]["file"], x["b"]["file"]) for x in n1], [(x["a"]["file"], x["b"]["file"]) for x in n2])
        self.assertTrue(all(x["a"]["origin"] != x["b"]["origin"] for x in n1))

    def test_auc_and_curve(self):
        self.assertEqual(sscd_eval.auc([0.9, 0.8], [0.1, 0.2]), 1.0)
        self.assertEqual(sscd_eval.auc([0.5], [0.5]), 0.5)
        rows = sscd_eval.curve([0.9, 0.6], [0.7, 0.1], [0.5, 0.8])
        self.assertEqual((rows[0]["tp"], rows[0]["fp"]), (2, 1))
        self.assertEqual((rows[1]["tp"], rows[1]["fp"]), (1, 0))

    def test_result_shape_and_ranges(self):
        r = self.res
        self.assertEqual((r["meta"]["positives"], r["meta"]["negatives"]), (80, 160))
        for m in sscd_eval.MEASURES:
            self.assertTrue(0.0 <= r["summary"][m]["auc"] <= 1.0)
            recalls = [x["recall"] for x in r["curves"][m]]
            self.assertEqual(recalls, sorted(recalls, reverse=True))  # recall never rises with T
        self.assertGreater(r["summary"]["composite"]["mean_pos"], r["summary"]["composite"]["mean_neg"])

    def test_filter_study_monotone(self):
        rows = self.res["filter"]
        self.assertEqual([x["t_l"] for x in rows], sscd_eval.FILTER_RATIOS)
        self.assertEqual([x["candidates"] for x in rows], sorted((x["candidates"] for x in rows), reverse=True))
        self.assertEqual(rows[0]["all_pairs"], 160 * 159 // 2)


class TestSscdApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from backend.app import create_app
        cls.client = create_app().test_client()

    def test_evaluation_endpoint(self):
        d = self.client.get("/api/sscd/evaluation").get_json()
        self.assertEqual(d["meta"]["positives"], 80)

    def test_pair_endpoint(self):
        d = self.client.get("/api/sscd/pair/clone/0").get_json()
        self.assertTrue(d["a"]["code"] and d["b"]["code"])
        self.assertIn("composite", d["scores"])
        self.assertEqual(self.client.get("/api/sscd/pair/clone/999").status_code, 404)
        self.assertEqual(self.client.get("/api/sscd/pair/bogus/0").status_code, 404)

    def test_students_cannot_see_evaluation(self):
        self.assertEqual(self.client.get("/api/sscd/evaluation", headers={"X-Role": "student"}).status_code, 403)

    def test_scalability_pair_counts(self):
        rows = self.client.get("/api/demo/scalability?sizes=10,20").get_json()
        self.assertEqual([r["pairs"] for r in rows], [45, 190])


if __name__ == "__main__":
    unittest.main()
