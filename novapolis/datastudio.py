"""Studio de données : génération (aperçu / enregistrement), import, versions, scénarios, archives.

Toutes les écritures se font dans de NOUVEAUX dossiers de data/ : un jeu existant n'est jamais modifié
en place (sauf l'ajout d'un scénario dans scenarios.csv, qui ne touche pas aux données de base).
"""

from __future__ import annotations

import io
import json
import os
import re
import zipfile

from novapolis.algorithms.traversal import connected_components, tarjan_scc
from novapolis.generator import PRESETS, GenParams, cli_command, generate, preset_params
from novapolis.graph.digraph import build_road_graph
from novapolis.graph.ugraph import build_fibre_graph
from novapolis.io.reader import parse_texts, read_texts, tables_to_dataset
from novapolis.io.validator import validate_tables
from novapolis.io.writer import all_texts, build_meta, dataset_to_texts, folder_hash, meta_text, write_dataset
from novapolis.model import FICHIERS, ActionScenario, Dataset
from novapolis.services import _CACHE, DATA_DIR, dataset_path, decor, list_datasets, load, project

LIBELLES_PRESETS = {
    "mini": "Mini (à la main)",
    "realiste": "Réaliste",
    "benchmark": "Benchmark",
    "test_m3_a": "Test M3 · A",
    "test_m3_b": "Test M3 · B",
}
NOM_VALIDE = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def presets() -> list[dict]:
    return [{"id": k, "label": LIBELLES_PRESETS[k], "params": GenParams(**v).to_dict()} for k, v in PRESETS.items()]


def _params(preset: str, params: dict | None) -> GenParams:
    params = dict(params or {})
    params.pop("preset", None)
    connus = set(GenParams.__dataclass_fields__)
    return preset_params(preset, **{k: v for k, v in params.items() if k in connus})


def stats(ds: Dataset) -> dict:
    g = build_road_graph(ds, "normal")
    ug = build_fibre_graph(ds)
    _, comps = connected_components(ug)
    return {
        "sites": len(ds.sites),
        "arcs": len(ds.routes),
        "arcs_actifs": g.m,
        "troncons": len(ds.fibre),
        "troncons_disponibles": ug.m,
        "degre_moyen": g.m / g.n if g.n else 0.0,
        "composantes_fibre": len(comps),
        "nb_scc": len(tarjan_scc(g)),
        "demandes": len(ds.demandes),
        "scenarios": len(ds.noms_scenarios()),
        "par_type": {t: sum(1 for s in ds.sites if s.type == t) for t in ("hopital", "caserne", "ecole", "telecom", "quartier")},
    }


def map_payload(ds: Dataset) -> dict:
    xy = project(ds)
    return {
        "sites": [{"id": s.id, "type": s.type, "nom": s.nom, "x": round(xy[i][0], 4), "y": round(xy[i][1], 4)} for i, s in enumerate(ds.sites)],
        "routes": [{"u": a.u, "v": a.v, "statut": a.statut, "type_voie": a.type_voie} for a in ds.routes],
        "fibre": [{"u": t.u, "v": t.v, "statut": t.statut} for t in ds.fibre],
        "decor": decor(ds),
    }


def files_info(textes: dict[str, str], apercu: int = 10) -> list[dict]:
    infos = []
    for nom in FICHIERS + ["meta.json"]:
        t = textes.get(nom, "")
        lignes = t.split("\n")
        infos.append(
            {
                "nom": nom,
                "lignes": (len([x for x in lignes if x]) - 1) if nom.endswith(".csv") else None,
                "octets": len(t.encode("utf-8")),
                "apercu": "\n".join(lignes[:apercu]),
            }
        )
    return infos


def generation(preset: str, params: dict | None, apercu: bool = True, ecraser: bool = False) -> dict:
    """Génère un jeu. `apercu=True` : rien n'est écrit. Sinon : validation puis écriture dans data/<nom>."""
    p = _params(preset, params)
    if not NOM_VALIDE.match(p.nom):
        raise ValueError("Nom de jeu invalide (lettres, chiffres, _ et - uniquement)")
    ds = generate(p)
    textes = all_texts(ds)
    rep = validate_tables(parse_texts(textes), ds.meta)
    sortie = {
        "nom": p.nom,
        "preset": p.preset,
        "params": p.to_dict(),
        "commande": cli_command(p),
        "stats": stats(ds),
        "validation": rep.to_dict(),
        "fichiers": files_info(textes),
        "sha256_base": json.loads(textes["meta.json"])["sha256_base"],
        "carte": map_payload(ds) if len(ds.sites) <= 6000 else None,
        "enregistre": False,
        "existe": os.path.exists(os.path.join(DATA_DIR, p.nom, "sites.csv")),
    }
    if not apercu:
        if not rep.ok:
            raise ValueError("Le validateur signale des erreurs : enregistrement refusé")
        dossier = os.path.join(DATA_DIR, p.nom)
        if os.path.exists(os.path.join(dossier, "sites.csv")) and not ecraser:
            raise FileExistsError(f"Le jeu data/{p.nom} existe déjà : confirmer l'écrasement")
        write_dataset(ds, dossier, ecraser=True)
        sortie["enregistre"] = True
        sortie["chemin"] = dossier
    return sortie


