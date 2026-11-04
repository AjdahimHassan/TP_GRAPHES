"""Génère les figures du rapport à partir du CSV de benchmarks.

Usage : python scripts/make_figures.py reports/bench.csv [--out reports/figures]
Figures produites (PNG, 150 dpi) :
  fig1_loglog_temps_vs_n.png     temps vs n (log-log), mesure + complexité théorique ajustée (pointillés)
  fig2_temps_vs_densite.png      temps vs degré moyen à n fixé
  fig3_floyd_warshall.png        Floyd–Warshall (petits n) + courbe c·V³
  fig4_mesure_sur_theorie.png    rapport mesure / théorie (constante ajustée) en fonction de n
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from novapolis.bench import ALGOS, NOMS, analyse, read_csv, theorique  # noqa: E402

COULEURS = {
    "bfs": "#3DDC97",
    "dfs": "#7C8CFF",
    "kruskal": "#2EE6D6",
    "prim": "#A78BFA",
    "dijkstra": "#FFB547",
    "bellman_ford": "#FF5468",
    "floyd_warshall": "#FF9F43",
}


def _style(ax, titre, xl, yl):
    ax.set_title(titre, fontsize=12, fontweight="bold")
    ax.set_xlabel(xl)
    ax.set_ylabel(yl)
    ax.grid(True, which="both", alpha=0.25)
    ax.legend(fontsize=8, frameon=False)


def main(argv=None) -> list[str]:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", default="reports/bench.csv")
    ap.add_argument("--out", default="reports/figures")
    args = ap.parse_args(argv)
    lignes = read_csv(args.csv)
    os.makedirs(args.out, exist_ok=True)
    produits = []
    res = {a["algo"]: a for a in analyse(lignes)}

    # Figure 1 : log-log temps vs n
    fig, ax = plt.subplots(figsize=(8, 5))
    for a in ALGOS:
        if a == "floyd_warshall" or a not in res:
            continue
        pts = res[a]["points"]
        xs = [p["V"] for p in pts]
        ax.errorbar(
            xs,
            [p["mesure"] for p in pts],
            yerr=[next(r["ecart_type_ms"] for r in lignes if r["algo"] == a and r["V"] == p["V"] and r["densite"] == res[a]["densite"]) for p in pts],
            marker="o",
            color=COULEURS[a],
            label=f"{NOMS[a]} (pente {res[a]['pente_mesuree']:.2f})",
            capsize=3,
        )
        ax.plot(xs, [p["theorie"] for p in pts], "--", color=COULEURS[a], alpha=0.6)
    ax.set_xscale("log")
    ax.set_yscale("log")
    _style(ax, "Temps d'exécution vs taille (densité moyenne, moyenne de 5 répétitions)", "nombre de sommets |V| (échelle log)", "temps (ms, échelle log)")
    ax.text(0.01, -0.16, "trait plein = mesure ± écart-type · pointillés = c·f(V,E) ajustée", transform=ax.transAxes, fontsize=8, color="#555")
    chemin = os.path.join(args.out, "fig1_loglog_temps_vs_n.png")
    fig.tight_layout()
    fig.savefig(chemin, dpi=150)
    plt.close(fig)
    produits.append(chemin)

    # Figure 2 : temps vs densité à n fixé (plus grand n disponible avec ≥ 2 densités)
    candidats = sorted({r["n"] for r in lignes if r["algo"] != "floyd_warshall"})
    n_ref = None
    for n in reversed(candidats):
        if len({r["densite"] for r in lignes if r["n"] == n and r["algo"] != "floyd_warshall"}) >= 2:
            n_ref = n
            break
    if n_ref:
        fig, ax = plt.subplots(figsize=(8, 5))
        for a in ALGOS:
            pts = sorted((r for r in lignes if r["algo"] == a and r["n"] == n_ref), key=lambda r: r["degre_moyen"])
            if len(pts) < 2:
                continue
            ax.errorbar([p["degre_moyen"] for p in pts], [p["moyenne_ms"] for p in pts], yerr=[p["ecart_type_ms"] for p in pts], marker="o", color=COULEURS[a], label=NOMS[a], capsize=3)
        ax.set_yscale("log")
        _style(ax, f"Temps vs densité (n = {n_ref})", "degré moyen visé (faible = 3, moyenne = 6, forte = 12)", "temps (ms, échelle log)")
        chemin = os.path.join(args.out, "fig2_temps_vs_densite.png")
        fig.tight_layout()
        fig.savefig(chemin, dpi=150)
        plt.close(fig)
        produits.append(chemin)

    # Figure 3 : Floyd–Warshall
    fw = sorted((r for r in lignes if r["algo"] == "floyd_warshall"), key=lambda r: r["n"])
    if fw:
        fig, ax = plt.subplots(figsize=(7, 4.5))
        ax.bar([str(r["V"]) for r in fw], [r["moyenne_ms"] / 1000 for r in fw], yerr=[r["ecart_type_ms"] / 1000 for r in fw], color=COULEURS["floyd_warshall"], label="mesure (moyenne ± écart-type)", capsize=3)
        c = sum(r["moyenne_ms"] * r["V"] ** 3 for r in fw) / sum(r["V"] ** 6 for r in fw)
        ax.plot([str(r["V"]) for r in fw], [c * r["V"] ** 3 / 1000 for r in fw], "--o", color="#B8860B", label=f"c·V³ (c = {c:.2e} ms)")
        _style(ax, "Floyd–Warshall · O(V³) — réservé aux petits graphes", "nombre de sommets |V|", "temps (s)")
        est = c * 5000**3 / 1000 / 60
        ax.text(0.01, 0.92, f"extrapolation n = 5000 : ≈ {est:.0f} min et {5000 * 5000 * 8 / 1e6:.0f} Mo de matrice", transform=ax.transAxes, fontsize=8)
        chemin = os.path.join(args.out, "fig3_floyd_warshall.png")
        fig.tight_layout()
        fig.savefig(chemin, dpi=150)
        plt.close(fig)
        produits.append(chemin)

    # Figure 4 : mesure / théorie
    fig, ax = plt.subplots(figsize=(8, 5))
    for a, r in res.items():
        pts = r["points"]
        ax.plot([p["V"] for p in pts], [p["mesure"] / theorique(a, p["V"], p["E"]) * 1e6 for p in pts], "-o", color=COULEURS[a], label=NOMS[a])
    ax.set_xscale("log")
    ax.set_yscale("log")
    _style(ax, "Constante mesurée t / f(V,E) — horizontale si la théorie est respectée", "nombre de sommets |V|", "t / f(V,E) (ns par opération élémentaire)")
    chemin = os.path.join(args.out, "fig4_mesure_sur_theorie.png")
    fig.tight_layout()
    fig.savefig(chemin, dpi=150)
    plt.close(fig)
    produits.append(chemin)

    for p in produits:
        print(p)
    return produits


if __name__ == "__main__":
    main()
