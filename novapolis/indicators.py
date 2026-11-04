"""Module 2 (demandes) et Module 5 (indicateurs de résilience).

Choix de la caserne d'intervention : pour chaque demande, la caserne dont le temps de trajet vers
le site de l'incident est le plus faible. On l'obtient en UN SEUL Dijkstra multi-source lancé
depuis toutes les casernes (chaque sommet hérite de la source qui l'atteint le plus vite).

« Avant » = jeu de base sans perturbation ; « après » = copie modifiée par le scénario.
Période : « avant » en période normale et « après » dans la période du scénario, sauf si une période
est imposée (option --periode / sélecteur de l'UI), auquel cas elle s'applique aux deux.
"""

from __future__ import annotations

from novapolis.algorithms.mst import kruskal, repair_forest
from novapolis.algorithms.shortest_paths import INF, dijkstra, path_from_parent
from novapolis.algorithms.traversal import connected_components
from novapolis.algorithms.union_find import UnionFind
from novapolis.graph.digraph import build_road_graph
from novapolis.graph.scenario import ScenarioResult, apply_actions, apply_scenario
from novapolis.graph.ugraph import build_fibre_graph
from novapolis.io.writer import dataset_hash
from novapolis.model import SENSIBLE_TYPES, Dataset


def indices_par_type(ds: Dataset, types: tuple[str, ...]) -> list[int]:
    return [i for i, s in enumerate(ds.sites) if s.type in types]


def periodes(scen: ScenarioResult, periode_imposee: str | None) -> tuple[str, str]:
    if periode_imposee:
        return periode_imposee, periode_imposee
    return "normal", scen.periode


def _arcs_modifies(base: Dataset, scen: Dataset) -> tuple[set, set]:
    """Arcs (u, v) nouvellement fermés et nouvellement en travaux par le scénario."""
    fermes, travaux = set(), set()
    for a0, a1 in zip(base.routes, scen.routes):
        if a1.statut == "ferme" and a0.statut != "ferme":
            fermes.add((a1.u, a1.v))
        if a1.statut == "travaux" and a0.statut != "travaux":
            travaux.add((a1.u, a1.v))
    return fermes, travaux


def request_routes(base: Dataset, scen: ScenarioResult, periode_imposee: str | None = None) -> list[dict]:
    """Tableau avant/après pour toutes les demandes."""
    p0, p1 = periodes(scen, periode_imposee)
    g0 = build_road_graph(base, p0)
    g1 = build_road_graph(scen.dataset, p1)
    casernes = indices_par_type(base, ("caserne",))
    r0 = dijkstra(g0, casernes)
    r1 = dijkstra(g1, casernes)
    fermes, _ = _arcs_modifies(base, scen.dataset)
    ids = g0.ids
    lignes = []
    for d in base.demandes:
        t = g0.index[d.origine]
        avant, apres = r0.dist[t], r1.dist[t]
        ch0 = path_from_parent(r0.parent, t) if avant < INF else []
        ch1 = path_from_parent(r1.parent, t) if apres < INF else []
        arcs0 = {(ids[ch0[i]], ids[ch0[i + 1]]) for i in range(len(ch0) - 1)}
        noeuds1 = {ids[x] for x in ch1}
        sur_chemin = sorted(a for a in fermes if a in arcs0)
        proches = sorted(a for a in fermes if a[0] in noeuds1 or a[1] in noeuds1)
        retard = apres - avant if avant < INF and apres < INF else None
        relatif = (retard / avant * 100 if avant > 0 else 0.0) if retard is not None else None
        lignes.append(
            {
                "demande": d.id,
                "type": d.type,
                "priorite": d.priorite,
                "site": d.origine,
                "caserne_avant": ids[r0.origine[t]] if avant < INF else None,
                "caserne_apres": ids[r1.origine[t]] if apres < INF else None,
                "avant": avant,
                "apres": apres,
                "retard": retard,
                "retard_pct": relatif,
                "statut_avant": "accessible" if avant < INF else "inaccessible",
                "statut": "accessible" if apres < INF else "inaccessible",
                "chemin_avant": [ids[x] for x in ch0],
                "chemin": [ids[x] for x in ch1],
                "arcs": max(len(ch1) - 1, 0) if ch1 else None,
                "arcs_avant": max(len(ch0) - 1, 0) if ch0 else None,
                "fermetures_sur_chemin_initial": [f"{u}->{v}" for u, v in sur_chemin],
                "fermetures_proches": [f"{u}->{v}" for u, v in proches],
            }
        )
    return lignes


