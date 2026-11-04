"""Application d'un scénario sur une COPIE PROFONDE du jeu de base.

Règle d'or : `apply_scenario` ne modifie jamais le Dataset reçu. Il renvoie un nouveau Dataset,
la liste des différences (diff) et la période du scénario. Les tests vérifient que l'empreinte
SHA-256 du jeu de base est identique avant et après.

Actions reconnues (colonne `action` de scenarios.csv) :
- route  : fermer | ouvrir | travaux | modifier_temps (valeur = nouveau temps) | multiplier_temps (valeur = facteur)
- fibre  : panne | interdire | ouvrir
- site   : fermer (tous les arcs entrants/sortants fermés) | panne (tous les tronçons de fibre en panne)
- aucune : ligne neutre (sert à déclarer un scénario, ex. « normal » ou « heure_pointe »)
`u` ou `v` peut valoir « * » (n'importe quel site).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field

from novapolis.io.writer import fmt_num
from novapolis.model import ActionScenario, Dataset


@dataclass
class ScenarioResult:
    dataset: Dataset  # copie modifiée
    periode: str
    diff: list[dict] = field(default_factory=list)
    actions: list[ActionScenario] = field(default_factory=list)


def _match(motif: str, valeur: str) -> bool:
    return motif == "*" or motif == valeur


def scenario_actions(ds: Dataset, nom: str) -> list[ActionScenario]:
    return [a for a in ds.scenarios if a.scenario == nom]


def scenario_periode(actions: list[ActionScenario]) -> str:
    """Un scénario est « pointe » dès qu'une de ses lignes le précise."""
    return "pointe" if any(a.periode == "pointe" for a in actions) else "normal"


def apply_actions(base: Dataset, actions: list[ActionScenario], nom: str = "personnalise") -> ScenarioResult:
    ds = copy.deepcopy(base)  # copie profonde : le jeu de base reste intact
    ds.nom = f"{base.nom}#{nom}"
    diff: list[dict] = []

    def noter(cible, u, v, champ, avant, apres):
        if avant != apres:
            diff.append({"cible": cible, "u": u, "v": v, "champ": champ, "avant": avant, "apres": apres})

    for act in actions:
        if act.action == "aucune":
            continue
        if act.cible == "route":
            for arc in ds.routes:
                if not (_match(act.u, arc.u) and _match(act.v, arc.v)):
                    continue
                if act.action in ("fermer", "ouvrir", "travaux"):
                    nouveau = {"fermer": "ferme", "ouvrir": "ouvert", "travaux": "travaux"}[act.action]
                    noter("route", arc.u, arc.v, "statut", arc.statut, nouveau)
                    arc.statut = nouveau
                elif act.action == "modifier_temps":
                    champ = "temps_pointe" if act.periode == "pointe" else "temps_normal"
                    avant = getattr(arc, champ)
                    setattr(arc, champ, float(act.valeur))
                    noter("route", arc.u, arc.v, champ, fmt_num(avant), fmt_num(float(act.valeur)))
                elif act.action == "multiplier_temps":
                    f = float(act.valeur)
                    for champ in ("temps_normal", "temps_pointe"):
                        avant = getattr(arc, champ)
                        setattr(arc, champ, round(avant * f, 6))
                        noter("route", arc.u, arc.v, champ, fmt_num(avant), fmt_num(getattr(arc, champ)))
        elif act.cible == "fibre":
            nouveau = {"panne": "panne", "interdire": "interdit", "ouvrir": "disponible"}.get(act.action)
            if nouveau is None:
                continue
            for t in ds.fibre:
                direct = _match(act.u, t.u) and _match(act.v, t.v)
                inverse = _match(act.u, t.v) and _match(act.v, t.u)
                if direct or inverse:
                    noter("fibre", t.u, t.v, "statut", t.statut, nouveau)
                    t.statut = nouveau
        elif act.cible == "site":
            if act.action == "fermer":
                for arc in ds.routes:
                    if _match(act.u, arc.u) or _match(act.u, arc.v):
                        noter("route", arc.u, arc.v, "statut", arc.statut, "ferme")
                        arc.statut = "ferme"
            elif act.action == "panne":
                for t in ds.fibre:
                    if _match(act.u, t.u) or _match(act.u, t.v):
                        noter("fibre", t.u, t.v, "statut", t.statut, "panne")
                        t.statut = "panne"
    return ScenarioResult(dataset=ds, periode=scenario_periode(actions), diff=diff, actions=list(actions))


def apply_scenario(base: Dataset, nom: str) -> ScenarioResult:
    """Applique le scénario `nom` (déclaré dans scenarios.csv) sur une copie du jeu de base."""
    if nom != "normal" and nom not in base.noms_scenarios():
        raise KeyError(f"Scénario inconnu « {nom} » (disponibles : {', '.join(base.noms_scenarios())})")
    return apply_actions(base, scenario_actions(base, nom), nom)
