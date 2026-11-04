"""Application FastAPI. Lancer : `novapolis serve` (ou `uvicorn novapolis.api.main:app`).

L'UI (React) appelle uniquement ces routes : aucun algorithme n'est exécuté en JavaScript.
Si l'UI a été construite (ui/dist), elle est aussi servie ici : la démo fonctionne hors ligne.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from novapolis import __version__
from novapolis.api.routes import analyse, datasets, modules
from novapolis.io.reader import DatasetError
from novapolis.services import RACINE

app = FastAPI(title="Novapolis Résilience API", version=__version__, description="Cœur algorithmique (Python pur) exposé à l'interface graphique.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(DatasetError)
async def _err_dataset(_: Request, exc: DatasetError):
    return JSONResponse(status_code=422, content={"detail": str(exc), "validation": exc.rapport.to_dict()})


@app.exception_handler(FileNotFoundError)
async def _err_404(_: Request, exc: FileNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(FileExistsError)
async def _err_409(_: Request, exc: FileExistsError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(KeyError)
async def _err_key(_: Request, exc: KeyError):
    return JSONResponse(status_code=404, content={"detail": str(exc.args[0]) if exc.args else "introuvable"})


@app.exception_handler(ValueError)
async def _err_value(_: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health", tags=["système"])
def health():
    return {"ok": True, "version": __version__}


app.include_router(datasets.router)
app.include_router(modules.router)
app.include_router(analyse.router)

DIST = os.path.join(RACINE, "ui", "dist")
if os.path.isdir(DIST):
    app.mount("/", StaticFiles(directory=DIST, html=True), name="ui")
