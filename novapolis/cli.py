"""Interface en ligne de commande (Typer + Rich) : un fichier, un scénario, une opération.

Exemples (voir README) :
  novapolis validate --data data/novapolis
  novapolis route --data data/novapolis --demande D-02 --algo all --scenario fermeture_axe
"""

from __future__ import annotations

import csv
import json
import os
import sys

import typer
from rich.console import Console
from rich.table import Table

from novapolis import services as S

for flux in (sys.stdout, sys.stderr):
    try:
        flux.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

app = typer.Typer(add_completion=False, help="Novapolis Résilience — diagnostic de réseaux urbains (projet EFREI).", no_args_is_help=True)
console = Console()

DATA = typer.Option("data/novapolis", "--data", "-d", help="Dossier du jeu de données (ou son identifiant)")
SCEN = typer.Option("normal", "--scenario", "-s", help="Scénario déclaré dans scenarios.csv")
PER = typer.Option(None, "--periode", "-p", help="Impose la période (normal | pointe) avant ET après")
EXPORT = typer.Option(None, "--export", "-o", help="Fichier de sortie .csv ou .json")


# --- affichage ---------------------------------------------------------------------------------


def f(x, nd: int = 2) -> str:
    """Formate une valeur : infinis en ∞ (jamais un grand nombre fini), None en « — »."""
    if x is None:
        return "—"
    if x == "+inf":
        return "+∞"
    if x == "-inf":
        return "−∞"
    if isinstance(x, float):
        return f"{x:.{nd}f}"
    return str(x)


def chemin_txt(ch: list[str] | None, maxi: int = 12) -> str:
    if not ch:
        return "—"
    if len(ch) > maxi:
        ch = ch[:5] + [f"… {len(ch) - 7} …"] + ch[-2:]
    return " → ".join(ch)


