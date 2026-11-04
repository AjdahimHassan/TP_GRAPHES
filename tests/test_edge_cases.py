"""Cas limites : graphe vide, un sommet, source = cible, cible inaccessible, boucles, arcs parallèles…"""

import pytest

from novapolis.algorithms.mst import kruskal, prim
from novapolis.algorithms.shortest_paths import INF, bellman_ford, dijkstra, floyd_warshall, path_from_next, path_from_parent
from novapolis.algorithms.traversal import bfs, dfs, find_directed_cycle, min_hop_path, tarjan_scc
from novapolis.algorithms.union_find import UnionFind
from novapolis.graph.digraph import build_road_graph
from novapolis.graph.scenario import apply_actions
from novapolis.graph.ugraph import UGraph
from novapolis.model import ActionScenario
from tests.conftest import digraph


def test_graphe_vide():
    g = digraph(0, [])
    assert bfs(g, []).ordre == [] and dfs(g, []).ordre == []
    assert tarjan_scc(g) == [] and find_directed_cycle(g) is None
    assert floyd_warshall(g) == ([], [])
    ug = UGraph([])
    assert kruskal(ug).cout == 0 and prim(ug).composantes == 0


def test_un_sommet():
    g = digraph(1, [])
    assert dijkstra(g, [0]).dist == [0.0]
    assert bellman_ford(g, [0]).dist == [0.0]
    assert min_hop_path(g, 0, 0) == [0]
    ug = UGraph(["A"])
    assert kruskal(ug).composantes == prim(ug).composantes == 1


def test_source_egale_cible():
    g = digraph(3, [(0, 1, 2), (1, 2, 2)])
    assert path_from_parent(dijkstra(g, [1]).parent, 1) == [1]
    d, s = floyd_warshall(g)
    assert path_from_next(s, 2, 2) == [2] and d[2][2] == 0


def test_cible_inaccessible():
    g = digraph(3, [(0, 1, 2)])
    assert dijkstra(g, [0]).dist[2] == INF
    assert bellman_ford(g, [0]).dist[2] == INF
    assert floyd_warshall(g)[0][0][2] == INF
    assert min_hop_path(g, 0, 2) is None


def test_boucle_et_arcs_paralleles():
    g = digraph(2, [(0, 0, 1), (0, 1, 5), (0, 1, 2)])
    assert dijkstra(g, [0]).dist == [0, 2]
    assert floyd_warshall(g)[0][0] == [0, 2]
    assert find_directed_cycle(g) == [0, 0]  # une boucle est un circuit de longueur 1


def test_dijkstra_refuse_poids_negatifs():
    with pytest.raises(ValueError):
        dijkstra(digraph(2, [(0, 1, -1)]), [0])


def test_tous_les_arcs_fermes(mini):
    actions = [ActionScenario("tout", "route", "*", "*", "fermer")]
    r = apply_actions(mini, actions)
    g = build_road_graph(r.dataset)
    assert g.m == 0
    assert bfs(g, [0]).ordre == [0]


def test_union_find():
    uf = UnionFind(5)
    assert uf.union(0, 1) and uf.union(3, 4) and not uf.union(1, 0)
    assert uf.connected(0, 1) and not uf.connected(1, 3)
    assert uf.composantes == 3


def test_parcours_longs_sans_recursion():
    n = 20000  # chaîne très longue : un DFS récursif dépasserait la limite de Python
    g = digraph(n, [(i, i + 1, 1) for i in range(n - 1)])
    assert len(dfs(g, [0]).ordre) == n
    assert len(tarjan_scc(g)) == n
