"""Graphe orienté pondéré du réseau routier.

Structure : listes d'adjacence `adj[u] = [Edge(v, w, cle), ...]` indexées par des entiers 0..n-1.
- les sites sont numérotés dans l'ordre de sites.csv (`ids[i]` ↔ `index[id]`) ;
- c'est l'équivalent d'un `dict[int, list[Edge]]` à clés contiguës, plus rapide qu'un dict ;
- parcours, Dijkstra, Bellman–Ford : O(deg(u)) pour énumérer les successeurs de u.
Floyd–Warshall utilise une matrice construite à la demande (`to_matrix`).
"""

from __future__ import annotations

from typing import NamedTuple

from novapolis.model import FACTEUR_TRAVAUX, Dataset

INF = float("inf")


class Edge(NamedTuple):
    v: int  # extrémité (indice)
    w: float  # poids (minutes)
    cle: int  # numéro de la ligne dans routes.csv (0 = première ligne de données)


class DiGraph:
    def __init__(self, ids: list[str]):
        self.ids: list[str] = list(ids)
        self.index: dict[str, int] = {s: i for i, s in enumerate(self.ids)}
        self.n: int = len(self.ids)
        self.adj: list[list[Edge]] = [[] for _ in range(self.n)]
        self.m: int = 0

    def add_arc(self, u: int, v: int, w: float, cle: int = -1) -> None:
        self.adj[u].append(Edge(v, w, cle))
        self.m += 1

    def arcs(self):
        """Itère sur tous les arcs (u, v, w, cle) — liste d'arcs pour Bellman–Ford."""
        for u in range(self.n):
            for e in self.adj[u]:
                yield u, e.v, e.w, e.cle

    def reversed(self) -> "DiGraph":
        """Graphe transposé (tous les arcs inversés)."""
        g = DiGraph(self.ids)
        for u, v, w, cle in self.arcs():
            g.add_arc(v, u, w, cle)
        return g

    def undirected_neighbors(self) -> list[list[int]]:
        """Voisins sans tenir compte du sens (pour la connexité faible)."""
        voisins: list[list[int]] = [[] for _ in range(self.n)]
        for u, v, _, _ in self.arcs():
            voisins[u].append(v)
            voisins[v].append(u)
        return voisins

    def degrees(self) -> tuple[list[int], list[int]]:
        """(degré sortant, degré entrant) de chaque sommet."""
        dout = [len(self.adj[u]) for u in range(self.n)]
        din = [0] * self.n
        for u in range(self.n):
            for e in self.adj[u]:
                din[e.v] += 1
        return dout, din

    def to_matrix(self) -> list[list[float]]:
        """Matrice des poids n×n (INF si pas d'arc, 0 sur la diagonale, min des arcs parallèles)."""
        d = [[INF] * self.n for _ in range(self.n)]
        for i in range(self.n):
            d[i][i] = 0.0
        for u, v, w, _ in self.arcs():
            if u == v:
                # une boucle négative est un circuit absorbant : on la garde ; une boucle positive est inutile
                d[u][u] = min(d[u][u], w)
            elif w < d[u][v]:
                d[u][v] = w
        return d

    def weight(self, u: int, v: int) -> float:
        """Poids minimal d'un arc u → v (INF s'il n'existe pas)."""
        best = INF
        for e in self.adj[u]:
            if e.v == v and e.w < best:
                best = e.w
        return best


def arc_weight(temps_normal: float, temps_pointe: float, statut: str, periode: str, facteur_travaux: float = FACTEUR_TRAVAUX) -> float:
    """Coût d'un arc selon la période et le statut (hypothèse : travaux ⇒ temps × facteur)."""
    w = temps_pointe if periode == "pointe" else temps_normal
    if statut == "travaux":
        w = w * facteur_travaux
    return round(w, 6)


def build_road_graph(ds: Dataset, periode: str = "normal", facteur_travaux: float = FACTEUR_TRAVAUX) -> DiGraph:
    """Construit le graphe routier : arcs « ferme » retirés, « travaux » ralentis, boucles ignorées."""
    g = DiGraph(ds.site_ids())
    for cle, a in enumerate(ds.routes):
        if a.statut == "ferme":
            continue
        u, v = g.index[a.u], g.index[a.v]
        if u == v and not ds.allow_negative:
            continue  # une boucle positive n'apporte rien à un plus court chemin
        g.add_arc(u, v, arc_weight(a.temps_normal, a.temps_pointe, a.statut, periode, facteur_travaux), cle)
    return g
