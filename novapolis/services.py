"""Couche « services » : une fonction par opération, partagée par la CLI ET l'API.

C'est ce qui garantit que l'interface graphique et la ligne de commande affichent exactement
les mêmes nombres : elles appellent les mêmes fonctions, qui renvoient des dicts sérialisables.
Les infinis sont encodés en chaînes « +inf » / « -inf » (JSON ne connaît pas l'infini).
"""

from __future__ import annotations

import math
import os
import time

from novapolis.algorithms.mst import kruskal, prim, repair_after_failure, tie_analysis
from novapolis.algorithms.negative_cycles import negcycle_bellman_ford, negcycle_floyd
from novapolis.algorithms.shortest_paths import (
    INF,
    bellman_ford,
    dijkstra,
    floyd_multi_source,
    floyd_warshall,
    path_from_next,
    path_from_parent,
)
from novapolis.algorithms.trace import Tracer
from novapolis.algorithms.traversal import (
    bfs,
    connected_components,
    dfs,
    find_directed_cycle,
    isolated_sites,
    min_hop_path,
    tarjan_scc,
    weak_components,
)
from novapolis.graph.digraph import DiGraph, build_road_graph
from novapolis.graph.scenario import apply_scenario
from novapolis.graph.ugraph import UGraph, build_fibre_graph
from novapolis.indicators import indices_par_type, periodes, request_routes, scenario_indicators
from novapolis.io.reader import load_dataset
from novapolis.io.writer import dataset_hash, folder_hash
from novapolis.model import Dataset

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.environ.get("NOVAPOLIS_DATA", os.path.join(RACINE, "data"))
FLOYD_MAX_N = 400  # au-delà, Floyd–Warshall (O(V³) temps, O(V²) mémoire) est trop coûteux


# --- utilitaires --------------------------------------------------------------------------------


def clean(x):
    """Rend un objet sérialisable en JSON : infinis → « +inf »/« -inf », flottants arrondis."""
    if isinstance(x, float):
        if math.isinf(x):
            return "+inf" if x > 0 else "-inf"
        if math.isnan(x):
            return None
        return round(x, 6)
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    return x


def chrono(f, *args, **kwargs):
    """Exécute f et renvoie (résultat, durée en ms) — seul l'appel de l'algorithme est chronométré."""
    t0 = time.perf_counter()
    r = f(*args, **kwargs)
    return r, (time.perf_counter() - t0) * 1000


def list_datasets() -> list[dict]:
    """Jeux disponibles dans data/ (et data/generes/). L'identifiant est le nom du dossier."""
    jeux = []
    for base in (DATA_DIR, os.path.join(DATA_DIR, "generes")):
        if not os.path.isdir(base):
            continue
        for nom in sorted(os.listdir(base)):
            chemin = os.path.join(base, nom)
            if os.path.isfile(os.path.join(chemin, "sites.csv")):
                jeux.append({"id": nom, "chemin": chemin})
    return jeux


def dataset_path(ident: str) -> str:
    """Accepte un identifiant (« novapolis ») ou un chemin (« data/novapolis »)."""
    if os.path.isfile(os.path.join(ident, "sites.csv")):
        return ident
    for j in list_datasets():
        if j["id"] == ident:
            return j["chemin"]
    raise FileNotFoundError(f"Jeu de données introuvable : {ident}")


_CACHE: dict[str, tuple[str, Dataset]] = {}


def load(ident: str) -> Dataset:
    """Charge un jeu (avec cache invalidé si les fichiers changent sur disque)."""
    chemin = dataset_path(ident)
    h = folder_hash(chemin)
    if chemin in _CACHE and _CACHE[chemin][0] == h:
        return _CACHE[chemin][1]
    ds = load_dataset(chemin)
    _CACHE[chemin] = (h, ds)
    return ds


