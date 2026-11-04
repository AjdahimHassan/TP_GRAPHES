"""Module 1 — parcours en largeur (BFS) et en profondeur (DFS) et leurs applications.

Trois notions de connexité à ne pas confondre sur un graphe ORIENTÉ :
- accessibilité depuis une source : sommets atteignables par un chemin orienté (BFS/DFS) ;
- connexité faible : composantes du graphe vu comme NON orienté ;
- connexité forte : u et v dans la même composante ssi u ⇝ v ET v ⇝ u (Tarjan).

Tous les parcours sont itératifs (pile ou file explicite) : pas de limite de récursion à 5 000 sommets.
Complexité : O(V + E) avec des listes d'adjacence.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from novapolis.algorithms.trace import Tracer
from novapolis.graph.digraph import DiGraph
from novapolis.graph.ugraph import UGraph

BLANC, GRIS, NOIR = 0, 1, 2
APERCU = 40  # le traceur ne garde que les 40 premiers éléments de la file / pile (réponses légères)


@dataclass
class ParcoursResult:
    ordre: list[int]  # ordre de visite
    niveau: list[int]  # BFS : nombre d'arcs depuis la source la plus proche (-1 = non atteint)
    parent: list[int]  # arbre de parcours (-1 = racine ou non atteint)
    source: list[int]  # source d'origine de chaque sommet (-1 = non atteint)


def bfs(g: DiGraph, sources: list[int], tracer: Tracer | None = None) -> ParcoursResult:
    """BFS multi-source : toutes les sources sont au niveau 0 et entrent dans la file au départ."""
    niveau = [-1] * g.n
    parent = [-1] * g.n
    origine = [-1] * g.n
    ordre: list[int] = []
    file: deque[int] = deque()
    for s in sources:
        if niveau[s] == -1:
            niveau[s] = 0
            origine[s] = s
            file.append(s)
    if tracer:
        tracer.emit("init", file=list(file)[:APERCU], taille=len(file))
    while file:
        u = file.popleft()
        ordre.append(u)
        if tracer:
            tracer.emit("visite", sommet=u, niveau=niveau[u])
        for e in g.adj[u]:
            v = e.v
            if niveau[v] == -1:  # premier passage : on fixe le niveau et le parent
                niveau[v] = niveau[u] + 1
                parent[v] = u
                origine[v] = origine[u]
                file.append(v)
                if tracer:
                    tracer.emit("decouvre", sommet=v, depuis=u, niveau=niveau[v])
        if tracer:
            tracer.emit("file", file=[file[k] for k in range(min(APERCU, len(file)))], taille=len(file))
    return ParcoursResult(ordre, niveau, parent, origine)


def dfs(g: DiGraph, sources: list[int], tracer: Tracer | None = None) -> ParcoursResult:
    """DFS itératif depuis une ou plusieurs sources (même ordre que la version récursive).

    La pile contient des couples (sommet, indice du prochain successeur à examiner).
    """
    vu = [False] * g.n
    parent = [-1] * g.n
    origine = [-1] * g.n
    profondeur = [-1] * g.n
    ordre: list[int] = []
    for s in sources:
        if vu[s]:
            continue
        vu[s] = True
        origine[s] = s
        profondeur[s] = 0
        ordre.append(s)
        pile = [(s, 0)]
        if tracer:
            tracer.emit("visite", sommet=s, niveau=0, pile=[s])
        while pile:
            u, i = pile[-1]
            if i < len(g.adj[u]):
                pile[-1] = (u, i + 1)  # on avance dans la liste des successeurs de u
                v = g.adj[u][i].v
                if not vu[v]:
                    vu[v] = True
                    parent[v] = u
                    origine[v] = s
                    profondeur[v] = profondeur[u] + 1
                    ordre.append(v)
                    pile.append((v, 0))
                    if tracer:
                        tracer.emit("visite", sommet=v, depuis=u, niveau=profondeur[v], pile=[x for x, _ in pile[-APERCU:]], taille=len(pile))
            else:
                pile.pop()  # tous les successeurs de u sont traités
                if tracer:
                    tracer.emit("termine", sommet=u, pile=[x for x, _ in pile[-APERCU:]], taille=len(pile))
    return ParcoursResult(ordre, profondeur, parent, origine)


def build_path(parent: list[int], s: int, t: int) -> list[int] | None:
    """Remonte les parents de t jusqu'à s. None si t n'est pas atteint."""
    if s == t:
        return [s]
    if parent[t] == -1:
        return None
    chemin = [t]
    x = t
    while x != s:
        x = parent[x]
        if x == -1:
            return None
        chemin.append(x)
    chemin.reverse()
    return chemin


def min_hop_path(g: DiGraph, s: int, t: int) -> list[int] | None:
    """Chemin minimisant le NOMBRE D'ARCS (BFS depuis s, arrêt dès que t est découvert)."""
    if s == t:
        return [s]
    parent = [-1] * g.n
    vu = [False] * g.n
    vu[s] = True
    file = deque([s])
    while file:
        u = file.popleft()
        for e in g.adj[u]:
            if not vu[e.v]:
                vu[e.v] = True
                parent[e.v] = u
                if e.v == t:
                    return build_path(parent, s, t)
                file.append(e.v)
    return None


