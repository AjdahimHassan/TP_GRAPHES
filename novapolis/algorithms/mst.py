"""Module 4 — arbre (ou forêt) couvrant de poids minimal : Kruskal, Prim, égalités, pannes.

- Kruskal : tri des arêtes par coût croissant, on garde une arête si elle relie deux composantes
  différentes (Union–Find). O(E log E). Donne naturellement une FORÊT si le graphe n'est pas connexe.
- Prim : croissance d'un arbre depuis un sommet avec un tas binaire des arêtes sortantes. O(E log V).
  Version « forêt » : quand le tas est vide, on redémarre depuis le prochain sommet non couvert.
- Égalités de coûts : plusieurs ACM existent si une arête hors arbre a le même coût que l'arête
  maximale du cycle qu'elle crée (échange possible sans changer le coût total).
- Panne : retirer une arête de l'arbre le coupe en deux ; on cherche l'arête disponible la moins
  chère qui reconnecte les deux morceaux.
"""

from __future__ import annotations

import heapq
from collections import deque
from dataclasses import dataclass

from novapolis.algorithms.trace import Tracer
from novapolis.algorithms.union_find import UnionFind
from novapolis.graph.ugraph import UGraph


@dataclass
class MSTResult:
    aretes: list[int]  # indices des arêtes retenues (dans ug.edges)
    cout: float
    composantes: int  # nombre d'arbres de la forêt (1 si le graphe est connexe)


def kruskal(ug: UGraph, tracer: Tracer | None = None) -> MSTResult:
    ordre = sorted(range(ug.m), key=lambda i: (ug.edges[i].w, i))  # tri stable par coût puis indice
    uf = UnionFind(ug.n)
    choisies: list[int] = []
    cout = 0.0
    for eid in ordre:
        e = ug.edges[eid]
        ok = uf.union(e.u, e.v)
        if ok:
            choisies.append(eid)
            cout += e.w
        if tracer:
            tracer.emit("arete", arete=eid, u=e.u, v=e.v, cout=e.w, acceptee=ok, uf=uf.snapshot() if ug.n <= 400 else None)
        if len(choisies) == ug.n - 1:
            break  # arbre complet : inutile d'examiner le reste
    return MSTResult(choisies, cout, uf.composantes)


def prim(ug: UGraph, tracer: Tracer | None = None, depart: int = 0) -> MSTResult:
    """Prim avec tas binaire ; en cas d'égalité de coût, l'arête insérée en premier sort en premier."""
    dans_arbre = [False] * ug.n
    choisies: list[int] = []
    cout = 0.0
    composantes = 0
    compteur = 0  # départage des égalités par ordre d'insertion dans le tas
    ordre_departs = [depart] + [s for s in range(ug.n) if s != depart] if ug.n else []
    for s in ordre_departs:
        if dans_arbre[s]:
            continue
        composantes += 1  # nouvel arbre de la forêt
        dans_arbre[s] = True
        if tracer:
            tracer.emit("racine", sommet=s)
        tas: list[tuple[float, int, int, int]] = []
        for v, w, eid in ug.adj[s]:
            if not dans_arbre[v]:
                heapq.heappush(tas, (w, compteur, eid, v))
                compteur += 1
        while tas:
            w, _, eid, v = heapq.heappop(tas)
            if dans_arbre[v]:
                continue  # les deux extrémités sont déjà couvertes : arête ignorée
            dans_arbre[v] = True
            choisies.append(eid)
            cout += w
            if tracer:
                tracer.emit("arete", arete=eid, sommet=v, cout=w, acceptee=True, tas=len(tas))
            for x, wx, ex in ug.adj[v]:
                if not dans_arbre[x]:
                    heapq.heappush(tas, (wx, compteur, ex, x))
                    compteur += 1
    return MSTResult(choisies, cout, composantes)


def _tree_adjacency(ug: UGraph, aretes: list[int]) -> list[list[tuple[int, int]]]:
    adj: list[list[tuple[int, int]]] = [[] for _ in range(ug.n)]
    for eid in aretes:
        e = ug.edges[eid]
        adj[e.u].append((e.v, eid))
        adj[e.v].append((e.u, eid))
    return adj


