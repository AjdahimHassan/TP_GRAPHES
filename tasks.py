"""Tâches du projet, multiplateforme (Windows sans `make` compris).

  python tasks.py install   # dépendances Python (venv conseillé) + npm
  python tasks.py data      # régénère tous les jeux de data/
  python tasks.py test      # pytest
  python tasks.py bench     # benchmarks → reports/bench.csv
  python tasks.py figures   # reports/figures/*.png
  python tasks.py api       # API sur :8000
  python tasks.py ui        # UI de développement sur :5173
  python tasks.py build     # construit l'UI (servie ensuite par l'API, hors ligne)
  python tasks.py demo      # tout : install si besoin, données, build UI, API + navigateur
Le Makefile appelle ces mêmes tâches.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
import webbrowser

RACINE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
NPM = shutil.which("npm") or "npm"


def run(*cmd: str, cwd: str = RACINE) -> None:
    print("$", " ".join(cmd))
    subprocess.run(list(cmd), cwd=cwd, check=True)


def npm_disponible() -> bool:
    return shutil.which("npm") is not None


def install() -> None:
    run(PY, "-m", "pip", "install", "-e", ".[dev]")
    if npm_disponible():
        run(NPM, "install", "--no-audit", "--no-fund", cwd=os.path.join(RACINE, "ui"))
    else:
        print("npm introuvable : dépendances de l'interface non installées (inutile si ui/dist est déjà construit).")


def data() -> None:
    run(PY, "-m", "novapolis.cli", "data")


def test() -> None:
    run(PY, "-m", "pytest")


def bench() -> None:
    run(PY, "-m", "novapolis.cli", "bench", "--sizes", "250,500,1000,2000,5000", "--reps", "5", "--seed", "42", "--out", "reports/bench.csv")


def figures() -> None:
    if not os.path.exists(os.path.join(RACINE, "reports", "bench.csv")):
        bench()
    run(PY, "scripts/make_figures.py", "reports/bench.csv")


def api() -> None:
    run(PY, "-m", "uvicorn", "novapolis.api.main:app", "--host", "127.0.0.1", "--port", "8000")


def ui() -> None:
    run(NPM, "run", "dev", cwd=os.path.join(RACINE, "ui"))


def build() -> None:
    run(NPM, "run", "build", cwd=os.path.join(RACINE, "ui"))


def demo() -> None:
    try:
        import fastapi  # noqa: F401

        import novapolis  # noqa: F401
    except ImportError:
        install()
    if npm_disponible() and not os.path.isdir(os.path.join(RACINE, "ui", "node_modules")):
        run(NPM, "install", "--no-audit", "--no-fund", cwd=os.path.join(RACINE, "ui"))
    if not os.path.exists(os.path.join(RACINE, "data", "novapolis", "sites.csv")):
        data()
    if not os.path.exists(os.path.join(RACINE, "reports", "bench.csv")):
        figures()
    if npm_disponible():
        build()
    elif os.path.exists(os.path.join(RACINE, "ui", "dist", "index.html")):
        print("npm introuvable : on réutilise l'interface déjà construite (ui/dist).")
    else:
        sys.exit("npm introuvable et ui/dist absent : installez Node.js (≥ 18) puis relancez « python tasks.py demo ».")
    serveur = subprocess.Popen([PY, "-m", "uvicorn", "novapolis.api.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=RACINE)
    time.sleep(2.5)
    webbrowser.open("http://127.0.0.1:8000/")
    print("Novapolis : http://127.0.0.1:8000/  (Ctrl+C pour arrêter)")
    try:
        serveur.wait()
    except KeyboardInterrupt:
        serveur.terminate()


TACHES = {f.__name__: f for f in (install, data, test, bench, figures, api, ui, build, demo)}

if __name__ == "__main__":
    nom = sys.argv[1] if len(sys.argv) > 1 else ""
    if nom not in TACHES:
        print(__doc__)
        sys.exit(1)
    TACHES[nom]()