def _composantes(n: int, voisins) -> tuple[list[int], list[list[int]]]:
    """Composantes connexes d'un graphe non orienté donné par `voisins(u)` (BFS)."""
    comp = [-1] * n
    groupes: list[list[int]] = []
    for s in range(n):
        if comp[s] != -1:
            continue
        c = len(groupes)
        comp[s] = c
        groupe = [s]
        file = deque([s])
        while file:
            u = file.popleft()
            for v in voisins(u):
                if comp[v] == -1:
                    comp[v] = c
                    groupe.append(v)
                    file.append(v)
        groupes.append(groupe)
    return comp, groupes


def connected_components(ug: UGraph) -> tuple[list[int], list[list[int]]]:
    """Composantes connexes du réseau de fibre (non orienté)."""
    return _composantes(ug.n, lambda u: (v for v, _, _ in ug.adj[u]))


def weak_components(g: DiGraph) -> tuple[list[int], list[list[int]]]:
    """Composantes faiblement connexes : on oublie le sens des arcs."""
    voisins = g.undirected_neighbors()
    return _composantes(g.n, lambda u: voisins[u])


def find_directed_cycle(g: DiGraph) -> list[int] | None:
    """Détection de circuit orienté par DFS à trois couleurs.

    BLANC = non visité, GRIS = dans la pile (en cours), NOIR = terminé.
    Un arc u → v avec v GRIS est un arc arrière : il ferme un circuit v → … → u → v.
    Renvoie un circuit exemple [v, …, u, v] ou None si le graphe est sans circuit.
    """
    couleur = [BLANC] * g.n
    parent = [-1] * g.n
    for s in range(g.n):
        if couleur[s] != BLANC:
            continue
        couleur[s] = GRIS
        pile = [(s, 0)]
        while pile:
            u, i = pile[-1]
            if i < len(g.adj[u]):
                pile[-1] = (u, i + 1)
                v = g.adj[u][i].v
                if couleur[v] == GRIS:  # arc arrière → circuit trouvé
                    cycle = [u]
                    x = u
                    while x != v:
                        x = parent[x]
                        cycle.append(x)
                    cycle.reverse()
                    cycle.append(v)
                    return cycle
                if couleur[v] == BLANC:
                    couleur[v] = GRIS
                    parent[v] = u
                    pile.append((v, 0))
            else:
                couleur[u] = NOIR
                pile.pop()
    return None


def tarjan_scc(g: DiGraph) -> list[list[int]]:
    """Composantes fortement connexes (algorithme de Tarjan, version itérative).

    index[u] = ordre de découverte ; low[u] = plus petit index atteignable depuis le sous-arbre de u
    en restant dans la pile. Quand low[u] == index[u], u est la racine d'une CFC : on dépile jusqu'à u.
    """
    index = [-1] * g.n
    low = [0] * g.n
    sur_pile = [False] * g.n
    pile: list[int] = []
    composantes: list[list[int]] = []
    compteur = 0
    for s in range(g.n):
        if index[s] != -1:
            continue
        index[s] = low[s] = compteur
        compteur += 1
        pile.append(s)
        sur_pile[s] = True
        appels = [(s, 0)]  # pile d'appels simulée : (sommet, prochain successeur)
        while appels:
            u, i = appels[-1]
            if i < len(g.adj[u]):
                appels[-1] = (u, i + 1)
                v = g.adj[u][i].v
                if index[v] == -1:
                    index[v] = low[v] = compteur
                    compteur += 1
                    pile.append(v)
                    sur_pile[v] = True
                    appels.append((v, 0))
                elif sur_pile[v]:
                    low[u] = min(low[u], index[v])
            else:
                appels.pop()
                if appels:  # remontée : le parent hérite du low de l'enfant
                    p = appels[-1][0]
                    low[p] = min(low[p], low[u])
                if low[u] == index[u]:
                    comp = []
                    while True:
                        w = pile.pop()
                        sur_pile[w] = False
                        comp.append(w)
                        if w == u:
                            break
                    composantes.append(comp)
    return composantes


def isolated_sites(g: DiGraph) -> list[int]:
    """Sites de degré 0 (ni arc entrant ni arc sortant)."""
    dout, din = g.degrees()
    return [u for u in range(g.n) if dout[u] + din[u] == 0]
