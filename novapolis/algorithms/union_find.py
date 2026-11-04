"""Union–Find (ensembles disjoints) avec compression de chemin et union par rang.

`find` et `union` coûtent O(α(n)) amorti (α = inverse d'Ackermann, ≤ 4 en pratique).
Utilisé par Kruskal pour savoir en temps quasi constant si une arête crée un cycle.
"""

from __future__ import annotations


class UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))  # chaque élément est sa propre racine au départ
        self.rang = [0] * n  # majorant de la hauteur de l'arbre
        self.composantes = n

    def find(self, x: int) -> int:
        racine = x
        while self.parent[racine] != racine:
            racine = self.parent[racine]
        # compression de chemin : tous les nœuds parcourus pointent directement vers la racine
        while self.parent[x] != racine:
            self.parent[x], x = racine, self.parent[x]
        return racine

    def union(self, a: int, b: int) -> bool:
        """Fusionne les ensembles de a et b. Renvoie False s'ils étaient déjà réunis (⇒ cycle)."""
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        # union par rang : l'arbre le moins haut est accroché sous l'autre
        if self.rang[ra] < self.rang[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rang[ra] == self.rang[rb]:
            self.rang[ra] += 1
        self.composantes -= 1
        return True

    def connected(self, a: int, b: int) -> bool:
        return self.find(a) == self.find(b)

    def snapshot(self) -> list[int]:
        """Copie du tableau parent (visualisation de la forêt dans l'UI)."""
        return list(self.parent)
