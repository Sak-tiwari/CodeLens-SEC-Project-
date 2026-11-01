import sys
import os
import unittest

# Ensure the root project directory is in the import path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# --- IMPORT PREVIOUSLY CREATED FUNCTIONS ---
from analysis.similarity.metrics import (
    calculate_raw_similarity,
    calculate_cosine_similarity,
    calculate_jaccard_similarity,
    calculate_lcs_similarity,
    calculate_length_similarity
)
from analysis.graph.network import (
    build_similarity_graph,
    bfs_traversal,
    dfs_traversal,
    find_connected_components
)
from analysis.pipeline import (
    SimilarityAnalyzer,
    generate_similarity_matrix
)

class TestSimilarityAnalyzer(unittest.TestCase):

    # --- Unit Tests ---

    def test_levenshtein_distance(self):
        score = calculate_raw_similarity("kitten", "sitting")
        self.assertAlmostEqual(score, 0.5714, places=3)

    def test_cosine_similarity(self):
        freq_a = {'for': 1, 'i': 2, 'in': 1}
        freq_b = {'for': 1, 'j': 2, 'in': 1}
        score = calculate_cosine_similarity(freq_a, freq_b)
        self.assertAlmostEqual(score, 2.0 / 6.0, places=3)

    def test_jaccard_similarity(self):
        set_a = {'a_b', 'b_c', 'c_d'}
        set_b = {'b_c', 'c_d', 'd_e'}
        score = calculate_jaccard_similarity(set_a, set_b)
        self.assertEqual(score, 0.5) 

    def test_lcs_dynamic_programming(self):
        tokens_a = ['def', 'foo', '(', ')', ':']
        tokens_b = ['def', 'bar', '(', ')', ':']
        score = calculate_lcs_similarity(tokens_a, tokens_b)
        self.assertEqual(score, 0.8) 

    def test_similarity_matrix(self):
        subs_ids = ['id1', 'id2']
        results = [{'id_a': 'id1', 'id_b': 'id2', 'composite_score': 0.85}]
        matrix = generate_similarity_matrix(subs_ids, results)
        self.assertEqual(matrix[0][0], 1.0)
        self.assertEqual(matrix[1][1], 1.0)
        self.assertEqual(matrix[0][1], 0.85)
        self.assertEqual(matrix[1][0], 0.85)

    def test_graph_construction(self):
        ids = ['1', '2', '3']
        matrix = [[1.0, 0.8, 0.4], [0.8, 1.0, 0.9], [0.4, 0.9, 1.0]]
        graph = build_similarity_graph(ids, matrix, threshold=0.75)
        self.assertIn('2', graph['1'])
        self.assertNotIn('3', graph['1'])
        self.assertIn('3', graph['2'])

    def test_bfs_traversal(self):
        graph = {'A': ['B', 'C'], 'B': ['A', 'D'], 'C': ['A'], 'D': ['B']}
        visited = bfs_traversal(graph, 'A')
        self.assertEqual(visited, ['A', 'B', 'C', 'D'])

    def test_dfs_traversal(self):
        graph = {'A': ['B', 'C'], 'B': ['A', 'D'], 'C': ['A'], 'D': ['B']}
        visited = dfs_traversal(graph, 'A')
        self.assertEqual(visited, ['A', 'B', 'D', 'C'])

    def test_connected_components(self):
        graph = {'1': ['2'], '2': ['1'], '3': ['4'], '4': ['3'], '5': []}
        components = find_connected_components(graph)
        self.assertEqual(len(components), 3)

    # --- Boundary & Edge Tests ---

    def test_empty_input(self):
        self.assertEqual(calculate_raw_similarity("", ""), 1.0)
        self.assertEqual(calculate_cosine_similarity({}, {}), 0.0)
        self.assertEqual(calculate_jaccard_similarity(set(), set()), 1.0)
        self.assertEqual(calculate_length_similarity(0, 0), 1.0)
        self.assertEqual(calculate_lcs_similarity([], []), 1.0)

    def test_single_token(self):
        self.assertEqual(calculate_jaccard_similarity({'t1'}, {'t2'}), 0.0)
        self.assertEqual(calculate_jaccard_similarity({'t1'}, {'t1'}), 1.0)
        self.assertEqual(calculate_lcs_similarity(['t1'], ['t1']), 1.0)

    def test_identical_programs(self):
        sub = {
            'id': '1',
            'length': 10,
            'text': 'x=1',
            'freq': {'x':1},
            'ngrams': {'x_1'},
            'tokens': ['x', '=', '1']
        }
        analyzer = SimilarityAnalyzer()
        result = analyzer.analyze_all_submissions([sub, sub])
        self.assertEqual(result['similarity_matrix'][0][0], 1.0)

    def test_renamed_variables(self):
        freq_a = {'x': 5, 'y': 2, 'while': 1}
        freq_b = {'a': 5, 'b': 2, 'while': 1}
        score = calculate_cosine_similarity(freq_a, freq_b)
        self.assertTrue(0 < score < 1.0)

    def test_unrelated_programs(self):
        set_a = {'for_i', 'i_in', 'in_range'}
        set_b = {'print_hello', 'hello_world'}
        self.assertEqual(calculate_jaccard_similarity(set_a, set_b), 0.0)
        self.assertEqual(calculate_lcs_similarity(['for', 'i'], ['print', 'hello']), 0.0)

    def test_large_sequence_lcs(self):
        tokens_a = ['a'] * 1501
        tokens_b = ['a'] * 1501
        score = calculate_lcs_similarity(tokens_a, tokens_b, max_len=1500)
        self.assertEqual(score, 0.0) 

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False, verbosity=2)
