"""Benchmarks : temps mesurés vs complexité théorique.

Protocole (documenté dans le rapport) :
- MÊMES graphes pour tous les algorithmes : un graphe par (n, densité), généré une fois avec une graine fixe ;
- la génération, la construction des structures et l'affichage sont EXCLUS : on chronomètre
  uniquement l'appel de l'algorithme (`time.perf_counter`), traceur désactivé ;
- ≥ 5 répétitions, on rapporte moyenne ± écart-type ;
- Floyd–Warshall uniquement pour n ≤ 400 (O(V³) en temps, O(V²) en mémoire).
"""

from __future__ import annotations

import csv
import math
import os
import statistics
import time
from collections.abc import Callable

from novapolis.algorithms.mst import kruskal, prim
from novapolis.algorithms.shortest_paths import bellman_ford, dijkstra, floyd_warshall
from novapolis.algorithms.traversal import bfs, dfs
from novapolis.generator import DENSITES, generate, preset_params
from novapolis.graph.digraph import build_road_graph
from novapolis.graph.ugraph import build_fibre_graph

ALGOS = ["bfs", "dfs", "kruskal", "prim", "dijkstra", "bellman_ford", "floyd_warshall"]
NOMS = {
    "bfs": "BFS",
    "dfs": "DFS",
    "kruskal": "Kruskal",
    "prim": "Prim",
    "dijkstra": "Dijkstra",
    "bellman_ford": "Bellman–Ford",
    "floyd_warshall": "Floyd–Warshall",
}
COMPLEXITE = {
    "bfs": "O(V + E)",
    "dfs": "O(V + E)",
    "kruskal": "O(E log E)",
    "prim": "O(E log V)",
    "dijkstra": "O((V + E) log V)",
    "bellman_ford": "O(V·E)",
    "floyd_warshall": "O(V³)",
}
FLOYD_TAILLES = (50, 100, 200, 300, 400)
COLONNES = ["algo", "n", "densite", "degre_moyen", "V", "E", "reps", "moyenne_ms", "ecart_type_ms", "min_ms", "max_ms", "passes", "graine"]


def theorique(algo: str, V: int, E: int) -> float:
    """Valeur de la fonction de complexité f(V, E) (sans constante)."""
    lg = lambda x: math.log2(max(x, 2))  # noqa: E731
    return {
        "bfs": V + E,
        "dfs": V + E,
        "kruskal": E * lg(E),
        "prim": E * lg(V),
        "dijkstra": (V + E) * lg(V),
        "bellman_ford": V * E,
        "floyd_warshall": V**3,
    }[algo]


def bench_graph(n: int, densite: str, graine: int):
    """Graphe de benchmark (même générateur que les jeux data/generes)."""
    degre = DENSITES[densite] if densite in DENSITES else float(densite)
    p = preset_params("benchmark", nom=f"bench_n{n}", n_sites=n, degre_moyen=degre, graine=graine, demandes=0, scenarios=[])
    ds = generate(p)
    return build_road_graph(ds, "normal"), build_fibre_graph(ds), degre


def _mesurer(f: Callable, reps: int) -> list[float]:
    temps = []
    for _ in range(reps):
        t0 = time.perf_counter()
        f()
        temps.append((time.perf_counter() - t0) * 1000)
    return temps