def resolve_sources(ds: Dataset, spec: str | list[str]) -> list[int]:
    """« casernes », « hopitaux », « casernes,hopitaux » ou une liste d'identifiants de sites."""
    morceaux = spec if isinstance(spec, list) else [s.strip() for s in spec.split(",") if s.strip()]
    index = {s.id: i for i, s in enumerate(ds.sites)}
    res: list[int] = []
    for m in morceaux:
        if m in ("casernes", "caserne"):
            res += indices_par_type(ds, ("caserne",))
        elif m in ("hopitaux", "hopital"):
            res += indices_par_type(ds, ("hopital",))
        elif m in index:
            res.append(index[m])
        else:
            raise ValueError(f"Source inconnue : {m}")
    vus, out = set(), []
    for i in res:
        if i not in vus:
            vus.add(i)
            out.append(i)
    return out


def _ctx(ds: Dataset, scenario: str, periode: str | None):
    scen = apply_scenario(ds, scenario)
    _, p = periodes(scen, periode)
    return scen, p, build_road_graph(scen.dataset, p)


def _hashes(ds: Dataset, avant: str) -> dict:
    apres = dataset_hash(ds)
    return {"hash_avant": avant, "hash_apres": apres, "base_inchangee": avant == apres}


# --- Graphe pour la carte ------------------------------------------------------------------------


def project(ds: Dataset) -> list[tuple[float, float]]:
    """Projection équirectangulaire locale lon/lat → km (x vers l'est, y vers le nord)."""
    if not ds.sites:
        return []
    lat0 = sum(s.latitude for s in ds.sites) / len(ds.sites)
    lon0 = sum(s.longitude for s in ds.sites) / len(ds.sites)
    k = math.cos(math.radians(lat0))
    return [((s.longitude - lon0) * 111.32 * k, (s.latitude - lat0) * 110.57) for s in ds.sites]


def decor(ds: Dataset) -> dict:
    """Éléments de décor de la carte (rivière du générateur), projetés comme les sites."""
    params = ds.meta.get("parametres") or {}
    if not params.get("riviere") or not ds.sites:
        return {}
    from novapolis.generator import RIVIERE, _lonlat

    lat0 = sum(s.latitude for s in ds.sites) / len(ds.sites)
    lon0 = sum(s.longitude for s in ds.sites) / len(ds.sites)
    k = math.cos(math.radians(lat0))
    pts = []
    for x, y in RIVIERE[::4] + [RIVIERE[-1]]:
        lon, lat = _lonlat((x, y))
        pts.append([round((lon - lon0) * 111.32 * k, 4), round((lat - lat0) * 110.57, 4)])
    return {"riviere": pts}


def graph_payload(ident: str, scenario: str = "normal", periode: str | None = None) -> dict:
    ds = load(ident)
    avant = dataset_hash(ds)
    scen = apply_scenario(ds, scenario)
    _, p = periodes(scen, periode)
    xy = project(ds)
    return clean(
        {
            "dataset": ident,
            "scenario": scenario,
            "periode": p,
            "synthetique": ds.synthetique,
            "allow_negative": ds.allow_negative,
            "meta": ds.meta,
            "sites": [
                {"id": s.id, "nom": s.nom, "type": s.type, "lon": s.longitude, "lat": s.latitude, "x": xy[i][0], "y": xy[i][1]}
                for i, s in enumerate(ds.sites)
            ],
            "routes": [
                {
                    "u": a.u,
                    "v": a.v,
                    "temps_normal": a.temps_normal,
                    "temps_pointe": a.temps_pointe,
                    "statut": a.statut,
                    "statut_base": b.statut,
                    "type_voie": a.type_voie,
                }
                for a, b in zip(scen.dataset.routes, ds.routes)
            ],
            "fibre": [
                {"u": t.u, "v": t.v, "cost": t.cost, "statut": t.statut, "statut_base": b.statut, "cle": i}
                for i, (t, b) in enumerate(zip(scen.dataset.fibre, ds.fibre))
            ],
            "demandes": [{"id": d.id, "origine": d.origine, "type": d.type, "priorite": d.priorite} for d in ds.demandes],
            "scenarios": ds.noms_scenarios(),
            "decor": decor(ds),
            "diff": scen.diff,
            **_hashes(ds, avant),
        }
    )


