"""Écriture canonique des jeux de données + empreintes SHA-256.

Format canonique (garantit des fichiers identiques octet par octet pour une même graine) :
- UTF-8 sans BOM, fins de ligne « \\n » ;
- nombres formatés par `fmt_num` (jamais de notation scientifique, zéros inutiles retirés) ;
- l'ordre des lignes est celui des listes du Dataset (le générateur les trie lui-même).
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os

from novapolis.model import COLONNES, FICHIERS, Dataset


def fmt_num(x: float, decimales: int = 6) -> str:
    """Formate un nombre de façon stable : 4 → '4', 2.50 → '2.5', 1/3 → '0.333333'."""
    if x == int(x) and abs(x) < 1e15:
        return str(int(x))
    s = f"{x:.{decimales}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _csv(entete: list[str], lignes: list[list[str]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(entete)
    for ligne in lignes:
        w.writerow(ligne)
    return buf.getvalue()


def dataset_to_texts(ds: Dataset) -> dict[str, str]:
    """Sérialise les 5 CSV d'un Dataset (sans meta.json)."""
    avec_voie = any(a.type_voie or a.capacite for a in ds.routes)
    entete_routes = COLONNES["routes.csv"] + (["type_voie", "capacite"] if avec_voie else [])
    textes = {
        "sites.csv": _csv(
            COLONNES["sites.csv"],
            [[s.id, s.nom, s.type, fmt_num(s.longitude), fmt_num(s.latitude)] for s in ds.sites],
        ),
        "routes.csv": _csv(
            entete_routes,
            [
                [a.u, a.v, fmt_num(a.temps_normal), fmt_num(a.temps_pointe), a.statut]
                + ([a.type_voie, a.capacite] if avec_voie else [])
                for a in ds.routes
            ],
        ),
        "fibre.csv": _csv(COLONNES["fibre.csv"], [[t.u, t.v, fmt_num(t.cost), t.statut] for t in ds.fibre]),
        "demandes.csv": _csv(COLONNES["demandes.csv"], [[d.id, d.origine, d.type, str(d.priorite)] for d in ds.demandes]),
        "scenarios.csv": _csv(
            COLONNES["scenarios.csv"],
            [[a.scenario, a.cible, a.u, a.v, a.action, a.valeur, a.periode] for a in ds.scenarios],
        ),
    }
    return textes


def sha256_text(texte: str) -> str:
    return hashlib.sha256(texte.encode("utf-8")).hexdigest()


# Données de BASE : un scénario (scenarios.csv) décrit des perturbations, il ne fait pas partie de la base.
FICHIERS_BASE = ["sites.csv", "routes.csv", "fibre.csv", "demandes.csv"]


def hash_texts(textes: dict[str, str]) -> str:
    """Empreinte de la base : SHA-256 de « nom\\ncontenu » des 4 CSV de base, dans un ordre fixe."""
    h = hashlib.sha256()
    for nom in FICHIERS_BASE:
        h.update(nom.encode("utf-8") + b"\n")
        h.update(textes.get(nom, "").encode("utf-8"))
    return h.hexdigest()


def dataset_hash(ds: Dataset) -> str:
    """Empreinte du contenu EN MÉMOIRE d'un Dataset (prouve qu'un scénario ne l'a pas modifié)."""
    return hash_texts(dataset_to_texts(ds))


def folder_hash(dossier: str) -> str:
    """Empreinte des fichiers de base SUR DISQUE (octets bruts des 4 CSV de base)."""
    h = hashlib.sha256()
    for nom in FICHIERS_BASE:
        h.update(nom.encode("utf-8") + b"\n")
        chemin = os.path.join(dossier, nom)
        if os.path.exists(chemin):
            with open(chemin, "rb") as f:
                h.update(f.read())
    return h.hexdigest()


def meta_text(meta: dict) -> str:
    return json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def build_meta(ds: Dataset, textes: dict[str, str]) -> dict:
    """Complète meta.json avec l'empreinte de chaque fichier et l'empreinte globale."""
    meta = dict(ds.meta)
    meta["nom"] = ds.nom
    meta["sha256"] = {nom: sha256_text(textes[nom]) for nom in FICHIERS}
    meta["sha256_base"] = hash_texts(textes)
    return meta


def write_dataset(ds: Dataset, dossier: str, ecraser: bool = False) -> dict[str, str]:
    """Écrit les 5 CSV + meta.json. Refuse d'écraser un jeu existant sauf si `ecraser`."""
    if os.path.exists(os.path.join(dossier, "sites.csv")) and not ecraser:
        raise FileExistsError(f"Le jeu {dossier} existe déjà (utiliser ecraser=True / --force)")
    os.makedirs(dossier, exist_ok=True)
    textes = dataset_to_texts(ds)
    textes["meta.json"] = meta_text(build_meta(ds, textes))
    for nom, contenu in textes.items():
        with open(os.path.join(dossier, nom), "w", encoding="utf-8", newline="\n") as f:
            f.write(contenu)
    return textes


def all_texts(ds: Dataset) -> dict[str, str]:
    """Les 6 fichiers (5 CSV + meta.json) tels qu'ils seraient écrits sur disque."""
    textes = dataset_to_texts(ds)
    textes["meta.json"] = meta_text(build_meta(ds, textes))
    return textes