def generation_texts(preset: str, params: dict | None) -> tuple[str, dict[str, str]]:
    p = _params(preset, params)
    ds = generate(p)
    return p.nom, all_texts(ds)


def zip_texts(textes: dict[str, str], dossier: str = "") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for nom in sorted(textes):
            info = zipfile.ZipInfo(f"{dossier}/{nom}" if dossier else nom, date_time=(2024, 1, 1, 0, 0, 0))  # date fixe : zip reproductible
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, textes[nom].encode("utf-8"))
    return buf.getvalue()


def dataset_texts(ident: str) -> dict[str, str]:
    chemin = dataset_path(ident)
    textes, _ = read_texts(chemin)
    meta = os.path.join(chemin, "meta.json")
    if os.path.exists(meta):
        with open(meta, encoding="utf-8") as f:
            textes["meta.json"] = f.read()
    return textes


def dataset_info(ident: str) -> dict:
    chemin = dataset_path(ident)
    textes, meta = read_texts(chemin)
    rep = validate_tables(parse_texts(textes), meta)
    groupe = "generes" if os.path.basename(os.path.dirname(chemin)) == "generes" else ("test" if meta.get("allow_negative") else meta.get("preset", "autre"))
    return {
        "id": os.path.basename(os.path.normpath(chemin)),
        "groupe": groupe,
        "synthetique": bool(meta.get("synthetique")),
        "allow_negative": bool(meta.get("allow_negative")),
        "description": meta.get("description", ""),
        "preset": meta.get("preset"),
        "graine": meta.get("graine"),
        "hash": folder_hash(chemin),
        "fichiers": {k: v for k, v in rep.stats.items()},
        "erreurs": len(rep.errors),
        "avertissements": len(rep.warnings),
        "statut_fichiers": _statut_fichiers(rep),
        "scenarios": _noms_scenarios(parse_texts(textes)),
        "demandes": [r["id"] for _, r in parse_texts(textes)["demandes.csv"].lignes][:2000],
    }


def _noms_scenarios(tables) -> list[str]:
    noms = ["normal"]
    for _, r in tables["scenarios.csv"].lignes:
        if r.get("scenario") and r["scenario"] not in noms:
            noms.append(r["scenario"])
    return noms


def _statut_fichiers(rep) -> dict:
    statut = {f: "ok" for f in FICHIERS}
    for w in rep.warnings:
        if statut.get(w["fichier"]) == "ok":
            statut[w["fichier"]] = "avertissement"
    for e in rep.errors:
        statut[e["fichier"]] = "erreur"
    return statut


def all_infos() -> list[dict]:
    infos = []
    for j in list_datasets():
        try:
            infos.append(dataset_info(j["id"]))
        except Exception as exc:  # un jeu cassé ne doit pas casser la liste
            infos.append({"id": j["id"], "erreur": str(exc)})
    return infos


def validate_dataset(ident: str) -> dict:
    chemin = dataset_path(ident)
    textes, meta = read_texts(chemin)
    return validate_tables(parse_texts(textes), meta).to_dict()


def table_page(ident: str, nom: str, offset: int = 0, limite: int = 50, filtre: str = "") -> dict:
    if nom not in FICHIERS:
        raise KeyError(f"Fichier inconnu : {nom}")
    textes, _ = read_texts(dataset_path(ident))
    t = parse_texts(textes)[nom]
    lignes = [(n, r) for n, r in t.lignes if not filtre or any(filtre.lower() in v.lower() for v in r.values())]
    return {
        "fichier": nom,
        "entete": t.entete,
        "total": len(lignes),
        "offset": offset,
        "lignes": [{"ligne": n, "valeurs": [r.get(c, "") for c in t.entete]} for n, r in lignes[offset : offset + limite]],
    }


