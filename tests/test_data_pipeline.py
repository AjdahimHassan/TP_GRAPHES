"""Validateur, générateur (reproductibilité octet par octet), immuabilité des scénarios, UI = CLI."""

import io
import os
import zipfile

import pytest
from fastapi.testclient import TestClient

from novapolis import datastudio as D
from novapolis import services as S
from novapolis.api.main import app
from novapolis.generator import PRESETS, generate, preset_params
from novapolis.graph.scenario import apply_scenario
from novapolis.io.reader import parse_texts
from novapolis.io.validator import validate_tables
from novapolis.io.writer import all_texts, dataset_hash, dataset_to_texts, write_dataset

ENTETES = {
    "sites.csv": "id,nom,type,longitude,latitude\n",
    "routes.csv": "u,v,temps_normal,temps_pointe,statut\n",
    "fibre.csv": "u,v,cost,statut\n",
    "demandes.csv": "id,origine,type,priorite\n",
    "scenarios.csv": "scenario,cible,u,v,action,valeur,periode\n",
}
SITES_OK = "A,Site A,quartier,2.3,48.8\nB,Site B,caserne,2.31,48.81\n"


def valider(**surcharges):
    textes = {k: v for k, v in ENTETES.items()}
    textes["sites.csv"] += SITES_OK
    for k, v in surcharges.items():
        textes[k.replace("_", ".")] = v
    return validate_tables(parse_texts(textes), {})


def messages(rep):
    return " | ".join(e["message"] for e in rep.errors + rep.warnings)


def test_validateur_cas_d_erreur():
    rep = valider(sites_csv=ENTETES["sites.csv"] + SITES_OK + "A,Doublon,quartier,2,48\n")
    assert "Identifiant dupliqué A (déjà défini ligne 2)" in messages(rep)
    assert rep.errors[0]["ligne"] == 4
    rep = valider(routes_csv=ENTETES["routes.csv"] + "A,Z,1,2,ouvert\n")
    assert "Site inexistant Z" in messages(rep) and rep.errors[0]["colonne"] == "v"
    rep = valider(routes_csv=ENTETES["routes.csv"] + "A,B,-2,2,ouvert\n")
    assert "Temps négatif -2 interdit" in messages(rep)
    rep = valider(routes_csv=ENTETES["routes.csv"] + "A,B,abc,2,ouvert\n")
    assert "Temps non numérique" in messages(rep)
    rep = valider(routes_csv=ENTETES["routes.csv"] + "A,B,1,2,bouche\n")
    assert "Statut inconnu" in messages(rep)
    rep = valider(sites_csv=ENTETES["sites.csv"] + "A,X,mairie,2,48\n")
    assert "Type inconnu" in messages(rep)
    rep = valider(fibre_csv="u,v,statut\nA,B,disponible\n")
    assert "Colonne(s) manquante(s) : cost" in messages(rep)
    rep = valider(demandes_csv=ENTETES["demandes.csv"] + "D1,Q9,Incendie,1\n")
    assert "Site inexistant Q9" in messages(rep)


def test_validateur_avertissements():
    rep = valider(routes_csv=ENTETES["routes.csv"] + "A,A,1,2,ouvert\nA,B,1,2,ouvert\nA,B,3,4,ouvert\n")
    assert rep.ok
    assert "Boucle A → A" in messages(rep) and "Arc parallèle dupliqué A → B" in messages(rep)


def test_negatif_autorise_seulement_en_test():
    textes = dict(ENTETES)
    textes["sites.csv"] += SITES_OK
    textes["routes.csv"] += "A,B,-2,-2,ouvert\n"
    assert not validate_tables(parse_texts(textes), {}).ok
    assert validate_tables(parse_texts(textes), {"allow_negative": True}).ok


@pytest.mark.parametrize("preset", list(PRESETS))
def test_presets_valides_et_reproductibles(preset):
    p1 = preset_params(preset, n_sites=300) if preset == "benchmark" else preset_params(preset)
    t1 = all_texts(generate(p1))
    t2 = all_texts(generate(p1))
    assert t1 == t2  # même graine + mêmes paramètres ⇒ mêmes octets
    rep = validate_tables(parse_texts({k: v for k, v in t1.items() if k.endswith(".csv")}), generate(p1).meta)
    assert rep.ok, rep.errors[:3]
    assert all("\r" not in v and not v.startswith("﻿") for v in t1.values())


