"""Module 3 : graphe A (circuit accessible) et graphe B (circuit non accessible)."""

from novapolis import services as S
from novapolis.algorithms.negative_cycles import MOINS_INF, negcycle_bellman_ford, negcycle_floyd
from novapolis.generator import generate, preset_params
from novapolis.graph.digraph import build_road_graph
from tests.conftest import digraph


def _resultats(nom, source="S"):
    return {r["algo"]: r for r in S.m3_negcycle(nom, source)["resultats"]}


def test_graphe_a_accessible():
    for algo, r in _resultats("negatif_accessible").items():
        assert r["existe"] and r["accessible"], algo
        assert r["cycle"] == ["A", "B", "C", "A"]
        assert r["poids_cycle"] == -1
        assert r["dist"] == {"S": 0.0, "A": "-inf", "B": "-inf", "C": "-inf", "D": "-inf", "E": 5.0}


def test_graphe_b_non_accessible():
    for algo, r in _resultats("negatif_inaccessible").items():
        assert r["existe"] and not r["accessible"], algo
        assert r["cycle"] == ["C", "D", "E", "C"]
        # distances finies conservées, aucune valeur −∞ depuis S
        assert r["dist"] == {"S": 0.0, "A": 3.0, "B": 5.0, "C": "+inf", "D": "+inf", "E": "+inf"}


def test_graphe_b_depuis_c():
    for r in _resultats("negatif_inaccessible", "C").values():
        assert r["accessible"]
        assert r["dist"]["B"] == "-inf"  # B est atteignable depuis le circuit
        assert r["dist"]["S"] == "+inf"


def test_sans_circuit():
    g = digraph(3, [(0, 1, -2), (1, 2, 3)])
    for f in (negcycle_bellman_ford, negcycle_floyd):
        r = f(g, 0)
        assert not r["existe"] and r["dist"] == [0, -2, 1]


def test_boucle_negative():
    g = digraph(2, [(0, 1, 1), (1, 1, -1)])
    for f in (negcycle_bellman_ford, negcycle_floyd):
        r = f(g, 0)
        assert r["existe"] and r["accessible"] and r["dist"][1] == MOINS_INF


def test_presets_m3_contiennent_le_bon_circuit():
    for preset, attendu in (("test_m3_a", True), ("test_m3_b", False)):
        ds = generate(preset_params(preset))
        assert ds.allow_negative
        r = negcycle_bellman_ford(build_road_graph(ds), 0)
        assert r["existe"] and r["accessible"] is attendu and r["poids_cycle"] == -1