def tree_path_edges(ug: UGraph, adj_arbre, a: int, b: int) -> list[int] | None:
    """Arêtes du chemin a – b dans l'arbre (BFS), None si a et b sont dans deux arbres différents."""
    parent: dict[int, tuple[int, int]] = {a: (-1, -1)}
    file = deque([a])
    while file:
        u = file.popleft()
        if u == b:
            break
        for v, eid in adj_arbre[u]:
            if v not in parent:
                parent[v] = (u, eid)
                file.append(v)
    if b not in parent:
        return None
    chemin = []
    x = b
    while x != a:
        x, eid = parent[x]
        chemin.append(eid)
    return chemin


def tie_analysis(ug: UGraph, aretes: list[int]) -> dict:
    """Cherche un échange d'arêtes de même coût (preuve qu'il existe plusieurs ACM)."""
    dans = set(aretes)
    couts: dict[float, int] = {}
    for eid in aretes:
        couts[ug.edges[eid].w] = couts.get(ug.edges[eid].w, 0) + 1
    egalites_arbre = {c: k for c, k in couts.items() if k > 1}
    adj = _tree_adjacency(ug, aretes)
    echange = None
    for eid in sorted(range(ug.m), key=lambda i: (ug.edges[i].w, i)):
        if eid in dans:
            continue
        e = ug.edges[eid]
        chemin = tree_path_edges(ug, adj, e.u, e.v)
        if not chemin:
            continue
        maxi = max(chemin, key=lambda i: (ug.edges[i].w, -i))
        if ug.edges[maxi].w == e.w:  # même coût que l'arête maximale du cycle ⇒ échange possible
            echange = {"ajouter": eid, "retirer": maxi, "cout": e.w, "cycle": chemin + [eid]}
            break
    return {"couts_egaux_dans_arbre": egalites_arbre, "echange": echange, "unique": echange is None}


def split_tree(ug: UGraph, aretes: list[int], coupee: int) -> list[int]:
    """Numéro de composante de chaque sommet dans la forêt privée de l'arête `coupee`."""
    uf = UnionFind(ug.n)
    for eid in aretes:
        if eid != coupee:
            e = ug.edges[eid]
            uf.union(e.u, e.v)
    racines: dict[int, int] = {}
    comp = []
    for x in range(ug.n):
        r = uf.find(x)
        if r not in racines:
            racines[r] = len(racines)
        comp.append(racines[r])
    return comp


def repair_after_failure(ug: UGraph, aretes: list[int], coupee: int) -> dict:
    """Retire `coupee` de l'arbre et cherche le raccordement disponible le moins cher.

    Les candidats sont les arêtes du graphe initial (statut disponible), sauf l'arête en panne,
    qui relient le morceau contenant u au morceau contenant v.
    """
    e = ug.edges[coupee]
    comp = split_tree(ug, aretes, coupee)
    cu, cv = comp[e.u], comp[e.v]
    meilleure = -1
    for eid in range(ug.m):
        if eid == coupee:
            continue
        f = ug.edges[eid]
        if {comp[f.u], comp[f.v]} == {cu, cv}:
            if meilleure == -1 or (f.w, eid) < (ug.edges[meilleure].w, meilleure):
                meilleure = eid
    cout_initial = sum(ug.edges[i].w for i in aretes)
    nouveau = cout_initial - e.w + (ug.edges[meilleure].w if meilleure != -1 else 0)
    return {
        "coupee": coupee,
        "raccordement": meilleure if meilleure != -1 else None,
        "cout_initial": cout_initial,
        "nouveau_cout": nouveau,
        "delta": nouveau - cout_initial,
        "composante_u": [x for x in range(ug.n) if comp[x] == cu],
        "composante_v": [x for x in range(ug.n) if comp[x] == cv],
        "reconnecte": meilleure != -1,
    }


def repair_forest(ug: UGraph, gardees: list[int]) -> tuple[list[int], float]:
    """Complète une forêt (arêtes gardées) au moindre coût, comme Kruskal démarré avec ces arêtes.

    Sert au scénario « panne » : on garde l'ancien réseau et on n'ajoute que les raccordements.
    """
    uf = UnionFind(ug.n)
    for eid in gardees:
        e = ug.edges[eid]
        uf.union(e.u, e.v)
    ajoutees: list[int] = []
    cout = 0.0
    for eid in sorted(range(ug.m), key=lambda i: (ug.edges[i].w, i)):
        e = ug.edges[eid]
        if uf.union(e.u, e.v):
            ajoutees.append(eid)
            cout += e.w
    return ajoutees, cout
