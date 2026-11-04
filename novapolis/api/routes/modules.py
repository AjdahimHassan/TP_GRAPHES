"""Routes des modules M1 à M5 : de simples appels à novapolis.services (mêmes résultats que la CLI)."""

from __future__ import annotations

from fastapi import APIRouter

from novapolis import services as S
from novapolis.api.schemas import AccessReq, MinHopReq, MstReq, NegReq, PanneReq, RouteReq, SandboxReq, ScenariosReq

router = APIRouter()


@router.post("/m1/access", tags=["M1 accessibilité"])
def access(req: AccessReq):
    return S.m1_access(req.dataset, req.sources, req.scenario, req.periode, req.algo, req.trace, req.seuil)


@router.post("/m1/minhop", tags=["M1 accessibilité"])
def minhop(req: MinHopReq):
    return S.m1_minhop(req.dataset, req.u, req.v, req.scenario, req.periode)


@router.get("/m1/cycles", tags=["M1 accessibilité"])
def cycles(dataset: str = "novapolis", scenario: str = "normal", periode: str | None = None):
    return S.m1_cycles(dataset, scenario, periode)


@router.post("/m2/route", tags=["M2 itinéraires"])
def route(req: RouteReq):
    algo = "floyd_warshall" if req.algo == "floyd" else req.algo
    return S.m2_route(req.dataset, req.demande, algo, req.scenario, req.periode)


@router.post("/m2/routes", tags=["M2 itinéraires"])
def routes(req: AccessReq):
    return S.m2_routes(req.dataset, req.scenario, req.periode)


@router.post("/m3/negcycle", tags=["M3 circuits absorbants"])
def negcycle(req: NegReq):
    return S.m3_negcycle(req.dataset, req.source, req.algo)


@router.post("/m3/sandbox", tags=["M3 circuits absorbants"])
def sandbox(req: SandboxReq):
    return S.negcycle_graph(None, req.source, [a.model_dump() for a in req.arcs], req.algo)


@router.post("/m4/mst", tags=["M4 fibre"])
def mst(req: MstReq):
    return S.m4_mst(req.dataset, req.algo, req.scenario, req.trace)


@router.post("/m4/panne", tags=["M4 fibre"])
def panne(req: PanneReq):
    return S.m4_panne(req.dataset, req.edge, req.algo, req.scenario)


@router.post("/m5/scenarios", tags=["M5 scénarios"])
def scenarios(req: ScenariosReq):
    perso = [{"nom": p.nom, "actions": [a.model_dump() for a in p.actions]} for p in req.personnalises]
    return S.m5_scenarios(req.dataset, req.scenarios, req.periode, perso)
