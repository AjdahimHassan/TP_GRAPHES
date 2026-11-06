@echo off
rem Novapolis Resilience : lance l'API et l'interface pour la soutenance.
rem Double-cliquer ce fichier, ou l'appeler depuis n'importe quel dossier.
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo [Novapolis] Environnement .venv introuvable : suivez l'installation du README.
  pause
  exit /b 1
)
if not exist "ui\dist\index.html" (
  echo [Novapolis] Interface non construite : lancez une fois "npm --prefix ui run build".
  pause
  exit /b 1
)
echo.
echo   Novapolis Resilience : http://127.0.0.1:8000
echo   Pour arreter : Ctrl+C dans cette fenetre.
echo.
if not defined NOVAPOLIS_NO_BROWSER start "" /b cmd /c "ping -n 4 127.0.0.1 >nul & start http://127.0.0.1:8000/"
".venv\Scripts\python.exe" -m uvicorn novapolis.api.main:app --host 127.0.0.1 --port 8000
if errorlevel 1 (
  echo.
  echo [Novapolis] Le serveur s'est arrete sur une erreur : le port 8000 est peut-etre deja utilise par une autre fenetre.
  pause
)
