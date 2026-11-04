"""Routes « analyse » : benchmarks (tâche de fond + flux SSE) et reproductibilité."""

from __future__ import annotations

import asyncio
import json
import os
import platform
import sys
import threading
import time
import uuid
from importlib import metadata

from fastapi import APIRouter
from fastapi.responses import FileResponse, StreamingResponse

from novapolis import __version__
from novapolis import services as S
from novapolis.api.schemas import BenchReq
from novapolis.bench import COMPLEXITE, NOMS, analyse, commentaire, read_csv, run_bench, write_csv

router = APIRouter(tags=["analyse"])
BENCH_CSV = os.path.join(S.RACINE, "reports", "bench.csv")
FIGURES = os.path.join(S.RACINE, "reports", "figures")
JOBS: dict[str, dict] = {}


def _resultat(lignes: list[dict]) -> dict:
    ana = analyse(lignes)
    return {
        "lignes": lignes,
        "analyse": ana,
        "commentaires": [commentaire(a) for a in ana],
        "complexites": COMPLEXITE,
        "noms": NOMS,
    }


@router.post("/bench")
def lancer_bench(req: BenchReq):
    """Lance un benchmark en tâche de fond ; suivre /bench/{id}/events (SSE)."""
    jid = uuid.uuid4().hex[:10]
    job = {"id": jid, "etat": "en_cours", "evenements": [], "resultat": None, "erreur": None, "params": req.model_dump()}
    JOBS[jid] = job

    def travail():
        try:
            lignes = run_bench(req.sizes, req.densities, req.reps, req.seed, req.algos, progres=lambda ev: job["evenements"].append(ev))
            write_csv(lignes, BENCH_CSV)
            job["resultat"] = _resultat(lignes)
            job["etat"] = "termine"
        except Exception as exc:  # l'erreur est renvoyée à l'UI, jamais une page blanche
            job["erreur"] = str(exc)
            job["etat"] = "erreur"

    threading.Thread(target=travail, daemon=True).start()
    return {"id": jid}


@router.get("/bench/latest")
def dernier_bench():
    if not os.path.exists(BENCH_CSV):
        return {"lignes": [], "analyse": [], "commentaires": [], "complexites": COMPLEXITE, "noms": NOMS, "vide": True}
    return S.clean(_resultat(read_csv(BENCH_CSV)))