def _texts_from_upload(fichiers: dict[str, bytes]) -> dict[str, str]:
    textes: dict[str, str] = {}
    for nom, contenu in fichiers.items():
        if nom.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(contenu)) as z:
                for info in z.infolist():
                    base = os.path.basename(info.filename)
                    if base in FICHIERS or base == "meta.json":
                        textes[base] = z.read(info).decode("utf-8-sig")
        else:
            base = os.path.basename(nom)
            if base in FICHIERS or base == "meta.json":
                textes[base] = contenu.decode("utf-8-sig")
    return textes


def import_dataset(nom: str, fichiers: dict[str, bytes], enregistrer: bool = True) -> dict:
    """Import de CSV ou d'un .zip : le validateur passe AVANT tout enregistrement."""
    if not NOM_VALIDE.match(nom):
        raise ValueError("Nom de jeu invalide")
    textes = _texts_from_upload(fichiers)
    meta = json.loads(textes.pop("meta.json")) if "meta.json" in textes else {}
    rep = validate_tables(parse_texts(textes), meta)
    sortie = {"nom": nom, "validation": rep.to_dict(), "enregistre": False, "fichiers_recus": sorted(textes)}
    if rep.ok and enregistrer:
        dossier = os.path.join(DATA_DIR, nom)
        if os.path.exists(os.path.join(dossier, "sites.csv")):
            raise FileExistsError(f"Le jeu data/{nom} existe déjà")
        ds = tables_to_dataset(parse_texts(textes), meta, nom)
        ds.meta.setdefault("synthetique", meta.get("synthetique", False))
        ds.meta["importe"] = True
        write_dataset(ds, dossier)
        sortie["enregistre"] = True
    return sortie


def _prochaine_version(ident: str) -> str:
    base = re.sub(r"_v\d+$", "", ident)
    k = 2
    existants = {j["id"] for j in list_datasets()}
    while f"{base}_v{k}" in existants:
        k += 1
    return f"{base}_v{k}"


def new_version(ident: str, tables: dict[str, dict]) -> dict:
    """Éditeur de tables : les lignes modifiées forment un NOUVEAU jeu <nom>_vN (l'original est intact).

    `tables[nom] = {"entete": [...], "lignes": [[...], ...]}` pour chaque fichier modifié.
    """
    chemin = dataset_path(ident)
    textes, meta = read_texts(chemin)
    import csv

    for nom, t in tables.items():
        if nom not in FICHIERS:
            continue
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(t["entete"])
        for ligne in t["lignes"]:
            w.writerow(ligne)
        textes[nom] = buf.getvalue()
    rep = validate_tables(parse_texts(textes), meta)
    nouveau = _prochaine_version(ident)
    sortie = {"nom": nouveau, "validation": rep.to_dict(), "enregistre": False}
    if rep.ok:
        dossier = os.path.join(os.path.dirname(chemin), nouveau)
        ds = tables_to_dataset(parse_texts(textes), meta, nouveau)
        ds.meta["version_de"] = ident
        write_dataset(ds, dossier)
        sortie["enregistre"] = True
    return sortie


def append_scenario(ident: str, nom: str, actions: list[dict]) -> dict:
    """Ajoute un scénario à scenarios.csv (les données de base ne changent pas : même empreinte)."""
    if not NOM_VALIDE.match(nom):
        raise ValueError("Nom de scénario invalide")
    chemin = dataset_path(ident)
    ds = load(ident)
    if nom in ds.noms_scenarios():
        raise FileExistsError(f"Le scénario « {nom} » existe déjà")
    avant = folder_hash(chemin)
    nouvelles = [
        ActionScenario(nom, a.get("cible", ""), a.get("u", ""), a.get("v", ""), a.get("action", "aucune"), str(a.get("valeur", "")), a.get("periode", "normal"))
        for a in actions
    ] or [ActionScenario(nom)]
    copie = Dataset(ds.nom, ds.sites, ds.routes, ds.fibre, ds.demandes, ds.scenarios + nouvelles, dict(ds.meta))
    textes = dataset_to_texts(copie)
    rep = validate_tables(parse_texts(textes), ds.meta)
    if not rep.ok:
        return {"enregistre": False, "validation": rep.to_dict()}
    with open(os.path.join(chemin, "scenarios.csv"), "w", encoding="utf-8", newline="\n") as f:
        f.write(textes["scenarios.csv"])
    with open(os.path.join(chemin, "meta.json"), "w", encoding="utf-8", newline="\n") as f:
        f.write(meta_text(build_meta(copie, textes)))
    _CACHE.pop(chemin, None)
    return {"enregistre": True, "scenario": nom, "hash_avant": avant, "hash_apres": folder_hash(chemin), "validation": rep.to_dict()}