# --- Module 1 ------------------------------------------------------------------------------------


def m1_access(
    ident: str,
    sources: str | list[str] = "casernes",
    scenario: str = "normal",
    periode: str | None = None,
    algo: str = "bfs",
    trace: bool = False,
    seuil: float = 10.0,
) -> dict:
    ds = load(ident)
    avant = dataset_hash(ds)
    scen, p, g = _ctx(ds, scenario, periode)
    src = resolve_sources(ds, sources)
    tracer = Tracer() if trace else None
    parcours = bfs if algo == "bfs" else dfs
    res, t_parcours = chrono(parcours, g, src, tracer)
    ids = g.ids
    atteints = [i for i in range(g.n) if res.niveau[i] != -1]
    scc, t_scc = chrono(tarjan_scc, g)
    scc_index = [0] * g.n
    for k, c in enumerate(scc):
        for x in c:
            scc_index[x] = k
    weak_idx, weak = weak_components(g)
    ug = build_fibre_graph(scen.dataset)
    fib_idx, fib = connected_components(ug)
    cycle, t_cycle = chrono(find_directed_cycle, g)
    isoles = isolated_sites(g)
    # Seuil T : temps depuis la caserne OU l'hôpital le plus proche (Dijkstra multi-source)
    secours = indices_par_type(ds, ("caserne", "hopital"))
    rd, t_dij = chrono(dijkstra, g, secours)
    hors_delai = [
        {"id": ids[i], "temps": rd.dist[i]}
        for i, s in enumerate(ds.sites)
        if s.type == "quartier" and rd.dist[i] > seuil
    ]
    hors_delai.sort(key=lambda x: (-x["temps"], x["id"]))
    non_atteignables_secours = [ids[i] for i in range(g.n) if rd.dist[i] == INF]
    return clean(
        {
            "dataset": ident,
            "scenario": scenario,
            "periode": p,
            "algo": algo,
            "sources": [ids[s] for s in src],
            "ordre": [ids[i] for i in res.ordre],
            "niveau": {ids[i]: res.niveau[i] for i in range(g.n)},
            "parent": {ids[i]: (ids[res.parent[i]] if res.parent[i] != -1 else None) for i in range(g.n)},
            "atteignables": len(atteints),
            "total": g.n,
            "non_atteignables": [ids[i] for i in range(g.n) if res.niveau[i] == -1],
            "niveau_max": max((res.niveau[i] for i in atteints), default=0),
            "scc": [[ids[x] for x in c] for c in sorted(scc, key=lambda c: (-len(c), min(c)))],
            "scc_index": {ids[i]: scc_index[i] for i in range(g.n)},
            "nb_scc": len(scc),
            "plus_grande_scc": max((len(c) for c in scc), default=0),
            "faible": [[ids[x] for x in c] for c in weak],
            "faible_index": {ids[i]: weak_idx[i] for i in range(g.n)},
            "nb_faible": len(weak),
            "fibre_composantes": [[ids[x] for x in c] for c in fib],
            "fibre_index": {ids[i]: fib_idx[i] for i in range(g.n)},
            "nb_fibre": len(fib),
            "cycle": [ids[x] for x in cycle] if cycle else None,
            "isoles": [ids[i] for i in isoles],
            "non_atteignables_secours": non_atteignables_secours,
            "seuil": seuil,
            "temps_secours": {ids[i]: rd.dist[i] for i in range(g.n)},
            "hors_delai": hors_delai,
            "temps_ms": {algo: t_parcours, "tarjan": t_scc, "cycle": t_cycle, "dijkstra_seuil": t_dij},
            "trace": tracer.to_dict() if tracer else None,
            **_hashes(ds, avant),
        }
    )


