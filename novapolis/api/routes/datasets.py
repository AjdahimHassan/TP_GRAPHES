"""Routes « jeux de données » : liste, studio de génération, import, versions, fichiers, graphe."""

from __future__ import annotations

import os

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import PlainTextResponse, Response

from novapolis import datastudio as D
from novapolis import services as S
from novapolis.api.schemas import AppendScenarioReq, GenFileReq, GenReq, VersionReq
from novapolis.model import FICHIERS

router = APIRouter(tags=["données"])


def _fichier(nom: str, contenu: str) -> Response:
    media = "application/json" if nom.endswith(".json") else "text/csv"
    return Response(contenu.encode("utf-8"), media_type=f"{media}; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{nom}"'})


@router.get("/datasets")
def datasets():
    return D.all_infos()


@router.get("/datasets/presets")
def presets():
    return D.presets()


@router.post("/datasets/generate")
def generate(req: GenReq):
    return D.generation(req.preset, req.params, apercu=req.preview, ecraser=req.ecraser)


@router.post("/datasets/generate/download")
def generate_download(req: GenFileReq):
    """Télécharge un fichier (ou le .zip) d'un jeu généré SANS l'enregistrer (régénéré à l'identique)."""
    nom, textes = D.generation_texts(req.preset, req.params)
    if req.fichier:
        return _fichier(req.fichier, textes[req.fichier])
    return Response(D.zip_texts(textes, nom), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{nom}.zip"'})


@router.post("/datasets/import")
async def import_dataset(nom: str = Form(...), fichiers: list[UploadFile] = File(...), enregistrer: bool = Form(True)):
    contenus = {f.filename or "fichier": await f.read() for f in fichiers}
    return D.import_dataset(nom, contenus, enregistrer)


@router.get("/datasets/{ident}")
def dataset_info(ident: str):
    return D.dataset_info(ident)


@router.get("/datasets/{ident}/validate")
def validate(ident: str):
    return D.validate_dataset(ident)


@router.get("/datasets/{ident}/files/{nom}")
def fichier(ident: str, nom: str):
    textes = D.dataset_texts(ident)
    if nom not in textes:
        raise FileNotFoundError(f"Fichier {nom} absent du jeu {ident}")
    return _fichier(nom, textes[nom])


@router.get("/datasets/{ident}/export.zip")
def export_zip(ident: str):
    return Response(D.zip_texts(D.dataset_texts(ident), ident), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{ident}.zip"'})


@router.get("/datasets/{ident}/tables/{nom}")
def table(ident: str, nom: str, offset: int = 0, limit: int = 50, q: str = ""):
    return D.table_page(ident, nom, offset, limit, q)


@router.get("/datasets/{ident}/tables")
def tables_completes(ident: str):
    """Toutes les lignes des 5 CSV (éditeur de tables)."""
    return {nom: D.table_page(ident, nom, 0, 10**9) for nom in FICHIERS}


@router.post("/datasets/{ident}/versions")
def version(ident: str, req: VersionReq):
    return D.new_version(ident, req.tables)


@router.post("/datasets/{ident}/scenarios")
def append_scenario(ident: str, req: AppendScenarioReq):
    return D.append_scenario(ident, req.nom, [a.model_dump() for a in req.actions])


@router.get("/datasets/{ident}/graph")
def graph(ident: str, scenario: str = "normal", periode: str | None = None):
    return S.graph_payload(ident, scenario, periode)


@router.get("/docs-projet/{nom}", response_class=PlainTextResponse)
def doc(nom: str):
    """Documents du projet (README, SCHEMA, CONTRIBUTIONS, plan du rapport, EXPECTED du jeu mini)."""
    autorises = {
        "README.md": os.path.join(S.RACINE, "README.md"),
        "CONTRIBUTIONS.md": os.path.join(S.RACINE, "CONTRIBUTIONS.md"),
        "SCHEMA.md": os.path.join(S.DATA_DIR, "SCHEMA.md"),
        "EXPECTED.md": os.path.join(S.DATA_DIR, "mini", "EXPECTED.md"),
        "rapport_plan.md": os.path.join(S.RACINE, "reports", "rapport_plan.md"),
    }
    if nom not in autorises or not os.path.exists(autorises[nom]):
        raise FileNotFoundError(f"Document introuvable : {nom}")
    with open(autorises[nom], encoding="utf-8") as f:
        return f.read()
