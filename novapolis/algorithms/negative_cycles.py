"""Module 3 — circuits absorbants (poids négatifs, jeux de test UNIQUEMENT).

Deux questions distinctes :
1. Existe-t-il un circuit absorbant QUELQUE PART dans le graphe ?
2. Est-il ACCESSIBLE depuis la source choisie ? (seul ce cas rend des distances égales à −∞)

Bellman–Ford : après |V|−1 passes, tout arc encore relâchable marque un sommet ; tout sommet
atteignable depuis un sommet marqué a une distance −∞ (propagation par BFS).
Floyd–Warshall : d[k][k] < 0 ⇔ k est sur un circuit absorbant ; d[i][j] = −∞ s'il existe un tel k
avec d[i][k] < ∞ et d[k][j] < ∞.
Une distance qui peut diminuer indéfiniment n'est JAMAIS affichée comme un nombre fini.
"""

from __future__ import annotations

from collections import deque

from novapolis.algorithms.shortest_paths import INF, bellman_ford, floyd_warshall
from novapolis.graph.digraph import DiGraph

MOINS_INF = float("-inf")


def _propager_moins_inf(g: DiGraph, dist: list[float], depart: list[int]) -> list[float]:
    """BFS depuis les sommets marqués : tout ce qu'ils atteignent passe à −∞."""
    dist = list(dist)
    file = deque(depart)
    for x in depart:
        dist[x] = MOINS_INF
    while file:
        u = file.popleft()
        for e in g.adj[u]:
            if dist[e.v] != MOINS_INF:
                dist[e.v] = MOINS_INF
                file.append(e.v)
    return dist


def cycle_from_parent(parent: list[int], depart: int, n: int) -> list[int]:
    """Extrait un circuit en remontant les prédécesseurs.

    Après n remontées depuis un sommet marqué, on est forcément SUR le circuit ;
    on continue alors jusqu'à revenir au même sommet. Renvoie [c0, c1, …, c0] dans le sens des arcs.
    """
    x = depart
    for _ in range(n):
        if parent[x] == -1:
            return []
        x = parent[x]
    cycle = [x]
    y = parent[x]
    while y != x and y != -1 and len(cycle) <= n:
        cycle.append(y)
        y = parent[y]
    cycle.append(x)
    cycle.reverse()
    return cycle


def normalize_cycle(cycle: list[int]) -> list[int]:
    """Fait commencer le circuit par son plus petit sommet (affichage identique BF / FW)."""
    if len(cycle) < 2:
        return cycle
    corps = cycle[:-1]
    k = corps.index(min(corps))
    corps = corps[k:] + corps[:k]
    return corps + [corps[0]]


def cycle_weight(g: DiGraph, cycle: list[int]) -> float:
    return sum(g.weight(cycle[i], cycle[i + 1]) for i in range(len(cycle) - 1))


def detect_global_cycle(g: DiGraph) -> tuple[bool, list[int]]:
    """Existence d'un circuit absorbant n'importe où : Bellman–Ford depuis TOUS les sommets à 0
    (équivaut à une super-source reliée à chaque sommet par un arc de poids 0)."""
    r = bellman_ford(g, list(range(g.n)))
    if not r.relaxables:
        return False, []
    return True, cycle_from_parent(r.parent, r.relaxables[0], g.n)


def negcycle_bellman_ford(g: DiGraph, source: int) -> dict:
    r = bellman_ford(g, [source])
    existe, cycle = detect_global_cycle(g)
    accessible = bool(r.relaxables)
    dist = r.dist
    if accessible:
        dist = _propager_moins_inf(g, r.dist, r.relaxables)
        cycle = cycle_from_parent(r.parent, r.relaxables[0], g.n) or cycle
    cycle = normalize_cycle(cycle)
    return {
        "algo": "bellman_ford",
        "existe": existe,
        "accessible": accessible,
        "cycle": cycle,
        "poids_cycle": cycle_weight(g, cycle) if cycle else None,
        "dist": dist,
        "passes": r.passes,
        "marques": r.relaxables,
    }


def _cycle_from_next(g: DiGraph, suivant: list[list[int]], k: int) -> list[int]:
    """Circuit passant par k : on suit suivant[·][k] depuis k jusqu'à revoir un sommet."""
    vus: dict[int, int] = {}
    chemin = []
    x = k
    while x not in vus and x != -1 and len(chemin) <= g.n + 1:
        vus[x] = len(chemin)
        chemin.append(x)
        x = suivant[x][k]
    if x == -1 or x not in vus:
        return []
    cycle = chemin[vus[x]:] + [x]
    return cycle if cycle_weight(g, cycle) < 0 else []


def negcycle_floyd(g: DiGraph, source: int) -> dict:
    d, suivant = floyd_warshall(g)
    sur_cycle = [k for k in range(g.n) if d[k][k] < 0]
    existe = bool(sur_cycle)
    accessibles = [k for k in sur_cycle if d[source][k] < INF]
    dist = []
    for j in range(g.n):
        if any(d[source][k] < INF and d[k][j] < INF for k in sur_cycle):
            dist.append(MOINS_INF)
        else:
            dist.append(d[source][j])
    cycle: list[int] = []
    for k in (accessibles or sur_cycle):
        cycle = _cycle_from_next(g, suivant, k)
        if cycle:
            break
    if existe and not cycle:  # secours : extraction par les prédécesseurs de Bellman–Ford
        _, cycle = detect_global_cycle(g)
    cycle = normalize_cycle(cycle)
    return {
        "algo": "floyd_warshall",
        "existe": existe,
        "accessible": bool(accessibles),
        "cycle": cycle,
        "poids_cycle": cycle_weight(g, cycle) if cycle else None,
        "dist": dist,
        "sur_cycle": sur_cycle,
        "diag": [d[k][k] for k in range(g.n)],
    }
