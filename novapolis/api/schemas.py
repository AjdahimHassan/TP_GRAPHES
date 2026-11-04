"""Modèles Pydantic des requêtes (les réponses sont les dicts renvoyés par novapolis.services)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Ctx(BaseModel):
    dataset: str = "novapolis"
    scenario: str = "normal"
    periode: str | None = Field(None, description="normal | pointe ; None = période du scénario")


class AccessReq(Ctx):
    sources: str | list[str] = "casernes"
    mode: str = "reach"
    algo: str = "bfs"
    trace: bool = False
    seuil: float = 10.0


class MinHopReq(Ctx):
    u: str
    v: str


class RouteReq(Ctx):
    demande: str
    algo: str = "all"


class NegReq(BaseModel):
    dataset: str = "negatif_accessible"
    source: str = "S"
    algo: str = "all"


class ArcPoids(BaseModel):
    u: str
    v: str
    w: float


class SandboxReq(BaseModel):
    source: str = "S"
    arcs: list[ArcPoids]
    algo: str = "all"


class MstReq(BaseModel):
    dataset: str = "novapolis"
    scenario: str = "normal"
    algo: str = "both"
    trace: bool = False


class PanneReq(BaseModel):
    dataset: str = "novapolis"
    edge: str
    algo: str = "kruskal"
    scenario: str = "normal"


class Action(BaseModel):
    cible: str = ""
    u: str = ""
    v: str = ""
    action: str = "aucune"
    valeur: str | float = ""
    periode: str = "normal"


class ScenarioPerso(BaseModel):
    nom: str
    actions: list[Action] = []


class ScenariosReq(BaseModel):
    dataset: str = "novapolis"
    scenarios: list[str] | None = None
    periode: str | None = None
    personnalises: list[ScenarioPerso] = []


class GenReq(BaseModel):
    preset: str = "realiste"
    params: dict = {}
    preview: bool = True
    ecraser: bool = False


class GenFileReq(BaseModel):
    preset: str = "realiste"
    params: dict = {}
    fichier: str | None = Field(None, description="nom du fichier ; None = archive .zip complète")


class VersionReq(BaseModel):
    tables: dict[str, dict]


class AppendScenarioReq(BaseModel):
    nom: str
    actions: list[Action] = []


class BenchReq(BaseModel):
    sizes: list[int] = [250, 500, 1000, 2000, 5000]
    densities: list[str] = ["faible", "moyenne", "forte"]
    reps: int = 5
    seed: int = 42
    algos: list[str] | None = None