def test_graines_differentes():
    a = dataset_to_texts(generate(preset_params("realiste", graine=1)))
    b = dataset_to_texts(generate(preset_params("realiste", graine=2)))
    assert a["routes.csv"] != b["routes.csv"]


def test_poids_negatifs_interdits_hors_m3():
    with pytest.raises(ValueError):
        generate(preset_params("realiste", poids_negatifs=True))


def test_realiste_conforme_au_sujet(ville):
    types = [s.type for s in ville.sites]
    assert len(ville.sites) >= 150 and ville.synthetique
    assert (types.count("caserne"), types.count("hopital"), types.count("ecole"), types.count("telecom")) == (6, 4, 12, 5)
    assert len(ville.demandes) == 40 and len(ville.noms_scenarios()) >= 3
    assert all(a.temps_normal >= 0 for a in ville.routes)


def test_scenarios_sans_effet_sur_la_base(ville):
    avant = dataset_hash(ville)
    for nom in ville.noms_scenarios():
        r = apply_scenario(ville, nom)
        assert dataset_hash(ville) == avant
        if nom != "normal" and r.diff and nom not in ("heure_pointe",):
            assert dataset_hash(r.dataset) != avant


def test_hash_fichiers_inchanges():
    r = S.m5_scenarios("novapolis")
    assert r["base_inchangee"] and r["hash_fichiers_avant"] == r["hash_fichiers_apres"]


def test_ui_et_cli_identiques(tmp_path):
    """Le studio de l'UI et la commande `generate` écrivent les mêmes octets."""
    from typer.testing import CliRunner

    from novapolis.cli import app as cli

    sortie = tmp_path / "jeu_cli"
    res = CliRunner().invoke(cli, ["generate", "--preset", "realiste", "--seed", "7", "--out", str(sortie)])
    assert res.exit_code == 0, res.output
    _, textes_ui = D.generation_texts("realiste", {"nom": "jeu_cli", "graine": 7})
    for nom, contenu in textes_ui.items():
        assert (sortie / nom).read_bytes() == contenu.encode("utf-8"), nom


def test_api_et_service_identiques():
    c = TestClient(app)
    api = c.post("/m2/routes", json={"dataset": "novapolis", "scenario": "fermeture_axe"}).json()
    svc = S.m2_routes("novapolis", "fermeture_axe")
    assert [l["apres"] for l in api["lignes"]] == [l["apres"] for l in svc["lignes"]]


def test_api_zip_et_erreurs():
    c = TestClient(app)
    r = c.get("/datasets/mini/export.zip")
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert sorted(os.path.basename(n) for n in z.namelist()) == sorted(["sites.csv", "routes.csv", "fibre.csv", "demandes.csv", "scenarios.csv", "meta.json"])
    assert c.get("/datasets/inexistant/validate").status_code == 404
    assert c.post("/m2/route", json={"dataset": "mini", "demande": "ZZ"}).status_code == 404


def test_version_et_import(tmp_path, monkeypatch, mini):
    monkeypatch.setattr(D, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(S, "DATA_DIR", str(tmp_path))
    write_dataset(mini, str(tmp_path / "mini"))
    t = D.table_page("mini", "demandes.csv", 0, 100)
    lignes = [l["valeurs"] for l in t["lignes"]] + [["D9", "Q1", "Incendie", "1"]]
    r = D.new_version("mini", {"demandes.csv": {"entete": t["entete"], "lignes": lignes}})
    assert r["enregistre"] and r["nom"] == "mini_v2"
    assert (tmp_path / "mini" / "demandes.csv").read_text(encoding="utf-8").count("\n") == 5  # original intact
    mauvais = {"sites.csv": b"id,nom,type,longitude,latitude\nA,a,quartier,1,1\n", "routes.csv": b"u,v,temps_normal,temps_pointe,statut\nA,Z,1,1,ouvert\n"}
    r = D.import_dataset("import_ko", mauvais)
    assert not r["enregistre"] and r["validation"]["errors"]