def m1_minhop(ident: str, u: str, v: str, scenario: str = "normal", periode: str | None = None) -> dict:
    ds = load(ident)
    _, p, g = _ctx(ds, scenario, periode)
    s, t = g.index[u], g.index[v]
    chemin, ms = chrono(min_hop_path, g, s, t)
    rd = dijkstra(g, [s])
    ch_temps = path_from_parent(rd.parent, t) if rd.dist[t] < INF else []
    duree_hop = sum(g.weight(chemin[i], chemin[i + 1]) for i in range(len(chemin) - 1)) if chemin else None
    return clean(
        {
            "u": u,
            "v": v,
            "periode": p,
            "chemin": [g.ids[x] for x in chemin] if chemin else None,
            "arcs": len(chemin) - 1 if chemin else None,
            "duree": duree_hop,
            "chemin_plus_rapide": [g.ids[x] for x in ch_temps],
            "duree_plus_rapide": rd.dist[t],
            "temps_ms": ms,
        }
    )


def m1_cycles(ident: str, scenario: str = "normal", periode: str | None = None) -> dict:
    ds = load(ident)
    _, p, g = _ctx(ds, scenario, periode)
    cycle, ms = chrono(find_directed_cycle, g)
    return clean({"cycle": [g.ids[x] for x in cycle] if cycle else None, "acyclique": cycle is None, "temps_ms": ms})


# --- Module 2 ------------------------------------------------------------------------------------


def _algo_run(g: DiGraph, src: list[int], t: int, algo: str) -> dict:
    if algo == "dijkstra":
        r, ms = chrono(dijkstra, g, src)
        ch = path_from_parent(r.parent, t) if r.dist[t] < INF else []
        return {"algo": "dijkstra", "dist": r.dist[t], "chemin": [g.ids[x] for x in ch], "caserne": g.ids[r.origine[t]] if ch else None, "arcs": len(ch) - 1 if ch else None, "temps_ms": ms}
    if algo == "bellman_ford":
        r, ms = chrono(bellman_ford, g, src)
        ch = path_from_parent(r.parent, t) if r.dist[t] < INF else []
        return {"algo": "bellman_ford", "dist": r.dist[t], "chemin": [g.ids[x] for x in ch], "caserne": g.ids[r.origine[t]] if ch else None, "arcs": len(ch) - 1 if ch else None, "temps_ms": ms, "passes": r.passes}
    if g.n > FLOYD_MAX_N:
        return {"algo": "floyd_warshall", "ignore": True, "raison": f"n = {g.n} > {FLOYD_MAX_N} : O(V³) trop coûteux", "dist": None, "chemin": [], "arcs": None, "temps_ms": None}
    (d, suivant), ms = chrono(floyd_warshall, g)
    best, s = floyd_multi_source(d, src, t)
    ch = path_from_next(suivant, s, t) if best < INF else []
    return {"algo": "floyd_warshall", "dist": best, "chemin": [g.ids[x] for x in ch], "caserne": g.ids[s] if ch else None, "arcs": len(ch) - 1 if ch else None, "temps_ms": ms}


def m2_route(ident: str, demande: str, algo: str = "all", scenario: str = "normal", periode: str | None = None) -> dict:
    ds = load(ident)
    avant = dataset_hash(ds)
    scen, p, g = _ctx(ds, scenario, periode)
    dem = next((d for d in ds.demandes if d.id == demande), None)
    if dem is None:
        raise KeyError(f"Demande inconnue : {demande}")
    src = indices_par_type(ds, ("caserne",))
    t = g.index[dem.origine]
    algos = ["dijkstra", "bellman_ford", "floyd_warshall"] if algo == "all" else [algo]
    runs = [_algo_run(g, src, t, a) for a in algos]
    valeurs = [r["dist"] for r in runs if not r.get("ignore")]
    identiques = all(abs(x - valeurs[0]) < 1e-9 or (x == valeurs[0]) for x in valeurs) if valeurs else True
    ligne = next(r for r in request_routes(ds, scen, periode) if r["demande"] == demande)
    return clean(
        {
            "dataset": ident,
            "scenario": scenario,
            "periode": p,
            "demande": {"id": dem.id, "origine": dem.origine, "type": dem.type, "priorite": dem.priorite},
            "algos": runs,
            "identiques": identiques,
            "avant_apres": ligne,
            **_hashes(ds, avant),
        }
    )


