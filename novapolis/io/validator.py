"""Validateur des CSV : messages explicites avec fichier, ligne, colonne et valeur.

Il renvoie un rapport structuré (`errors[]`, `warnings[]`) utilisé à la fois par la CLI et par l'UI.
Une erreur empêche le chargement du jeu ; un avertissement est seulement signalé.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from novapolis.model import (
    ACTIONS,
    CIBLES,
    COLONNES,
    COLONNES_OPTIONNELLES,
    FIBRE_STATUTS,
    PERIODES,
    ROUTE_STATUTS,
    SITE_TYPES,
)


@dataclass
class ValidationReport:
    errors: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def ajouter(self, gravite: str, fichier: str, ligne: int | None, colonne: str, valeur, message: str) -> None:
        item = {
            "gravite": gravite,
            "fichier": fichier,
            "ligne": ligne,
            "colonne": colonne,
            "valeur": "" if valeur is None else str(valeur),
            "message": message,
        }
        (self.errors if gravite == "erreur" else self.warnings).append(item)

    def erreur(self, fichier, ligne, colonne, valeur, message):
        self.ajouter("erreur", fichier, ligne, colonne, valeur, message)

    def avert(self, fichier, ligne, colonne, valeur, message):
        self.ajouter("avertissement", fichier, ligne, colonne, valeur, message)

    def to_dict(self) -> dict:
        return {"ok": self.ok, "errors": self.errors, "warnings": self.warnings, "stats": self.stats}


def _nombre(texte: str) -> float | None:
    try:
        return float(texte)
    except (TypeError, ValueError):
        return None


def validate_tables(tables: dict, meta: dict | None = None) -> ValidationReport:
    """Valide les tables brutes produites par `parse_texts`."""
    meta = meta or {}
    negatif_autorise = bool(meta.get("allow_negative", False))
    rep = ValidationReport()

    # 1. Présence des fichiers et des colonnes --------------------------------------------------
    for nom, attendues in COLONNES.items():
        t = tables[nom]
        if not t.present:
            if nom in ("sites.csv", "routes.csv"):
                rep.erreur(nom, None, "", "", f"Fichier obligatoire {nom} absent")
            else:
                rep.avert(nom, None, "", "", f"Fichier {nom} absent : considéré comme vide")
            continue
        manquantes = [c for c in attendues if c not in t.entete]
        if manquantes:
            rep.erreur(nom, 1, ",".join(manquantes), "", f"Colonne(s) manquante(s) : {', '.join(manquantes)}")
        connues = set(attendues) | set(COLONNES_OPTIONNELLES.get(nom, []))
        for c in t.entete:
            if c not in connues:
                rep.avert(nom, 1, c, c, f"Colonne « {c} » non documentée : ignorée")
    if rep.errors:
        return rep  # inutile d'aller plus loin si la structure est fausse

    # 2. sites.csv ------------------------------------------------------------------------------
    ids: dict[str, int] = {}
    for ligne, r in tables["sites.csv"].lignes:
        sid = r["id"]
        if not sid:
            rep.erreur("sites.csv", ligne, "id", sid, "Identifiant vide")
            continue
        if sid in ids:
            rep.erreur("sites.csv", ligne, "id", sid, f"Identifiant dupliqué {sid} (déjà défini ligne {ids[sid]})")
            continue
        ids[sid] = ligne
        if r["type"] not in SITE_TYPES:
            rep.erreur("sites.csv", ligne, "type", r["type"], f"Type inconnu « {r['type']} » (attendu : {', '.join(SITE_TYPES)})")
        for col in ("longitude", "latitude"):
            if _nombre(r[col]) is None:
                rep.erreur("sites.csv", ligne, col, r[col], f"{col} non numérique « {r[col]} »")

    # 3. routes.csv -----------------------------------------------------------------------------
    arcs_vus: dict[tuple[str, str], int] = {}
    for ligne, r in tables["routes.csv"].lignes:
        u, v = r["u"], r["v"]
        for col, s in (("u", u), ("v", v)):
            if s not in ids:
                rep.erreur("routes.csv", ligne, col, s, f"Site inexistant {s} : arc rejeté")
        for col in ("temps_normal", "temps_pointe"):
            x = _nombre(r[col])
            if x is None:
                rep.erreur("routes.csv", ligne, col, r[col], f"Temps non numérique « {r[col]} »")
            elif x < 0 and not negatif_autorise:
                rep.erreur("routes.csv", ligne, col, r[col], f"Temps négatif {r[col]} interdit hors jeu de test (allow_negative)")
        if r["statut"] not in ROUTE_STATUTS:
            rep.erreur("routes.csv", ligne, "statut", r["statut"], f"Statut inconnu « {r['statut']} » (attendu : {', '.join(ROUTE_STATUTS)})")
        if u == v and u:
            rep.avert("routes.csv", ligne, "u,v", u, f"Boucle {u} → {u} : ignorée par les parcours")
        if (u, v) in arcs_vus:
            rep.avert("routes.csv", ligne, "u,v", f"{u}->{v}", f"Arc parallèle dupliqué {u} → {v} (déjà ligne {arcs_vus[(u, v)]}) : les deux arcs sont conservés, le plus court l'emporte")
        else:
            arcs_vus[(u, v)] = ligne

    # 4. fibre.csv ------------------------------------------------------------------------------
    aretes_vues: dict[tuple[str, str], int] = {}
    for ligne, r in tables["fibre.csv"].lignes:
        u, v = r["u"], r["v"]
        for col, s in (("u", u), ("v", v)):
            if s not in ids:
                rep.erreur("fibre.csv", ligne, col, s, f"Site inexistant {s} : tronçon rejeté")
        c = _nombre(r["cost"])
        if c is None:
            rep.erreur("fibre.csv", ligne, "cost", r["cost"], f"Coût non numérique « {r['cost']} »")
        elif c < 0 and not negatif_autorise:
            rep.erreur("fibre.csv", ligne, "cost", r["cost"], f"Coût négatif {r['cost']} interdit")
        if r["statut"] not in FIBRE_STATUTS:
            rep.erreur("fibre.csv", ligne, "statut", r["statut"], f"Statut inconnu « {r['statut']} » (attendu : {', '.join(FIBRE_STATUTS)})")
        if u == v and u:
            rep.avert("fibre.csv", ligne, "u,v", u, f"Boucle {u} – {u} ignorée")
        cle = (min(u, v), max(u, v))
        if cle in aretes_vues:
            rep.avert("fibre.csv", ligne, "u,v", f"{u}-{v}", f"Tronçon parallèle dupliqué {u} – {v} (déjà ligne {aretes_vues[cle]})")
        else:
            aretes_vues[cle] = ligne

    # 5. demandes.csv ---------------------------------------------------------------------------
    dem_vues: dict[str, int] = {}
    for ligne, r in tables["demandes.csv"].lignes:
        did = r["id"]
        if did in dem_vues:
            rep.erreur("demandes.csv", ligne, "id", did, f"Identifiant de demande dupliqué {did} (déjà ligne {dem_vues[did]})")
        else:
            dem_vues[did] = ligne
        if r["origine"] not in ids:
            rep.erreur("demandes.csv", ligne, "origine", r["origine"], f"Site inexistant {r['origine']} : demande rejetée")
        if r["priorite"] not in ("1", "2", "3"):
            rep.erreur("demandes.csv", ligne, "priorite", r["priorite"], f"Priorité « {r['priorite']} » invalide (attendu 1, 2 ou 3)")

    # 6. scenarios.csv --------------------------------------------------------------------------
    for ligne, r in tables["scenarios.csv"].lignes:
        if not r["scenario"]:
            rep.erreur("scenarios.csv", ligne, "scenario", "", "Nom de scénario vide")
        action = r["action"] or "aucune"
        if action not in ACTIONS:
            rep.erreur("scenarios.csv", ligne, "action", action, f"Action inconnue « {action} » (attendu : {', '.join(ACTIONS)})")
        periode = r["periode"] or "normal"
        if periode not in PERIODES:
            rep.erreur("scenarios.csv", ligne, "periode", periode, f"Période inconnue « {periode} » (attendu : normal ou pointe)")
        if action == "aucune":
            continue
        cible = r["cible"]
        if cible not in CIBLES:
            rep.erreur("scenarios.csv", ligne, "cible", cible, f"Cible inconnue « {cible} » (attendu : {', '.join(CIBLES)})")
            continue
        champs = ("u",) if cible == "site" else ("u", "v")
        for col in champs:
            s = r[col]
            if s != "*" and s not in ids:
                rep.erreur("scenarios.csv", ligne, col, s, f"Site inexistant {s} dans le scénario {r['scenario']}")
        if action in ("modifier_temps", "multiplier_temps") and _nombre(r["valeur"]) is None:
            rep.erreur("scenarios.csv", ligne, "valeur", r["valeur"], f"Valeur numérique obligatoire pour l'action {action}")
        if cible == "route" and "*" not in (r["u"], r["v"]) and (r["u"], r["v"]) not in arcs_vus:
            rep.avert("scenarios.csv", ligne, "u,v", f"{r['u']}->{r['v']}", f"Arc {r['u']} → {r['v']} inexistant : action sans effet")
        if cible == "fibre" and "*" not in (r["u"], r["v"]):
            cle = (min(r["u"], r["v"]), max(r["u"], r["v"]))
            if cle not in aretes_vues:
                rep.avert("scenarios.csv", ligne, "u,v", f"{r['u']}-{r['v']}", f"Tronçon {r['u']} – {r['v']} inexistant : action sans effet")

    rep.stats = {f: len(tables[f].lignes) for f in COLONNES}
    return rep
