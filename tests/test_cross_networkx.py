"""Vérification croisée contre networkx (utilisé UNIQUEMENT dans les tests, comme oracle)."""

import random

import networkx as nx
import pytest

from novapolis.algorithms.mst import kruskal, prim
from novapolis.algorithms.shortest_paths import INF, bellman_ford, dijkstra, floyd_warshall
from novapolis.algorithms.traversal import connected_components, tarjan_scc, weak_components
from novapolis.graph.ugraph import UGraph
from tests.conftest import digraph


def graphe_aleatoire(graine: int, n: int = 30, p: float = 0.12):
    rng = random.Random(graine)
    arcs = [(u, v, float(rng.randint(1, 20))) for u in range(n) for v in range(n) if u != v and rng.random() < p]
    return digraph(n, arcs), arcs


@pytest.mark.parametrize("graine", range(50))
def test_plus_courts_chemins(graine):
    g, arcs = graphe_aleatoire(graine)
    G = nx.DiGraph()
    G.add_nodes_from(range(g.n))
    for u, v, w in arcs:
        G.add_edge(u, v, weight=w)
    ref = nx.single_source_dijkstra_path_length(G, 0)
    dj = dijkstra(g, [0]).dist
    bf = bellman_ford(g, [0]).dist
    fw = floyd_warshall(g)[0][0]
    for v in range(g.n):
        attendu = ref.get(v, INF)
        assert dj[v] == bf[v] == fw[v] == attendu


@pytest.mark.parametrize("graine", range(20))
def test_scc_et_faible(graine):
    g, arcs = graphe_aleatoire(graine, n=40, p=0.05)
    G = nx.DiGraph()
    G.add_nodes_from(range(g.n))
    G.add_edges_from((u, v) for u, v, _ in arcs)
    assert sorted(sorted(c) for c in tarjan_scc(g)) == sorted(sorted(c) for c in nx.strongly_connected_components(G))
    _, faibles = weak_components(g)
    assert len(faibles) == nx.number_weakly_connected_components(G)


@pytest.mark.parametrize("graine", range(30))
def test_mst(graine):
    rng = random.Random(graine)
    n = 35
    ug = UGraph([str(i) for i in range(n)])
    G = nx.Graph()
    G.add_nodes_from(range(n))
    for u in range(n):
        for v in range(u + 1, n):
            if rng.random() < 0.1:
                w = float(rng.randint(1, 10))  # petits entiers ⇒ beaucoup d'égalités
                ug.add_edge(u, v, w)
                if not G.has_edge(u, v) or G[u][v]["weight"] > w:
                    G.add_edge(u, v, weight=w)
    k, p = kruskal(ug), prim(ug)
    attendu = sum(d["weight"] for _, _, d in nx.minimum_spanning_edges(G, data=True))
    assert k.cout == p.cout == attendu
    assert k.composantes == p.composantes == nx.number_connected_components(G)
    _, comps = connected_components(ug)
    assert len(comps) == nx.number_connected_components(G)