def m2_routes(ident: str, scenario: str = "normal", periode: str | None = None) -> dict:
    ds = load(ident)
    avant = dataset_hash(ds)
    scen = apply_scenario(ds, scenario)
    _, p = periodes(scen, periode)
    lignes, ms = chrono(request_routes, ds, scen, periode)
    retards = [r["retard"] for r in lignes if r["retard"] is not None]
    accessibles = [r for r in lignes if r["statut"] == "accessible"]
    return clean(
        {
            "dataset": ident,
            "scenario": scenario,
            "periode": p,
            "lignes": lignes,
            "resume": {
                "demandes": len(lignes),
                "accessibles": len(accessibles),
                "inaccessibles": len(lignes) - len(accessibles),
                "temps_moyen": sum(r["apres"] for r in accessibles) / len(accessibles) if accessibles else None,
                "retard_moyen": sum(retards) / len(retards) if retards else 0.0,
                "retard_max": max(retards) if retards else 0.0,
            },
            "fermetures": [d for d in scen.diff if d["cible"] == "route"],
            "temps_ms": ms,
            **_hashes(ds, avant),
        }
    )


# --- Module 3 ------------------------------------------------------------------------------------


def m3_negcycle(ident: str, source: str, algo: str = "all") -> dict:
    ds = load(ident)
    g = build_road_graph(ds, "normal")
    if source not in g.index:
        raise KeyError(f"Source inconnue : {source}")
    s = g.index[source]
    resultats = []
    for a in (["bellman_ford", "floyd_warshall"] if algo == "all" else [algo]):
        f = negcycle_bellman_ford if a == "bellman_ford" else negcycle_floyd
        r, ms = chrono(f, g, s)
        r["temps_ms"] = ms
        r["dist"] = {g.ids[i]: r["dist"][i] for i in range(g.n)}
        r["cycle"] = [g.ids[x] for x in r["cycle"]]
        for cle in ("marques", "sur_cycle"):
            if cle in r:
                r[cle] = [g.ids[x] for x in r[cle]]
        if "diag" in r:
            r["diag"] = {g.ids[i]: r["diag"][i] for i in range(g.n)}
        if r["existe"]:
            r["message"] = f"Circuit absorbant détecté — {'accessible' if r['accessible'] else 'non accessible'} depuis {source}"
        else:
            r["message"] = "Aucun circuit absorbant"
        resultats.append(r)
    return clean(
        {
            "dataset": ident,
            "source": source,
            "allow_negative": ds.allow_negative,
            "sommets": g.ids,
            "arcs": [{"u": g.ids[u], "v": g.ids[v], "w": w} for u, v, w, _ in g.arcs()],
            "resultats": resultats,
            "identiques": len({str(sorted(clean(r["dist"]).items())) for r in resultats}) == 1,
        }
    )


