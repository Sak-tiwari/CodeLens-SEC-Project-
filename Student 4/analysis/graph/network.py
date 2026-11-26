def build_similarity_graph(submissions_ids, similarity_matrix, threshold=0.75):
    n = len(submissions_ids)
    graph = {node_id: [] for node_id in submissions_ids}

    for i in range(n):
        for j in range(i + 1, n):
            if similarity_matrix[i][j] >= threshold:
                graph[submissions_ids[i]].append(submissions_ids[j])
                graph[submissions_ids[j]].append(submissions_ids[i])

    return graph


def bfs_traversal(graph, start_node):
    visited = []
    queue = [start_node]
    visited_set = {start_node}

    while queue:
        current = queue.pop(0)
        visited.append(current)

        for neighbor in graph.get(current, []):
            if neighbor not in visited_set:
                visited_set.add(neighbor)
                queue.append(neighbor)

    return visited


def dfs_traversal(graph, start_node):
    visited = []
    stack = [start_node]
    visited_set = {start_node}

    while stack:
        current = stack.pop()
        visited.append(current)

        # Reverse to maintain standard left-to-right traversal order
        for neighbor in reversed(graph.get(current, [])):
            if neighbor not in visited_set:
                visited_set.add(neighbor)
                stack.append(neighbor)

    return visited


def find_connected_components(graph):
    visited = set()
    components = []

    for node in graph:
        if node not in visited:
            component = bfs_traversal(graph, node)
            visited.update(component)
            components.append(component)

    return components
