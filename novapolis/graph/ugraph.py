"""Graphe non orienté pondéré du réseau de fibre.

Deux représentations complémentaires :
- `edges` : liste d'arêtes (u, v, coût, cle) → Kruskal (tri global des arêtes) ;
- `adj[u] = [(v, coût, id_arête), ...]` → Prim, composantes connexes (BFS).
Les tronçons « interdit » ou « panne » sont exclus de l'ensemble candidat.
"""

from __future__ import annotations

from typing import NamedTuple

from novapolis.model import Dataset


class UEdge(NamedTuple):
    u: int
    v: int
    w: float
    cle: int  # numéro de la ligne dans fibre.csv


class UGraph:
    def __init__(self, ids: list[str]):
        self.ids: list[str] = list(ids)
        self.index: dict[str, int] = {s: i for i, s in enumerate(self.ids)}
        self.n: int = len(self.ids)
        self.edges: list[UEdge] = []
        self.adj: list[list[tuple[int, float, int]]] = [[] for _ in range(self.n)]

    def add_edge(self, u: int, v: int, w: float, cle: int = -1) -> int:
        eid = len(self.edges)
        self.edges.append(UEdge(u, v, w, cle))
        self.adj[u].append((v, w, eid))
        if u != v:
            self.adj[v].append((u, w, eid))
        return eid

    @property
    def m(self) -> int:
        return len(self.edges)

    def find_edge(self, a: int, b: int) -> int:
        """Indice de l'arête a–b de coût minimal (-1 si absente)."""
        best, best_w = -1, float("inf")
        for v, w, eid in self.adj[a]:
            if v == b and w < best_w:
                best, best_w = eid, w
        return best

    def label(self, eid: int) -> str:
        e = self.edges[eid]
        return f"{self.ids[e.u]}-{self.ids[e.v]}"


def build_fibre_graph(ds: Dataset) -> UGraph:
    """Graphe des tronçons réalisables (statut « disponible »), boucles ignorées."""
    g = UGraph(ds.site_ids())
    for cle, t in enumerate(ds.fibre):
        if t.statut != "disponible":
            continue
        u, v = g.index[t.u], g.index[t.v]
        if u == v:
            continue
        g.add_edge(u, v, t.cost, cle)
    return g