def negcycle_graph(ident_or_ds, source: str, arcs: list[dict] | None = None, algo: str = "all") -> dict:
    """Bac à sable : mêmes calculs que m3_negcycle sur un graphe fourni (sommets + arcs pondérés)."""
    sommets = sorted({a["u"] for a in arcs} | {a["v"] for a in arcs} | {source})
    g = DiGraph(sommets)
    for k, a in enumerate(arcs):
        g.add_arc(g.index[a["u"]], g.index[a["v"]], float(a["w"]), k)
    s = g.index[source]
    resultats = []
    for a in (["bellman_ford", "floyd_warshall"] if algo == "all" else [algo]):
        f = negcycle_bellman_ford if a == "bellman_ford" else negcycle_floyd
        r, ms = chrono(f, g, s)
        r["temps_ms"] = ms
        r["dist"] = {g.ids[i]: r["dist"][i] for i in range(g.n)}
        r["cycle"] = [g.ids[x] for x in r["cycle"]]
        for cle in ("marques", "sur_cycle"):
            if cle in r:
                r[cle] = [g.ids[x] for x in r[cle]]
        r.pop("diag", None)
        r["message"] = (
            f"Circuit absorbant détecté — {'accessible' if r['accessible'] else 'non accessible'} depuis {source}"
            if r["existe"]
            else "Aucun circuit absorbant"
        )
        resultats.append(r)
    return clean({"source": source, "sommets": g.ids, "arcs": arcs, "resultats": resultats})


# --- Module 4 ------------------------------------------------------------------------------------


def _edge_dict(ug: UGraph, eid: int) -> dict:
    e = ug.edges[eid]
    return {"eid": eid, "cle": e.cle, "u": ug.ids[e.u], "v": ug.ids[e.v], "cost": e.w, "label": f"{ug.ids[e.u]}-{ug.ids[e.v]}"}


def m4_mst(ident: str, algo: str = "both", scenario: str = "normal", trace: bool = False) -> dict:
    ds = load(ident)
    avant = dataset_hash(ds)
    scen = apply_scenario(ds, scenario)
    ug = build_fibre_graph(scen.dataset)
    sortie: dict = {"dataset": ident, "scenario": scenario, "n": ug.n, "candidats": ug.m}
    res = {}
    for a in (["kruskal", "prim"] if algo == "both" else [algo]):
        tracer = Tracer() if trace else None
        f = kruskal if a == "kruskal" else prim
        r, ms = chrono(f, ug, tracer)
        res[a] = r
        evenements = None
        if tracer:
            evenements = tracer.to_dict()
            for ev in evenements["events"]:
                if "arete" in ev:
                    ev["label"] = ug.label(ev["arete"])
        sortie[a] = {
            "aretes": [_edge_dict(ug, e) for e in r.aretes],
            "cout": r.cout,
            "nb_aretes": len(r.aretes),
            "composantes": r.composantes,
            "temps_ms": ms,
            "trace": evenements,
        }
    ref = res.get("kruskal") or res.get("prim")
    if len(res) == 2:
        ek, ep = set(res["kruskal"].aretes), set(res["prim"].aretes)
        sortie["cout_identique"] = abs(res["kruskal"].cout - res["prim"].cout) < 1e-9
        sortie["meme_ensemble"] = ek == ep
        sortie["diff_kruskal"] = [_edge_dict(ug, e) for e in sorted(ek - ep)]
        sortie["diff_prim"] = [_edge_dict(ug, e) for e in sorted(ep - ek)]
    egal = tie_analysis(ug, ref.aretes)
    if egal["echange"]:
        ech = egal["echange"]
        egal["echange"] = {
            "ajouter": _edge_dict(ug, ech["ajouter"]),
            "retirer": _edge_dict(ug, ech["retirer"]),
            "cout": ech["cout"],
            "cycle": [_edge_dict(ug, e) for e in ech["cycle"]],
        }
    egal["couts_egaux_dans_arbre"] = {str(k): v for k, v in egal["couts_egaux_dans_arbre"].items()}
    sortie["egalites"] = egal
    # composantes de la forêt (calculées sur les arêtes retenues)
    from novapolis.algorithms.union_find import UnionFind

    uf = UnionFind(ug.n)
    for e in ref.aretes:
        uf.union(ug.edges[e].u, ug.edges[e].v)
    groupes: dict[int, list[str]] = {}
    for x in range(ug.n):
        groupes.setdefault(uf.find(x), []).append(ug.ids[x])
    comps = sorted(groupes.values(), key=lambda c: (-len(c), c[0]))
    sortie["composantes"] = comps
    sortie["non_raccordes"] = comps[1:]
    sortie["exclus"] = [
        {"u": t.u, "v": t.v, "cost": t.cost, "statut": t.statut} for t in scen.dataset.fibre if t.statut != "disponible"
    ]
    sortie.update(_hashes(ds, avant))
    return clean(sortie)