def run_bench(
    tailles: list[int],
    densites: list[str],
    reps: int = 5,
    graine: int = 42,
    algos: list[str] | None = None,
    floyd_tailles: tuple[int, ...] = FLOYD_TAILLES,
    progres: Callable[[dict], None] | None = None,
) -> list[dict]:
    reps = max(5, int(reps))  # le sujet impose au moins 5 répétitions
    algos = algos or ALGOS
    taches: list[tuple[int, str, str]] = []
    for n in tailles:
        for d in densites:
            for a in algos:
                if a != "floyd_warshall":
                    taches.append((n, d, a))
    if "floyd_warshall" in algos:
        for n in floyd_tailles:
            taches.append((n, "moyenne", "floyd_warshall"))
    lignes: list[dict] = []
    cache: dict[tuple[int, str], tuple] = {}
    for k, (n, d, a) in enumerate(taches):
        if (n, d) not in cache:
            cache.clear()  # un seul graphe en mémoire à la fois
            cache[(n, d)] = bench_graph(n, d, graine)
        g, ug, degre = cache[(n, d)]
        if a in ("kruskal", "prim"):
            f = (lambda: kruskal(ug)) if a == "kruskal" else (lambda: prim(ug))
            E = ug.m
        elif a == "floyd_warshall":
            f, E = (lambda: floyd_warshall(g)), g.m
        else:
            fn = {"bfs": bfs, "dfs": dfs, "dijkstra": dijkstra, "bellman_ford": bellman_ford}[a]
            source = g.n // 2  # sommet « central » de la numérotation (même source pour tous)
            f, E = (lambda fn=fn, s=source: fn(g, [s])), g.m
        temps = _mesurer(f, reps)
        passes = bellman_ford(g, [g.n // 2]).passes if a == "bellman_ford" else ""
        ligne = {
            "algo": a,
            "n": n,
            "densite": d,
            "degre_moyen": degre,
            "V": g.n,
            "E": E,
            "reps": reps,
            "moyenne_ms": statistics.mean(temps),
            "ecart_type_ms": statistics.stdev(temps) if len(temps) > 1 else 0.0,
            "min_ms": min(temps),
            "max_ms": max(temps),
            "passes": passes,
            "graine": graine,
        }
        lignes.append(ligne)
        if progres:
            progres({"fait": k + 1, "total": len(taches), "ligne": ligne})
    return lignes


def write_csv(lignes: list[dict], chemin: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    with open(chemin, "w", encoding="utf-8", newline="\n") as f:
        w = csv.DictWriter(f, fieldnames=COLONNES, lineterminator="\n")
        w.writeheader()
        for ligne in lignes:
            w.writerow({k: (f"{v:.4f}" if isinstance(v, float) else v) for k, v in ligne.items()})


def read_csv(chemin: str) -> list[dict]:
    with open(chemin, encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    for r in lignes:
        for k in ("n", "V", "E", "reps", "graine"):
            r[k] = int(r[k])
        r["passes"] = int(r["passes"]) if r.get("passes") else None
        for k in ("degre_moyen", "moyenne_ms", "ecart_type_ms", "min_ms", "max_ms"):
            r[k] = float(r[k])
    return lignes


def analyse(lignes: list[dict]) -> list[dict]:
    """Pente log-log mesurée vs théorique et constante ajustée c (t ≈ c · f(V, E)), par algorithme.

    On utilise la densité « moyenne » (ou la seule disponible) pour isoler l'effet de n.
    """
    resultats = []
    for a in ALGOS:
        pts = [r for r in lignes if r["algo"] == a]
        dens = {r["densite"] for r in pts}
        ref = "moyenne" if "moyenne" in dens else (sorted(dens)[0] if dens else None)
        pts = sorted((r for r in pts if r["densite"] == ref), key=lambda r: r["n"])
        if len(pts) < 2:
            continue
        xs = [math.log(r["V"]) for r in pts]
        ys = [math.log(max(r["moyenne_ms"], 1e-6)) for r in pts]
        fs = [math.log(theorique(a, r["V"], r["E"])) for r in pts]
        pente = _pente(xs, ys)
        pente_th = _pente(xs, fs)
        f_vals = [theorique(a, r["V"], r["E"]) for r in pts]
        c = sum(r["moyenne_ms"] * f for r, f in zip(pts, f_vals)) / sum(f * f for f in f_vals)
        resultats.append(
            {
                "algo": a,
                "nom": NOMS[a],
                "complexite": COMPLEXITE[a],
                "densite": ref,
                "pente_mesuree": pente,
                "pente_theorique": pente_th,
                "constante_ms": c,
                "points": [{"n": r["n"], "V": r["V"], "E": r["E"], "mesure": r["moyenne_ms"], "theorie": c * f} for r, f in zip(pts, f_vals)],
            }
        )
    return resultats


def _pente(xs: list[float], ys: list[float]) -> float:
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    return num / den if den else 0.0


def commentaire(a: dict) -> str:
    """Commentaire automatique : pente mesurée vs théorique."""
    ecart = a["pente_mesuree"] - a["pente_theorique"]
    base = f"{a['nom']} : pente mesurée {a['pente_mesuree']:.2f} vs {a['pente_theorique']:.2f} attendue pour {a['complexite']}."
    if a["algo"] == "bellman_ford" and ecart < -0.3:
        return base + " Nettement sous V·E : l'arrêt anticipé stoppe dès qu'une passe ne change rien (≈ diamètre du graphe passes, pas |V|−1)."
    if abs(ecart) <= 0.15:
        return base + " Accord très bon avec la théorie."
    if ecart > 0:
        return base + " Légèrement au-dessus : défauts de cache, allocations d'objets Python et ramasse-miettes pèsent davantage sur les grands graphes."
    return base + " Légèrement en dessous : les coûts fixes (appels, initialisation) dominent aux petites tailles, ce qui aplatit la courbe."
