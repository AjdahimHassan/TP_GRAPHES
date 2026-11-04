"""Traceur optionnel : enregistre les étapes d'un algorithme pour le rejouer pas à pas dans l'UI.

Usage : `t = Tracer(); bfs(g, [0], tracer=t); t.events` → liste de dicts {"type": ..., ...}.
Quand `tracer` vaut None (cas des benchmarks), les algorithmes ne paient aucun coût de traçage.
Le nombre d'événements est plafonné pour éviter des réponses énormes sur les grands graphes.
"""

from __future__ import annotations


class Tracer:
    def __init__(self, limite: int = 20000):
        self.events: list[dict] = []
        self.limite = limite
        self.tronque = False

    def emit(self, type_: str, **donnees) -> None:
        if len(self.events) >= self.limite:
            self.tronque = True
            return
        donnees["type"] = type_
        self.events.append(donnees)

    def to_dict(self) -> dict:
        return {"events": self.events, "tronque": self.tronque, "n": len(self.events)}