def m4_panne(ident: str, edge: str, algo: str = "kruskal", scenario: str = "normal") -> dict:
    """Panne d'un tronçon de l'ACM (« U-V ») et raccordement le moins cher."""
    ds = load(ident)
    scen = apply_scenario(ds, scenario)
    ug = build_fibre_graph(scen.dataset)
    r = (kruskal if algo == "kruskal" else prim)(ug)
    u, _, v = edge.partition("-") if edge.count("-") == 1 else _split_edge(ug, edge)
    if u not in ug.index or v not in ug.index:
        raise KeyError(f"Tronçon inconnu : {edge}")
    a, b = ug.index[u], ug.index[v]
    cible = next((e for e in r.aretes if {ug.edges[e].u, ug.edges[e].v} == {a, b}), None)
    if cible is None:
        raise ValueError(f"Le tronçon {edge} n'appartient pas à l'arbre couvrant minimal")
    rep, ms = chrono(repair_after_failure, ug, r.aretes, cible)
    return clean(
        {
            "dataset": ident,
            "coupee": _edge_dict(ug, cible),
            "raccordement": _edge_dict(ug, rep["raccordement"]) if rep["reconnecte"] else None,
            "reconnecte": rep["reconnecte"],
            "cout_initial": rep["cout_initial"],
            "nouveau_cout": rep["nouveau_cout"],
            "delta": rep["delta"],
            "composante_u": [ug.ids[x] for x in rep["composante_u"]],
            "composante_v": [ug.ids[x] for x in rep["composante_v"]],
            "aretes_acm": [_edge_dict(ug, e) for e in r.aretes],
            "temps_ms": ms,
        }
    )


def _split_edge(ug: UGraph, edge: str) -> tuple[str, str, str]:
    """Découpe « C-01-Q-17 » (identifiants contenant des tirets) en (C-01, -, Q-17)."""
    for i, ch in enumerate(edge):
        if ch == "-" and edge[:i] in ug.index and edge[i + 1:] in ug.index:
            return edge[:i], "-", edge[i + 1:]
    return edge, "-", ""


# --- Module 5 ------------------------------------------------------------------------------------


def m5_scenarios(ident: str, noms: list[str] | None = None, periode: str | None = None, personnalises: list[dict] | None = None) -> dict:
    """Indicateurs pour les scénarios déclarés (+ scénarios personnalisés non enregistrés)."""
    from novapolis.model import ActionScenario

    ds = load(ident)
    chemin = dataset_path(ident)
    fichier_avant = folder_hash(chemin)
    noms = noms or ds.noms_scenarios()
    t0 = time.perf_counter()
    lignes = [scenario_indicators(ds, n, periode) for n in noms]
    for perso in personnalises or []:
        actions = [ActionScenario(perso["nom"], a.get("cible", ""), a.get("u", ""), a.get("v", ""), a.get("action", "aucune"), str(a.get("valeur", "")), a.get("periode", "normal")) for a in perso.get("actions", [])]
        ligne = scenario_indicators(ds, perso["nom"], periode, actions=actions)
        ligne["personnalise"] = True
        lignes.append(ligne)
    ms = (time.perf_counter() - t0) * 1000
    fichier_apres = folder_hash(chemin)
    return clean(
        {
            "dataset": ident,
            "scenarios": lignes,
            "hash_fichiers_avant": fichier_avant,
            "hash_fichiers_apres": fichier_apres,
            "base_inchangee": fichier_avant == fichier_apres and all(r["base_inchangee"] for r in lignes),
            "temps_ms": ms,
        }
    )
