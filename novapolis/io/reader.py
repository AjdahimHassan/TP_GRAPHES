"""Lecture des CSV → tables brutes (avec numéros de ligne) → objets du modèle.

On sépare volontairement trois étapes :
1. `read_texts`   : fichiers sur disque → textes bruts ;
2. `parse_texts`  : textes → tables (en-tête + lignes numérotées), sans aucune conversion ;
3. `tables_to_dataset` : tables validées → dataclasses du modèle.
Le validateur travaille sur l'étape 2, ce qui lui permet de citer le fichier et la ligne fautive.
"""

from __future__ import annotations

import csv
import io
import json
import os
from dataclasses import dataclass, field

from novapolis.model import (
    FICHIERS,
    ActionScenario,
    Arc,
    Dataset,
    Demande,
    Site,
    Troncon,
)


@dataclass
class Table:
    """Contenu brut d'un CSV : en-tête + lignes (numéro de ligne dans le fichier, dict colonne→texte)."""

    nom: str
    entete: list[str] = field(default_factory=list)
    lignes: list[tuple[int, dict[str, str]]] = field(default_factory=list)
    present: bool = True


class DatasetError(Exception):
    """Levée quand un jeu de données ne passe pas le validateur."""

    def __init__(self, rapport):
        self.rapport = rapport
        premiers = "; ".join(e["message"] for e in rapport.errors[:3])
        super().__init__(f"{len(rapport.errors)} erreur(s) de validation : {premiers}")


def read_texts(dossier: str) -> tuple[dict[str, str], dict]:
    """Lit les 5 CSV (s'ils existent) et meta.json d'un dossier."""
    textes: dict[str, str] = {}
    for nom in FICHIERS:
        chemin = os.path.join(dossier, nom)
        if os.path.exists(chemin):
            with open(chemin, encoding="utf-8-sig", newline="") as f:
                textes[nom] = f.read()
    meta: dict = {}
    chemin_meta = os.path.join(dossier, "meta.json")
    if os.path.exists(chemin_meta):
        with open(chemin_meta, encoding="utf-8") as f:
            meta = json.load(f)
    return textes, meta


def parse_texts(textes: dict[str, str]) -> dict[str, Table]:
    """Découpe chaque texte CSV en table brute. Les fichiers absents donnent une table vide."""
    tables: dict[str, Table] = {}
    for nom in FICHIERS:
        if nom not in textes:
            tables[nom] = Table(nom=nom, present=False)
            continue
        texte = textes[nom].lstrip("﻿")
        lecteur = csv.reader(io.StringIO(texte))
        table = Table(nom=nom)
        for num, ligne in enumerate(lecteur, start=1):
            if num == 1:
                table.entete = [c.strip() for c in ligne]
                continue
            if not ligne or all(not c.strip() for c in ligne):
                continue  # ligne vide ignorée
            valeurs = {}
            for i, col in enumerate(table.entete):
                valeurs[col] = ligne[i].strip() if i < len(ligne) else ""
            table.lignes.append((num, valeurs))
        tables[nom] = table
    return tables


def _float(x: str, defaut: float = 0.0) -> float:
    return float(x) if x not in ("", None) else defaut


def tables_to_dataset(tables: dict[str, Table], meta: dict, nom: str, chemin: str = "") -> Dataset:
    """Convertit des tables (supposées valides) en Dataset. Les lignes invalides sont ignorées."""
    ds = Dataset(nom=nom, meta=dict(meta), chemin=chemin)
    vus: set[str] = set()
    for _, r in tables["sites.csv"].lignes:
        if r.get("id") in vus:
            continue
        vus.add(r["id"])
        ds.sites.append(Site(r["id"], r.get("nom", ""), r["type"], _float(r["longitude"]), _float(r["latitude"])))
    for _, r in tables["routes.csv"].lignes:
        if r.get("u") not in vus or r.get("v") not in vus:
            continue
        ds.routes.append(
            Arc(
                r["u"],
                r["v"],
                _float(r["temps_normal"]),
                _float(r["temps_pointe"], _float(r["temps_normal"])),
                r.get("statut") or "ouvert",
                r.get("type_voie", ""),
                r.get("capacite", ""),
            )
        )
    for _, r in tables["fibre.csv"].lignes:
        if r.get("u") not in vus or r.get("v") not in vus:
            continue
        ds.fibre.append(Troncon(r["u"], r["v"], _float(r["cost"]), r.get("statut") or "disponible"))
    for _, r in tables["demandes.csv"].lignes:
        if r.get("origine") not in vus:
            continue
        ds.demandes.append(Demande(r["id"], r["origine"], r.get("type", ""), int(_float(r.get("priorite", "3"), 3))))
    for _, r in tables["scenarios.csv"].lignes:
        ds.scenarios.append(
            ActionScenario(
                r.get("scenario", ""),
                r.get("cible", ""),
                r.get("u", ""),
                r.get("v", ""),
                r.get("action", "") or "aucune",
                r.get("valeur", ""),
                r.get("periode", "") or "normal",
            )
        )
    return ds


def load_dataset(dossier: str, strict: bool = True) -> Dataset:
    """Charge un dossier de CSV. Si `strict`, lève DatasetError dès qu'il y a une erreur de validation."""
    from novapolis.io.validator import validate_tables

    textes, meta = read_texts(dossier)
    tables = parse_texts(textes)
    rapport = validate_tables(tables, meta)
    if strict and rapport.errors:
        raise DatasetError(rapport)
    nom = os.path.basename(os.path.normpath(dossier))
    return tables_to_dataset(tables, meta, nom, chemin=dossier)
