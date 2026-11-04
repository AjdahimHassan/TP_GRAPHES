"""Le jeu « mini » : chaque valeur est calculée à la main dans data/mini/EXPECTED.md."""

from novapolis import services as S
from novapolis.algorithms.mst import kruskal, prim, repair_after_failure, tie_analysis
from novapolis.algorithms.shortest_paths import INF, bellman_ford, dijkstra, floyd_warshall
from novapolis.algorithms.traversal import bfs, dfs, find_directed_cycle, min_hop_path, tarjan_scc, weak_components
from novapolis.graph.digraph import build_road_graph
from novapolis.graph.ugraph import build_fibre_graph


def ids(g, xs):
    return [g.ids[x] for x in xs]


def test_bfs_multi_source(mini):
    g = build_road_graph(mini)
    r = bfs(g, [g.index["C1"], g.index["C2"]])
    assert ids(g, r.ordre) == ["C1", "C2", "Q1", "E1", "T1", "Q2", "H1"]
    niveaux = {g.ids[i]: r.niveau[i] for i in range(g.n)}
    assert niveaux == {"C1": 0, "C2": 0, "Q1": 1, "E1": 1, "T1": 1, "Q2": 1, "H1": 2, "Q3": -1}


def test_bfs_dfs_depuis_c1(mini):
    g = build_road_graph(mini)
    assert ids(g, bfs(g, [g.index["C1"]]).ordre) == ["C1", "Q1", "E1", "H1", "Q2", "T1", "C2"]
    assert ids(g, dfs(g, [g.index["C1"]]).ordre) == ["C1", "Q1", "H1", "E1", "Q2", "T1", "C2"]


def test_min_hop(mini):
    g = build_road_graph(mini)
    assert ids(g, min_hop_path(g, g.index["C1"], g.index["C2"])) == ["C1", "Q1", "H1", "Q2", "T1", "C2"]
    assert ids(g, min_hop_path(g, g.index["C2"], g.index["H1"])) == ["C2", "Q2", "H1"]  # 2 arcs, 14 min


def test_connexites(mini):
    g = build_road_graph(mini)
    scc = sorted(sorted(g.ids[x] for x in c) for c in tarjan_scc(g))
    assert scc == [["C1", "C2", "H1", "Q1", "Q2", "T1"], ["E1"], ["Q3"]]
    _, faibles = weak_components(g)
    assert len(faibles) == 2
    assert ids(g, find_directed_cycle(g)) == ["C1", "Q1", "C1"]


def test_dijkstra_distances(mini):
    g = build_road_graph(mini)
    d1 = dijkstra(g, [g.index["C1"]]).dist
    assert {g.ids[i]: d1[i] for i in range(g.n)} == {"C1": 0, "C2": 20, "H1": 7, "E1": 7, "T1": 14, "Q1": 4, "Q2": 12, "Q3": INF}
    d2 = dijkstra(g, [g.index["C2"]]).dist
    assert {g.ids[i]: d2[i] for i in range(g.n)} == {"C1": 20, "C2": 0, "H1": 13, "E1": 15, "T1": 6, "Q1": 16, "Q2": 8, "Q3": INF}


def test_trois_algos_identiques(mini):
    g = build_road_graph(mini)
    d, _ = floyd_warshall(g)
    for s in range(g.n):
        dj = dijkstra(g, [s]).dist
        bf = bellman_ford(g, [s]).dist
        assert dj == bf == d[s]


def test_travaux_et_pointe(mini):
    g = build_road_graph(mini, "pointe")
    assert g.weight(g.index["C2"], g.index["Q2"]) == 10.5  # 7 × 1,5 (travaux)
    assert build_road_graph(mini).weight(g.index["C2"], g.index["Q2"]) == 9
    assert build_road_graph(mini).weight(g.index["Q1"], g.index["E1"]) == INF  # arc fermé


def test_demandes_par_scenario():
    attendu = {
        "normal": {"D1": (8, 8), "D2": (7, 7), "D4": (7, 7)},
        "fermeture_axe": {"D1": (8, 8), "D2": (7, 7), "D4": (7, 13)},
        "heure_pointe": {"D1": (8, 10.5), "D2": (7, 9), "D4": (7, 11)},
    }
    for scen, valeurs in attendu.items():
        lignes = {l["demande"]: l for l in S.m2_routes("mini", scen)["lignes"]}
        for d, (avant, apres) in valeurs.items():
            assert (lignes[d]["avant"], lignes[d]["apres"]) == (avant, apres), (scen, d)
        assert lignes["D3"]["statut"] == "inaccessible"
        assert lignes["D3"]["avant"] == "+inf"
    d4 = {l["demande"]: l for l in S.m2_routes("mini", "fermeture_axe")["lignes"]}["D4"]
    assert d4["chemin"] == ["C2", "T1", "Q2", "H1"]
    assert d4["fermetures_sur_chemin_initial"] == ["Q1->H1"]
    assert abs(d4["retard_pct"] - 85.714286) < 1e-6


def test_kruskal_prim_mini(mini):
    ug = build_fibre_graph(mini)
    k, p = kruskal(ug), prim(ug)
    assert k.cout == p.cout == 55
    assert k.composantes == p.composantes == 2  # Q3 n'a aucun tronçon
    lab = lambda r: sorted(ug.label(e) for e in r.aretes)  # noqa: E731
    assert lab(k) == sorted(["Q2-T1", "Q1-H1", "E1-H1", "T1-C2", "C1-Q1", "H1-Q2"])
    assert lab(p) == sorted(["C1-Q1", "Q1-H1", "E1-H1", "H1-Q2", "Q2-T1", "C2-Q2"])
    ech = tie_analysis(ug, k.aretes)["echange"]
    assert (ug.label(ech["ajouter"]), ug.label(ech["retirer"])) == ("C2-Q2", "T1-C2")


def test_panne_mini(mini):
    ug = build_fibre_graph(mini)
    k = kruskal(ug)
    coupee = next(e for e in k.aretes if ug.label(e) == "H1-Q2")
    r = repair_after_failure(ug, k.aretes, coupee)
    assert ug.label(r["raccordement"]) == "H1-T1"
    assert (r["nouveau_cout"], r["delta"]) == (70, 15)


def test_indicateurs_mini():
    lignes = {r["scenario"]: r for r in S.m5_scenarios("mini")["scenarios"]}
    assert lignes["fermeture_axe"]["hausse_moyenne"] == 2.0
    assert lignes["fermeture_axe"]["hausse_max"] == 6.0
    assert abs(lignes["heure_pointe"]["hausse_moyenne"] - 2.833333) < 1e-6
    assert lignes["panne_fibre"]["cout_reparation"] == 30
    assert lignes["panne_fibre"]["composantes_fibre_avant_reparation"] == 3
    assert lignes["panne_fibre"]["composantes_fibre"] == 2
    assert all(r["part_sensibles_accessibles"] == 100.0 for r in lignes.values())
    assert all(r["demandes_inaccessibles"] == 1 for r in lignes.values())


def test_seuil_T():
    r = S.m1_access("mini", seuil=10)
    assert [h["id"] for h in r["hors_delai"]] == ["Q3"]
    r = S.m1_access("mini", seuil=4)
    assert sorted(h["id"] for h in r["hors_delai"]) == ["Q2", "Q3"]
