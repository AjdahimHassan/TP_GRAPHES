"""Module 2 — plus courts chemins : Dijkstra (tas binaire), Bellman–Ford, Floyd–Warshall.

- Dijkstra : poids ≥ 0 obligatoires ; file de priorité `heapq` avec suppression paresseuse
  (on ignore une entrée du tas si sa distance est périmée). O((V + E) log V).
- Bellman–Ford : |V|−1 passes de relâchement de tous les arcs (arrêt anticipé si une passe ne
  change rien). Accepte les poids négatifs. O(V·E).
- Floyd–Warshall : toutes les paires, matrice V×V, triple boucle sur k, i, j. O(V³) temps, O(V²) mémoire.

Les trois acceptent plusieurs sources (multi-source) : c'est ce qui permet de choisir la caserne
la plus proche de chaque incident en un seul calcul.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass

from novapolis.algorithms.trace import Tracer
from novapolis.graph.digraph import DiGraph

INF = float("inf")


@dataclass
class SPResult:
    dist: list[float]
    parent: list[int]  # prédécesseur sur le plus court chemin (-1 = source ou non atteint)
    origine: list[int]  # source de départ retenue (-1 = non atteint)
    relaxables: list[int] | None = None  # Bellman–Ford : sommets encore améliorables à la passe |V|
    passes: int = 0


def dijkstra(g: DiGraph, sources: list[int], tracer: Tracer | None = None) -> SPResult:
    dist = [INF] * g.n
    parent = [-1] * g.n
    origine = [-1] * g.n
    fait = [False] * g.n
    tas: list[tuple[float, int]] = []
    for s in sources:
        dist[s] = 0.0
        origine[s] = s
        heapq.heappush(tas, (0.0, s))
    while tas:
        d, u = heapq.heappop(tas)
        if fait[u]:
            continue  # entrée périmée (u déjà définitivement traité)
        fait[u] = True
        if tracer:
            tracer.emit("fixe", sommet=u, dist=d)
        for e in g.adj[u]:
            if e.w < 0:
                raise ValueError("Dijkstra exige des poids positifs ou nuls : utiliser Bellman–Ford")
            nd = d + e.w
            if nd < dist[e.v]:  # relâchement de l'arc u → v
                if tracer:
                    tracer.emit("relache", depuis=u, sommet=e.v, dist=nd, w=e.w, ancien=dist[e.v])
                dist[e.v] = nd
                parent[e.v] = u
                origine[e.v] = origine[u]
                heapq.heappush(tas, (nd, e.v))
            elif tracer:  # arc examiné sans amélioration (traçage seulement)
                tracer.emit("ignore", depuis=u, sommet=e.v, dist=nd, w=e.w, ancien=dist[e.v])
    return SPResult(dist, parent, origine)


def bellman_ford(g: DiGraph, sources: list[int], tracer: Tracer | None = None) -> SPResult:
    dist = [INF] * g.n
    parent = [-1] * g.n
    origine = [-1] * g.n
    for s in sources:
        dist[s] = 0.0
        origine[s] = s
    arcs = [(u, e.v, e.w) for u in range(g.n) for e in g.adj[u]]  # liste d'arcs
    passes = 0
    for _ in range(max(g.n - 1, 0)):
        passes += 1
        change = False
        if tracer:
            tracer.emit("passe", passe=passes)
        for u, v, w in arcs:
            du = dist[u]
            if du != INF and du + w < dist[v]:
                if tracer:
                    tracer.emit("relache", passe=passes, depuis=u, sommet=v, dist=du + w, w=w, ancien=dist[v])
                dist[v] = du + w
                parent[v] = u
                origine[v] = origine[u]
                change = True
        if not change:
            break  # plus aucune amélioration possible : distances définitives
    # Passe de contrôle |V| : un arc encore relâchable ⇒ circuit absorbant atteignable
    relaxables = []
    for u, v, w in arcs:
        if dist[u] != INF and dist[u] + w < dist[v]:
            relaxables.append(v)
    if tracer:
        tracer.emit("controle", passes=passes, relaxables=sorted(set(relaxables)))
    return SPResult(dist, parent, origine, relaxables=sorted(set(relaxables)), passes=passes)


def floyd_warshall(g: DiGraph, tracer: Tracer | None = None) -> tuple[list[list[float]], list[list[int]]]:
    """Renvoie (d, suivant) : d[i][j] distance, suivant[i][j] = sommet qui suit i sur le chemin i → j."""
    n = g.n
    d = g.to_matrix()
    suivant = [[j if d[i][j] < INF else -1 for j in range(n)] for i in range(n)]
    if tracer:  # matrice complète seulement pour les petits graphes (réponse légère)
        tracer.emit("init", matrice=[row[:] for row in d] if n <= 15 else None)
    for k in range(n):
        avant = [row[:] for row in d] if tracer and n <= 60 else None
        dk = d[k]
        for i in range(n):
            dik = d[i][k]
            if dik == INF:
                continue  # aucun chemin i → k : inutile de parcourir la ligne
            di = d[i]
            si = suivant[i]
            sik = si[k]
            for j in range(n):
                c = dik + dk[j]
                if c < di[j]:  # passer par k améliore i → j
                    di[j] = c
                    si[j] = sik
        if tracer:
            maj = [[i, j] for i in range(n) for j in range(n) if d[i][j] != avant[i][j]] if avant is not None else None
            tracer.emit("pivot", k=k, maj=maj, matrice=[row[:] for row in d] if n <= 15 else None)
    return d, suivant


def path_from_parent(parent: list[int], t: int) -> list[int]:
    """Chemin source → t en remontant les parents (liste vide si t non atteint)."""
    chemin = []
    x = t
    vus = set()
    while x != -1 and x not in vus:
        vus.add(x)
        chemin.append(x)
        x = parent[x]
    chemin.reverse()
    return chemin


def path_from_next(suivant: list[list[int]], i: int, j: int) -> list[int]:
    """Chemin i → j reconstruit depuis la matrice `suivant` de Floyd–Warshall."""
    if suivant[i][j] == -1:
        return []
    chemin = [i]
    n = len(suivant)
    while i != j:
        i = suivant[i][j]
        chemin.append(i)
        if len(chemin) > n:  # boucle infinie possible en présence d'un circuit absorbant
            return []
    return chemin


def floyd_multi_source(d: list[list[float]], sources: list[int], cible: int) -> tuple[float, int]:
    """Plus petite distance d'une des sources vers `cible` (et la source retenue)."""
    best, best_s = INF, -1
    for s in sources:
        if d[s][cible] < best:
            best, best_s = d[s][cible], s
    return best, best_s