@router.get("/bench/{jid}/events")
async def evenements(jid: str):
    job = JOBS.get(jid)
    if job is None:
        raise KeyError(f"Tâche inconnue : {jid}")

    async def flux():
        envoyes = 0
        while True:
            evs = job["evenements"]
            while envoyes < len(evs):
                ev = evs[envoyes]
                envoyes += 1
                yield f"data: {json.dumps(S.clean({'fait': ev['fait'], 'total': ev['total'], 'algo': ev['ligne']['algo'], 'n': ev['ligne']['n'], 'densite': ev['ligne']['densite'], 'moyenne_ms': ev['ligne']['moyenne_ms']}))}\n\n"
            if job["etat"] != "en_cours":
                yield f"event: fin\ndata: {json.dumps({'etat': job['etat'], 'erreur': job['erreur']})}\n\n"
                return
            await asyncio.sleep(0.2)

    return StreamingResponse(flux(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.get("/bench/{jid}/result")
def resultat(jid: str):
    job = JOBS.get(jid)
    if job is None:
        raise KeyError(f"Tâche inconnue : {jid}")
    return S.clean({"etat": job["etat"], "erreur": job["erreur"], "resultat": job["resultat"]})


@router.get("/figures/{nom}")
def figure(nom: str):
    chemin = os.path.join(FIGURES, os.path.basename(nom))
    if not os.path.exists(chemin):
        raise FileNotFoundError(f"Figure absente : {nom} (lancer « make figures »)")
    return FileResponse(chemin, media_type="image/png")


def _version(paquet: str) -> str:
    try:
        return metadata.version(paquet)
    except metadata.PackageNotFoundError:
        return "—"


COMMANDES = [
    ("Validation des données", "novapolis validate --data data/novapolis", "novapolis"),
    ("Figure 1 · accessibilité depuis les casernes", "novapolis access --data data/novapolis --sources casernes --export out/access.json", "novapolis"),
    ("Tableau 1 · composantes fortement connexes", "novapolis access --data data/novapolis --mode scc", "novapolis"),
    ("Tableau 2 · itinéraires après fermeture", "novapolis routes --data data/novapolis --scenario fermeture_axe --export out/routes.csv", "novapolis"),
    ("Tableau 3 · comparaison des algorithmes (D-07)", "novapolis route --data data/novapolis --demande D-07 --algo all --scenario fermeture_axe", "novapolis"),
    ("Tableau 4 · circuits absorbants (test A)", "novapolis negcycle --data data/negatif_accessible --source S --algo all", "negatif_accessible"),
    ("Tableau 5 · circuits absorbants (test B)", "novapolis negcycle --data data/negatif_inaccessible --source S --algo all", "negatif_inaccessible"),
    ("Figure 4 · ACM Kruskal vs Prim", "novapolis mst --data data/novapolis --algo both", "novapolis"),
    ("Tableau 6 · panne fibre", "novapolis mst-panne --data data/mini --edge H1-Q2", "mini"),
    ("Tableau 7 · indicateurs de résilience", "novapolis scenarios --data data/novapolis --all --export out/indicateurs.csv", "novapolis"),
    ("Données générées (n = 1000…5000)", "novapolis data", "generes"),
    ("Figures 7-10 · benchmarks", "novapolis bench --sizes 250,500,1000,2000,5000 --reps 5 --seed 42 && python scripts/make_figures.py reports/bench.csv", "bench"),
]


@router.get("/repro")
def repro():
    hashes = []
    for j in S.list_datasets():
        try:
            from novapolis.io.reader import read_texts
            from novapolis.io.writer import folder_hash

            _, meta = read_texts(j["chemin"])
            hashes.append({"id": j["id"], "hash": folder_hash(j["chemin"]), "graine": meta.get("graine"), "preset": meta.get("preset")})
        except Exception as exc:
            hashes.append({"id": j["id"], "hash": None, "erreur": str(exc)})
    return {
        "commandes": [{"label": a, "commande": b, "dataset": c} for a, b, c in COMMANDES],
        "jeux": hashes,
        "environnement": {
            "Novapolis": __version__,
            "Python": sys.version.split()[0],
            "FastAPI": _version("fastapi"),
            "Pydantic": _version("pydantic"),
            "Typer": _version("typer"),
            "matplotlib": _version("matplotlib"),
            "OS": f"{platform.system()} {platform.release()} {platform.machine()}",
            "Graine globale": "42",
        },
        "figures": sorted(os.listdir(FIGURES)) if os.path.isdir(FIGURES) else [],
        "bench_csv": os.path.exists(BENCH_CSV),
    }


@router.post("/repro/regenerate")
def regenerer():
    """Équivalent de « make figures » + exports des tableaux du rapport dans out/."""
    t0 = time.perf_counter()
    sortie = os.path.join(S.RACINE, "out")
    os.makedirs(sortie, exist_ok=True)
    produits = []
    if S.list_datasets() and any(j["id"] == "novapolis" for j in S.list_datasets()):
        for nom, objet in (
            ("access.json", S.m1_access("novapolis")),
            ("routes_fermeture_axe.json", S.m2_routes("novapolis", "fermeture_axe")),
            ("mst.json", S.m4_mst("novapolis")),
            ("indicateurs.json", S.m5_scenarios("novapolis")),
        ):
            with open(os.path.join(sortie, nom), "w", encoding="utf-8", newline="\n") as f:
                json.dump(objet, f, ensure_ascii=False, indent=2)
            produits.append(f"out/{nom}")
    if not os.path.exists(BENCH_CSV):
        write_csv(run_bench([250, 500, 1000], ["faible", "moyenne"], 5, 42), BENCH_CSV)
        produits.append("reports/bench.csv")
    sys.path.insert(0, os.path.join(S.RACINE, "scripts"))
    import make_figures

    for p in make_figures.main([BENCH_CSV, "--out", FIGURES]):
        produits.append(os.path.relpath(p, S.RACINE).replace("\\", "/"))
    return {"produits": produits, "temps_ms": (time.perf_counter() - t0) * 1000}
