"""Laboratoire (exécution tracée rejouée par l'UI) : la trace ne change pas les résultats et suffit à les reconstruire."""

import pytest

from novapolis import services as S

INF = "+inf"


def test_trois_plus_courts_chemins_concordent():
    d = S.lab_run("mini", "dijkstra", "C1", "T1")
    b = S.lab_run("mini", "bellman_ford", "C1", "T1")
    f = S.lab_run("mini", "floyd_warshall", "C1", "T1")
    assert d["resultat"]["dist"] == b["resultat"]["dist"] == f["resultat"]["dist"]
    assert d["cout_chemin"] == b["cout_chemin"] == f["cout_chemin"]
    assert d["chemin"][0] == "C1" and d["chemin"][-1] == "T1"


def test_rejeu_dijkstra_reconstruit_les_distances():
    r = S.lab_run("novapolis", "dijkstra", "C-01")
    dist = {n["id"]: INF for n in r["noeuds"]}
    dist[r["source"]] = 0.0
    fixes = set()
    for ev in r["events"]:
        if ev["type"] == "relache":
            dist[ev["sommet"]] = ev["dist"]
        elif ev["type"] == "fixe":
            assert ev["sommet"] not in fixes  # un sommet n'est fixé qu'une fois
            fixes.add(ev["sommet"])
    assert dist == r["resultat"]["dist"]


def test_bfs_compte_les_atteints_et_niveaux():
    r = S.lab_run("mini", "bfs", "C1", "T1")
    visites = [e["sommet"] for e in r["events"] if e["type"] == "visite"]
    assert len(visites) == r["resultat"]["atteints"]
    assert r["cout_chemin"] == r["resultat"]["niveau"]["T1"]


def test_kruskal_et_prim_meme_cout_que_le_module_4():
    k = S.lab_run("novapolis", "kruskal")
    p = S.lab_run("novapolis", "prim")
    ref = S.m4_mst("novapolis", "both")
    assert k["resultat"]["cout"] == p["resultat"]["cout"] == ref["kruskal"]["cout"]
    acceptees = [e for e in k["events"] if e["type"] == "arete" and e["acceptee"]]
    assert len(acceptees) == len(k["resultat"]["aretes"])


def test_floyd_warshall_matrice_sur_petit_graphe():
    r = S.lab_run("mini", "floyd_warshall", "C1")
    pivots = [e for e in r["events"] if e["type"] == "pivot"]
    assert len(pivots) == len(r["noeuds"])
    assert pivots[-1]["matrice"] is not None


def test_poids_negatifs_dijkstra_refuse_bellman_ford_detecte():
    with pytest.raises(ValueError):
        S.lab_run("negatif_accessible", "dijkstra", "S")
    r = S.lab_run("negatif_accessible", "bellman_ford", "S", "D")
    assert r["resultat"]["circuit_absorbant"] is True
    assert r["chemin"] is None  # aucune distance finie à afficher vers un sommet atteint par le circuit
    ref = S.m3_negcycle("negatif_accessible", "S")["resultats"]
    for algo in ("bellman_ford", "floyd_warshall"):
        lab = S.lab_run("negatif_accessible", algo, "S")["resultat"]["dist"]
        assert lab == next(x for x in ref if x["algo"] == algo)["dist"]  # −∞ exactement comme le module 3
        assert lab["A"] == "-inf" and lab["E"] == 5


def test_garde_fous():
    with pytest.raises(ValueError):
        S.lab_run("n1000_faible", "bfs")
    with pytest.raises(ValueError):
        S.lab_run("mini", "inconnu")
    with pytest.raises(KeyError):
        S.lab_run("mini", "bfs", "ZZZ")