def sensitive_share(ds: Dataset, periode: str) -> tuple[float, int, int]:
    """Part des sites sensibles (hôpital, caserne, école, télécom) atteignables depuis une caserne."""
    g = build_road_graph(ds, periode)
    casernes = indices_par_type(ds, ("caserne",))
    r = dijkstra(g, casernes)
    sensibles = indices_par_type(ds, SENSIBLE_TYPES)
    ok = sum(1 for i in sensibles if r.dist[i] < INF)
    return (ok / len(sensibles) * 100 if sensibles else 100.0), ok, len(sensibles)


def fibre_indicators(base: Dataset, scen: Dataset) -> dict:
    """Composantes du réseau de fibre et coût de réparation après le scénario.

    On part de l'ACM du jeu de base ; les tronçons devenus indisponibles sont retirés ; on complète
    la forêt restante au moindre coût (raccordements) avec les tronçons encore disponibles.
    """
    ug0 = build_fibre_graph(base)
    mst0 = kruskal(ug0)
    ug1 = build_fibre_graph(scen)
    par_cle = {e.cle: i for i, e in enumerate(ug1.edges)}
    gardees = [par_cle[ug0.edges[e].cle] for e in mst0.aretes if ug0.edges[e].cle in par_cle]
    perdues = [ug0.edges[e].cle for e in mst0.aretes if ug0.edges[e].cle not in par_cle]
    uf = UnionFind(ug1.n)
    for eid in gardees:
        uf.union(ug1.edges[eid].u, ug1.edges[eid].v)
    ajoutees, cout = repair_forest(ug1, gardees)
    _, comps = connected_components(ug1)
    return {
        "cout_acm_base": mst0.cout,
        "troncons_perdus": [f"{scen.fibre[c].u}-{scen.fibre[c].v}" for c in perdues],
        "composantes_fibre_avant_reparation": uf.composantes,
        "composantes_fibre": len(comps),
        "cout_reparation": cout,
        "raccordements": [f"{ug1.ids[ug1.edges[e].u]}-{ug1.ids[ug1.edges[e].v]}" for e in ajoutees],
    }


def scenario_indicators(base: Dataset, nom: str, periode_imposee: str | None = None, actions=None) -> dict:
    """Les 5 indicateurs de résilience d'un scénario (calculés sur une copie).

    `actions` permet d'évaluer un scénario personnalisé non enregistré (constructeur de l'UI)."""
    empreinte_avant = dataset_hash(base)
    scen = apply_actions(base, actions, nom) if actions is not None else apply_scenario(base, nom)
    _, p1 = periodes(scen, periode_imposee)
    lignes = request_routes(base, scen, periode_imposee)
    retards = [r["retard"] for r in lignes if r["retard"] is not None]
    nouvelles = sum(1 for r in lignes if r["statut_avant"] == "accessible" and r["statut"] == "inaccessible")
    part, ok, total = sensitive_share(scen.dataset, p1)
    fib = fibre_indicators(base, scen.dataset)
    empreinte_apres = dataset_hash(base)
    return {
        "scenario": nom,
        "periode": p1,
        "demandes": len(lignes),
        "demandes_inaccessibles": sum(1 for r in lignes if r["statut"] == "inaccessible"),
        "demandes_devenues_inaccessibles": nouvelles,
        "hausse_moyenne": sum(retards) / len(retards) if retards else 0.0,
        "hausse_max": max(retards) if retards else 0.0,
        "composantes_fibre": fib["composantes_fibre"],
        "composantes_fibre_avant_reparation": fib["composantes_fibre_avant_reparation"],
        "cout_reparation": fib["cout_reparation"],
        "raccordements": fib["raccordements"],
        "troncons_perdus": fib["troncons_perdus"],
        "part_sensibles_accessibles": part,
        "sensibles_accessibles": ok,
        "sensibles_total": total,
        "nb_modifications": len(scen.diff),
        "diff": scen.diff,
        "hash_avant": empreinte_avant,
        "hash_apres": empreinte_apres,
        "base_inchangee": empreinte_avant == empreinte_apres,
    }
