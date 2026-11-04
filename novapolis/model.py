"""Modèle de données : sites, arcs routiers, tronçons de fibre, demandes et scénarios.

Les objets sont de simples dataclasses : ils représentent exactement une ligne de CSV.
Les graphes (listes d'adjacence) sont construits à partir de ces objets dans `novapolis.graph`.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --- Énumérations (valeurs autorisées dans les CSV) -------------------------------------------

SITE_TYPES = ("hopital", "caserne", "ecole", "telecom", "quartier")
SENSIBLE_TYPES = ("hopital", "caserne", "ecole", "telecom")  # sites « sensibles » (indicateur M5)
ROUTE_STATUTS = ("ouvert", "ferme", "travaux")
FIBRE_STATUTS = ("disponible", "interdit", "panne")
PERIODES = ("normal", "pointe")
CIBLES = ("route", "fibre", "site")
ACTIONS = ("aucune", "fermer", "ouvrir", "modifier_temps", "multiplier_temps", "travaux", "interdire", "panne")

# Hypothèse de modélisation : un arc en travaux voit son temps multiplié par ce facteur.
FACTEUR_TRAVAUX = 1.5

# Colonnes obligatoires (sujet) et facultatives (extension documentée dans data/SCHEMA.md)
COLONNES = {
    "sites.csv": ["id", "nom", "type", "longitude", "latitude"],
    "routes.csv": ["u", "v", "temps_normal", "temps_pointe", "statut"],
    "fibre.csv": ["u", "v", "cost", "statut"],
    "demandes.csv": ["id", "origine", "type", "priorite"],
    "scenarios.csv": ["scenario", "cible", "u", "v", "action", "valeur", "periode"],
}
COLONNES_OPTIONNELLES = {
    "routes.csv": ["type_voie", "capacite"],
}
FICHIERS = list(COLONNES.keys())


@dataclass
class Site:
    id: str
    nom: str
    type: str
    longitude: float
    latitude: float


@dataclass
class Arc:
    """Arc orienté u → v du réseau routier (temps en minutes)."""

    u: str
    v: str
    temps_normal: float
    temps_pointe: float
    statut: str = "ouvert"
    type_voie: str = ""
    capacite: str = ""


@dataclass
class Troncon:
    """Arête non orientée u – v du réseau de fibre (coût en k€)."""

    u: str
    v: str
    cost: float
    statut: str = "disponible"


@dataclass
class Demande:
    id: str
    origine: str  # site de l'incident
    type: str
    priorite: int  # 1 = la plus urgente


@dataclass
class ActionScenario:
    """Une ligne de scenarios.csv : une modification appliquée à une COPIE des données."""

    scenario: str
    cible: str = ""
    u: str = ""
    v: str = ""
    action: str = "aucune"
    valeur: str = ""
    periode: str = "normal"


@dataclass
class Dataset:
    """Jeu de données complet (contenu des 5 CSV + meta.json)."""

    nom: str
    sites: list[Site] = field(default_factory=list)
    routes: list[Arc] = field(default_factory=list)
    fibre: list[Troncon] = field(default_factory=list)
    demandes: list[Demande] = field(default_factory=list)
    scenarios: list[ActionScenario] = field(default_factory=list)
    meta: dict = field(default_factory=dict)
    chemin: str = ""  # dossier d'origine (vide si généré en mémoire)

    @property
    def allow_negative(self) -> bool:
        return bool(self.meta.get("allow_negative", False))

    @property
    def synthetique(self) -> bool:
        return bool(self.meta.get("synthetique", False))

    def site_ids(self) -> list[str]:
        return [s.id for s in self.sites]

    def site(self, site_id: str) -> Site | None:
        for s in self.sites:
            if s.id == site_id:
                return s
        return None

    def noms_scenarios(self) -> list[str]:
        """Liste des scénarios déclarés (ordre d'apparition), « normal » toujours en premier."""
        noms: list[str] = ["normal"]
        for a in self.scenarios:
            if a.scenario and a.scenario not in noms:
                noms.append(a.scenario)
        return noms