def exporter(chemin: str | None, objet, lignes: list[dict] | None = None) -> None:
    if not chemin:
        return
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    if chemin.endswith(".csv") and lignes is not None:
        cles: list[str] = []
        for ligne in lignes:
            for k in ligne:
                if k not in cles:
                    cles.append(k)
        with open(chemin, "w", encoding="utf-8", newline="\n") as fh:
            w = csv.DictWriter(fh, fieldnames=cles, lineterminator="\n")
            w.writeheader()
            for ligne in lignes:
                w.writerow({k: (" > ".join(v) if isinstance(v, list) and all(isinstance(e, str) for e in v) else (json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v)) for k, v in ligne.items()})
    else:
        with open(chemin, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(objet, fh, ensure_ascii=False, indent=2)
    console.print(f"[green]✓ Exporté :[/] {chemin}")


def entete(titre: str, data: str, scenario: str | None = None) -> None:
    ds = S.load(data)
    badge = " [magenta]SYNTHÉTIQUE[/]" if ds.synthetique else ""
    scen = f" · scénario [bold]{scenario}[/]" if scenario else ""
    console.rule(f"[bold]{titre}[/] · {ds.nom}{badge}{scen}")


def hash_ok(r: dict) -> None:
    if "hash_avant" in r:
        ok = "[green]✓ Base inchangée[/]" if r["base_inchangee"] else "[red]✗ BASE MODIFIÉE[/]"
        console.print(f"sha256 base avant {r['hash_avant'][:12]}… = après {r['hash_apres'][:12]}… {ok}")


# --- commandes -----------------------------------------------------------------------------------


@app.command()
def validate(data: str = DATA, export: str = EXPORT):
    """Valide les CSV (erreurs/avertissements avec fichier, ligne, colonne)."""
    from novapolis.io.reader import parse_texts, read_texts
    from novapolis.io.validator import validate_tables

    chemin = S.dataset_path(data)
    textes, meta = read_texts(chemin)
    rep = validate_tables(parse_texts(textes), meta)
    console.rule(f"[bold]Validation[/] · {chemin}")
    t = Table("Fichier", "Lignes")
    for k, v in rep.stats.items():
        t.add_row(k, str(v))
    console.print(t)
    if rep.errors or rep.warnings:
        t = Table("Gravité", "Fichier", "Ligne", "Colonne", "Message")
        for e in rep.errors + rep.warnings:
            couleur = "red" if e["gravite"] == "erreur" else "yellow"
            t.add_row(f"[{couleur}]{e['gravite']}[/]", e["fichier"], str(e["ligne"] or ""), e["colonne"], e["message"])
        console.print(t)
    console.print(f"[{'green' if rep.ok else 'red'}]{len(rep.errors)} erreur(s)[/], [yellow]{len(rep.warnings)} avertissement(s)[/]")
    exporter(export, rep.to_dict(), rep.errors + rep.warnings)
    raise typer.Exit(0 if rep.ok else 1)


@app.command()
def access(
    data: str = DATA,
    sources: str = typer.Option("casernes", help="casernes | hopitaux | casernes,hopitaux | liste d'ids"),
    mode: str = typer.Option("reach", help="reach (depuis sources) | weak (connexité faible) | scc (forte)"),
    algo: str = typer.Option("bfs", help="bfs | dfs"),
    seuil: float = typer.Option(10.0, "--seuil", "-T", help="Seuil T (minutes) depuis caserne ou hôpital"),
    scenario: str = SCEN,
    periode: str = PER,
    export: str = EXPORT,
):
    """Module 1 : accessibilité, connexité faible / forte, sites isolés, seuil T."""
    entete("M1 · Accessibilité", data, scenario)
    r = S.m1_access(data, sources, scenario, periode, algo, False, seuil)
    console.print(f"Sources : {', '.join(r['sources'])} · parcours {algo.upper()} · {f(r['temps_ms'][algo], 3)} ms")
    t = Table("Indicateur", "Valeur", "Notion")
    t.add_row("Sites atteignables depuis les sources", f"{r['atteignables']} / {r['total']}", "accessibilité (orienté)")
    t.add_row("Composantes faiblement connexes", str(r["nb_faible"]), "connexité faible")
    t.add_row("Composantes fortement connexes", f"{r['nb_scc']} (max {r['plus_grande_scc']})", "connexité forte (Tarjan)")
    t.add_row("Composantes du réseau de fibre", str(r["nb_fibre"]), "connexité (non orienté)")
    t.add_row("Circuit orienté", chemin_txt(r["cycle"]) if r["cycle"] else "aucun (graphe acyclique)", "DFS 3 couleurs")
    t.add_row("Sites isolés (degré 0)", ", ".join(r["isoles"]) or "aucun", "")
    t.add_row("Non atteignables (casernes + hôpitaux)", ", ".join(r["non_atteignables_secours"]) or "aucun", "")
    t.add_row(f"Quartiers au-delà de {f(seuil, 0)} min", str(len(r["hors_delai"])), "Dijkstra multi-source")
    console.print(t)
    if mode == "scc":
        t = Table("#", "Taille", "Sommets")
        for k, c in enumerate(r["scc"][:15]):
            t.add_row(str(k + 1), str(len(c)), chemin_txt(c).replace(" → ", ", "))
        console.print(t)
    elif mode == "weak":
        t = Table("#", "Taille", "Sommets")
        for k, c in enumerate(r["faible"][:15]):
            t.add_row(str(k + 1), str(len(c)), chemin_txt(c).replace(" → ", ", "))
        console.print(t)
    else:
        console.print(f"Ordre de visite : {chemin_txt(r['ordre'], 20).replace(' → ', ', ')}")
        if r["non_atteignables"]:
            console.print(f"[red]Non atteignables depuis les sources :[/] {', '.join(r['non_atteignables'][:30])}")
    if r["hors_delai"]:
        console.print("Hors délai : " + ", ".join(f"{h['id']} ({f(h['temps'], 1)})" for h in r["hors_delai"][:20]))
    exporter(export, r, [{"site": k, "niveau": v, "scc": r["scc_index"][k], "faible": r["faible_index"][k], "fibre": r["fibre_index"][k], "temps_secours": r["temps_secours"][k]} for k, v in r["niveau"].items()])


@app.command()
def minhop(data: str = DATA, u: str = typer.Option(..., "--from"), v: str = typer.Option(..., "--to"), scenario: str = SCEN, periode: str = PER, export: str = EXPORT):
    """Module 1 : itinéraire minimisant le nombre d'arcs (BFS) vs le plus rapide (Dijkstra)."""
    entete("M1 · Chemin minimal en arcs", data, scenario)
    r = S.m1_minhop(data, u, v, scenario, periode)
    console.print(f"BFS      : {chemin_txt(r['chemin'])}  ([bold]{f(r['arcs'])} arcs[/], {f(r['duree'], 1)} min)")
    console.print(f"Dijkstra : {chemin_txt(r['chemin_plus_rapide'])}  ({f(r['duree_plus_rapide'], 1)} min)")
    exporter(export, r)


@app.command()
def cycles(data: str = DATA, scenario: str = SCEN, periode: str = PER, export: str = EXPORT):
    """Module 1 : détection d'un circuit orienté (DFS blanc/gris/noir)."""
    entete("M1 · Circuits orientés", data, scenario)
    r = S.m1_cycles(data, scenario, periode)
    if r["cycle"]:
        console.print(f"[yellow]Circuit trouvé[/] : {chemin_txt(r['cycle'], 30)} ({len(r['cycle']) - 1} arcs)")
        if len(r["cycle"]) == 3:
            console.print("[dim]Remarque : une rue à double sens u ↔ v forme déjà un circuit de longueur 2.[/]")
    else:
        console.print("[green]Aucun circuit : le graphe est acyclique[/]")
    exporter(export, r)


@app.command()
def route(data: str = DATA, demande: str = typer.Option(..., help="Identifiant de la demande"), algo: str = typer.Option("all", help="dijkstra | bellman_ford | floyd | all"), scenario: str = SCEN, periode: str = PER, export: str = EXPORT):
    """Module 2 : itinéraire d'une demande, comparaison des algorithmes, avant / après."""
    entete("M2 · Itinéraire de secours", data, scenario)
    algo = "floyd_warshall" if algo == "floyd" else algo.replace("-", "_")
    r = S.m2_route(data, demande, algo, scenario, periode)
    d = r["demande"]
    console.print(f"Demande [bold]{d['id']}[/] · {d['type']} · P{d['priorite']} · site {d['origine']}")
    t = Table("Algorithme", "Distance (min)", "Arcs", "Caserne", "Temps (ms)", "Chemin")
    for a in r["algos"]:
        if a.get("ignore"):
            t.add_row(a["algo"], "—", "—", "—", "—", a["raison"])
            continue
        t.add_row(a["algo"], f(a["dist"]), f(a["arcs"]), f(a["caserne"]), f(a["temps_ms"], 3), chemin_txt(a["chemin"]))
    console.print(t)
    console.print("[green]✓ Distances identiques[/]" if r["identiques"] else "[red]✗ Distances différentes[/]")
    aa = r["avant_apres"]
    console.print(f"Avant {f(aa['avant'])} min → après {f(aa['apres'])} min · retard {f(aa['retard'])} min ({f(aa['retard_pct'], 1)} %) · [bold]{aa['statut']}[/]")
    if aa["fermetures_sur_chemin_initial"]:
        console.print(f"[red]Fermetures sur le chemin initial[/] : {', '.join(aa['fermetures_sur_chemin_initial'])}")
    if aa["fermetures_proches"]:
        console.print(f"Fermetures à proximité du nouveau chemin : {', '.join(aa['fermetures_proches'])}")
    hash_ok(r)
    exporter(export, r, r["algos"])


@app.command()
def routes(data: str = DATA, scenario: str = SCEN, periode: str = PER, export: str = EXPORT):
    """Module 2 : toutes les demandes avant / après perturbation."""
    entete("M2 · Toutes les demandes", data, scenario)
    r = S.m2_routes(data, scenario, periode)
    t = Table("Demande", "P", "Site", "Caserne", "Avant", "Après", "Retard", "%", "Statut", "Chemin")
    for l in r["lignes"]:
        coul = "red" if l["statut"] == "inaccessible" else ("yellow" if (l["retard"] or 0) > 0 else "green")
        t.add_row(l["demande"], str(l["priorite"]), l["site"], f(l["caserne_apres"]), f(l["avant"]), f(l["apres"]), f(l["retard"]), f(l["retard_pct"], 1), f"[{coul}]{l['statut']}[/]", chemin_txt(l["chemin"], 6))
    console.print(t)
    s = r["resume"]
    console.print(f"{s['accessibles']}/{s['demandes']} accessibles · retard moyen {f(s['retard_moyen'])} min · max {f(s['retard_max'])} min")
    hash_ok(r)
    exporter(export, r, r["lignes"])


@app.command()
def negcycle(data: str = typer.Option("data/negatif_accessible", "--data", "-d"), source: str = typer.Option("S"), algo: str = typer.Option("all", help="bellman-ford | floyd | all"), export: str = EXPORT):
    """Module 3 : circuits absorbants (jeux de test à poids négatifs)."""
    entete("M3 · Circuits absorbants", data)
    console.print("[yellow]⚠ Poids négatifs ARTIFICIELS : ce ne sont pas des durées physiques.[/]")
    algo = {"bellman-ford": "bellman_ford", "floyd": "floyd_warshall"}.get(algo, algo)
    r = S.m3_negcycle(data, source, algo)
    for res in r["resultats"]:
        coul = "red" if res["accessible"] else ("yellow" if res["existe"] else "green")
        console.print(f"[bold]{res['algo']}[/] · [{coul}]{res['message']}[/]")
        if res["cycle"]:
            console.print(f"  circuit : {' → '.join(res['cycle'])} · poids total {f(res['poids_cycle'], 0)}")
    t = Table("Sommet", *[x["algo"] for x in r["resultats"]], "Statut")
    for s in r["sommets"]:
        vals = [res["dist"][s] for res in r["resultats"]]
        statut = "diminuable à l'infini" if "-inf" in vals else ("non atteignable" if "+inf" in vals else "finie")
        t.add_row(s, *[f(v, 0) for v in vals], statut)
    console.print(t)
    exporter(export, r, [{"sommet": s, **{res["algo"]: res["dist"][s] for res in r["resultats"]}} for s in r["sommets"]])


@app.command()
def mst(data: str = DATA, algo: str = typer.Option("both", help="kruskal | prim | both"), scenario: str = SCEN, export: str = EXPORT):
    """Module 4 : arbre / forêt couvrant(e) minimal(e), Kruskal vs Prim, égalités."""
    entete("M4 · Réseau de fibre", data, scenario)
    r = S.m4_mst(data, algo, scenario)
    t = Table("Algorithme", "Coût (k€)", "Tronçons", "Composantes", "Temps (ms)")
    for a in ("kruskal", "prim"):
        if a in r:
            t.add_row(a, f(r[a]["cout"], 0), str(r[a]["nb_aretes"]), str(r[a]["composantes"]), f(r[a]["temps_ms"], 3))
    console.print(t)
    if "cout_identique" in r:
        console.print("[green]✓ Coût identique[/]" if r["cout_identique"] else "[red]✗ Coûts différents[/]", "· mêmes tronçons" if r["meme_ensemble"] else f"· {len(r['diff_kruskal'])} tronçon(s) différent(s) (égalités de coût)")
        for a, b in zip(r["diff_kruskal"], r["diff_prim"]):
            console.print(f"  Kruskal {a['label']} ({f(a['cost'], 0)}) ↔ Prim {b['label']} ({f(b['cost'], 0)})")
    ech = r["egalites"]["echange"]
    if ech:
        console.print(f"Plusieurs ACM : remplacer {ech['retirer']['label']} par {ech['ajouter']['label']} (même coût {f(ech['cout'], 0)} k€) donne un autre arbre de même coût.")
    else:
        console.print("ACM unique (aucun échange de même coût).")
    if r["non_raccordes"]:
        console.print(f"[yellow]Composantes non raccordées[/] : {'; '.join(', '.join(c[:8]) for c in r['non_raccordes'][:10])}")
    ref = r.get("kruskal") or r.get("prim")
    exporter(export, r, ref["aretes"])


@app.command("mst-panne")
def mst_panne(data: str = DATA, edge: str = typer.Option(..., help="Tronçon de l'ACM « U-V »"), algo: str = typer.Option("kruskal"), export: str = EXPORT):
    """Module 4 : panne d'un tronçon de l'ACM et raccordement le moins coûteux."""
    entete("M4 · Étude de panne", data)
    r = S.m4_panne(data, edge, algo)
    console.print(f"Tronçon coupé : [red]{r['coupee']['label']}[/] ({f(r['coupee']['cost'], 0)} k€)")
    console.print(f"Composantes : {len(r['composante_u'])} et {len(r['composante_v'])} sites")
    if r["reconnecte"]:
        console.print(f"Raccordement : [green]{r['raccordement']['label']}[/] ({f(r['raccordement']['cost'], 0)} k€)")
    else:
        console.print("[red]Aucun raccordement disponible : le réseau reste coupé[/]")
    console.print(f"Coût {f(r['cout_initial'], 0)} → {f(r['nouveau_cout'], 0)} k€ (Δ {f(r['delta'], 0)} k€)")
    exporter(export, r)


@app.command()
def scenarios(data: str = DATA, all_: bool = typer.Option(True, "--all/--some"), noms: str = typer.Option(None, "--noms", help="liste séparée par des virgules"), periode: str = PER, export: str = EXPORT):
    """Module 5 : les 5 indicateurs de résilience pour chaque scénario."""
    entete("M5 · Scénarios & résilience", data)
    r = S.m5_scenarios(data, noms.split(",") if noms else None, periode)
    lignes = r["scenarios"]
    t = Table("Indicateur", *[l["scenario"] for l in lignes])
    t.add_row("Demandes devenues inaccessibles", *[str(l["demandes_devenues_inaccessibles"]) for l in lignes])
    t.add_row("Demandes inaccessibles (total)", *[str(l["demandes_inaccessibles"]) for l in lignes])
    t.add_row("Hausse moyenne (min)", *[f(l["hausse_moyenne"]) for l in lignes])
    t.add_row("Hausse maximale (min)", *[f(l["hausse_max"]) for l in lignes])
    t.add_row("Composantes fibre (avant réparation)", *[str(l["composantes_fibre_avant_reparation"]) for l in lignes])
    t.add_row("Composantes fibre (après)", *[str(l["composantes_fibre"]) for l in lignes])
    t.add_row("Coût de raccordement (k€)", *[f(l["cout_reparation"], 0) for l in lignes])
    t.add_row("Sites sensibles accessibles (%)", *[f(l["part_sensibles_accessibles"], 1) for l in lignes])
    console.print(t)
    ok = "[green]✓ Base de référence inchangée[/]" if r["base_inchangee"] else "[red]✗ base modifiée[/]"
    console.print(f"sha256 fichiers avant {r['hash_fichiers_avant'][:12]}… = après {r['hash_fichiers_apres'][:12]}… {ok}")
    exporter(export, r, [{k: v for k, v in l.items() if k != "diff"} for l in lignes])


@app.command()
def generate(
    preset: str = typer.Option("realiste", help="mini | realiste | benchmark | test_m3_a | test_m3_b"),
    n: int = typer.Option(None, "--n", help="Nombre de sites"),
    density: float = typer.Option(None, "--density", help="Densité : degré moyen = densité × (n − 1)"),
    seed: int = typer.Option(None, "--seed", help="Graine aléatoire"),
    params: str = typer.Option(None, "--params", help="Fichier JSON de paramètres (comme l'UI)"),
    out: str = typer.Option(..., "--out", help="Dossier de sortie (ex. data/novapolis_s42)"),
    force: bool = typer.Option(False, "--force", help="Écraser un jeu existant"),
):
    """Génère un jeu de données synthétique reproductible (mêmes octets que l'UI)."""
    from novapolis.generator import cli_command, preset_params
    from novapolis.generator import generate as gen
    from novapolis.io.writer import write_dataset

    valeurs = {}
    if params:
        with open(params, encoding="utf-8") as fh:
            valeurs = json.load(fh)
        preset = valeurs.pop("preset", preset)
    valeurs.update({"n_sites": n, "densite": density, "graine": seed, "nom": os.path.basename(os.path.normpath(out))})
    p = preset_params(preset, **valeurs)
    ds = gen(p)
    textes = write_dataset(ds, out, ecraser=force)
    console.print(f"[green]✓ Jeu « {ds.nom} » écrit dans {out}[/] ({len(ds.sites)} sites, {len(ds.routes)} arcs, {len(ds.fibre)} tronçons, {len(ds.demandes)} demandes)")
    console.print(f"sha256 base : {json.loads(textes['meta.json'])['sha256_base']}")
    console.print(f"[dim]Commande équivalente : {cli_command(p)}[/]")


@app.command()
def data(force: bool = typer.Option(True, "--force/--no-force"), racine: str = typer.Option("data")):
    """Régénère tous les jeux livrés (mini, tests M3, novapolis, generes/n1000…n5000)."""
    from novapolis.generator import generate as gen
    from novapolis.generator import standard_datasets
    from novapolis.io.writer import write_dataset

    for sous, p in standard_datasets():
        ds = gen(p)
        write_dataset(ds, os.path.join(racine, sous), ecraser=force)
        console.print(f"[green]✓[/] {sous:<28} {len(ds.sites):>5} sites · {len(ds.routes):>6} arcs · graine {p.graine}")


@app.command()
def bench(
    sizes: str = typer.Option("250,500,1000,2000,5000"),
    densities: str = typer.Option("faible,moyenne,forte"),
    reps: int = typer.Option(5),
    seed: int = typer.Option(42),
    algos: str = typer.Option(None, help="Liste d'algorithmes (défaut : tous)"),
    out: str = typer.Option("reports/bench.csv"),
):
    """Benchmarks (≥ 5 répétitions, graines fixes) → CSV pour make_figures.py."""
    from rich.progress import Progress

    from novapolis.bench import analyse, commentaire, run_bench, write_csv

    tailles = [int(x) for x in sizes.split(",") if x]
    with Progress(console=console) as prog:
        tache = prog.add_task("Mesures", total=None)

        def cb(ev):
            prog.update(tache, total=ev["total"], completed=ev["fait"], description=f"{ev['ligne']['algo']} n={ev['ligne']['n']} {ev['ligne']['densite']}")

        lignes = run_bench(tailles, densities.split(","), reps, seed, algos.split(",") if algos else None, progres=cb)
    write_csv(lignes, out)
    t = Table("Algorithme", "n", "Densité", "E", "Moyenne (ms)", "± écart-type")
    for l in lignes:
        t.add_row(l["algo"], str(l["n"]), l["densite"], str(l["E"]), f(l["moyenne_ms"], 3), f(l["ecart_type_ms"], 3))
    console.print(t)
    for a in analyse(lignes):
        console.print("• " + commentaire(a))
    console.print(f"[green]✓ {out}[/]")


@app.command()
def serve(host: str = "127.0.0.1", port: int = 8000, reload: bool = False):
    """Démarre l'API FastAPI (utilisée par l'interface graphique)."""
    import uvicorn

    uvicorn.run("novapolis.api.main:app", host=host, port=port, reload=reload)


def main():
    app()


if __name__ == "__main__":
    main()
