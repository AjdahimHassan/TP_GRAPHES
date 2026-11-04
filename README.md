# Novapolis Résilience

Projet intégrateur EFREI — *Algorithmique et théorie des graphes* (ING-APP1-BDML).
Outil reproductible pour : (1) diagnostiquer l'accessibilité des quartiers depuis les casernes et hôpitaux,
(2) recommander des itinéraires de secours quand des routes sont fermées, (3) concevoir un réseau de fibre
à coût minimal et le réparer en cas de panne.

> **Données synthétiques.** Novapolis est une ville fictive : tous les jeux de `data/` sont générés par
> `novapolis/generator.py` avec des graines documentées (badge « SYNTHÉTIQUE » dans l'UI).

- **Cœur Python pur** (bibliothèque standard) : DFS, BFS, Tarjan, Dijkstra, Bellman–Ford, Floyd–Warshall, Kruskal,
  Prim, Union–Find, détection de circuits — tous écrits à la main. `networkx` n'est utilisé **que dans les tests**.
- **CLI** (Typer + Rich), **API** (FastAPI), **UI** (React + deck.gl + ECharts + Cytoscape) : l'UI n'exécute aucun
  algorithme en JavaScript, elle appelle l'API ⇒ CLI et UI donnent exactement les mêmes nombres.
- Les scénarios sont appliqués à une **copie profonde** ; l'empreinte SHA-256 de la base est affichée avant et après.

## Installation

Prérequis : Python ≥ 3.11 et Node.js ≥ 18 (avec npm). Toutes les commandes se lancent depuis le dossier du projet.

**1. Créer l'environnement virtuel Python** (une seule fois) :

```bash
python -m venv .venv
```

**2. L'activer** (à chaque nouveau terminal) — la commande dépend du terminal :

| Terminal | Commande |
|---|---|
| Invite de commandes Windows (cmd) | `.venv\Scripts\activate` |
| PowerShell | `.venv\Scripts\Activate.ps1` |
| Git Bash | `source .venv/Scripts/activate` |
| Linux / macOS | `source .venv/bin/activate` |

Le préfixe `(.venv)` apparaît alors devant l'invite. Sous PowerShell, si l'activation est refusée (« l'exécution de
scripts est désactivée »), lancer une fois `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**3. Installer les dépendances** (une seule fois) :

```bash
pip install -e ".[dev]"
npm --prefix ui install
```

**4. Tout lancer** (génère les données si besoin, construit l'UI, démarre l'API et ouvre le navigateur sur
http://127.0.0.1:8000) :

```bash
python tasks.py demo
```

`python tasks.py demo` fait aussi les étapes 3 si elles manquent. Sous Linux/macOS, `make demo` est équivalent.
Pour arrêter : Ctrl+C dans le terminal.

Autres cibles : `make data | test | bench | figures | api | ui | build` (= `python tasks.py <cible>`).
En développement : `novapolis serve` (API :8000) puis `npm --prefix ui run dev` (UI :5173).
Une fois `ui/dist` construit, l'API sert aussi l'interface sur http://127.0.0.1:8000 (fonctionne hors ligne : polices
embarquées, aucun fond de carte externe).

## Commandes (fichier + scénario + opération)

```bash
novapolis validate   --data data/novapolis
novapolis access     --data data/novapolis --sources casernes --scenario normal
novapolis access     --data data/novapolis --mode scc
novapolis minhop     --data data/mini --from C2 --to H1
novapolis cycles     --data data/mini
novapolis route      --data data/novapolis --demande D-07 --algo all --scenario fermeture_axe
novapolis routes     --data data/novapolis --scenario fermeture_axe --export out/routes.csv
novapolis negcycle   --data data/negatif_accessible --source S --algo bellman-ford
novapolis negcycle   --data data/negatif_inaccessible --source S --algo all
novapolis mst        --data data/novapolis --algo both
novapolis mst-panne  --data data/mini --edge H1-Q2
novapolis scenarios  --data data/novapolis --all --export out/indicateurs.csv
novapolis generate   --preset realiste --seed 42 --out data/novapolis_s42
novapolis generate   --preset benchmark --n 1000 --density 0.004 --seed 42 --out data/generes/n1000_d004
novapolis data       # régénère tous les jeux livrés
novapolis bench      --sizes 250,500,1000,2000,5000 --reps 5 --seed 42 --out reports/bench.csv
python scripts/make_figures.py reports/bench.csv
novapolis serve      # API sur :8000
```

Options communes : `--periode normal|pointe` (impose la période avant ET après), `--export fichier.csv|.json`.
Une distance qui peut diminuer indéfiniment est affichée **−∞**, jamais comme un nombre fini.

## Jeux de données (`data/`)

| Jeu | Contenu | Graine |
|---|---|---|
| `mini` | 8 sites vérifiables à la main — résultats attendus dans `data/mini/EXPECTED.md` | — |
| `negatif_accessible` | Test M3 · A : circuit A → B → C → A (−1) accessible depuis S | — |
| `negatif_inaccessible` | Test M3 · B : circuit C → D → E → C (−1) non accessible depuis S | — |
| `novapolis` | 150 sites (6 casernes, 4 hôpitaux, 12 écoles, 5 télécom), rivière « la Nova » et 6 ponts, périphérique, sens uniques, travaux, 40 demandes, 6 scénarios | 42 |
| `generes/n{1000,2000,5000}_{faible,moyenne,forte}` | benchmarks, degré moyen visé 3 / 6 / 12 | 42 |

Format détaillé : [`data/SCHEMA.md`](data/SCHEMA.md). Même graine + mêmes paramètres ⇒ fichiers identiques octet par
octet depuis l'UI ou la CLI (lignes triées, nombres formatés de façon fixe, `\n`, UTF-8 sans BOM — vérifié par pytest).

## Choix des structures de données

| Structure | Où | Pourquoi |
|---|---|---|
| Listes d'adjacence `adj[u] = [Edge(v, w, clé)]` (indices 0…n−1, équivalent d'un `dict[int, list[Edge]]` à clés contiguës) | DFS, BFS, Tarjan, Dijkstra, Bellman–Ford, Prim | énumérer les successeurs de u en O(deg u) ⇒ parcours en O(V + E) ; mémoire O(V + E) pour des graphes routiers creux |
| Liste d'arêtes `(u, v, coût)` | Kruskal, Bellman–Ford | Kruskal trie toutes les arêtes ; Bellman–Ford relâche tous les arcs à chaque passe |
| Matrice `list[list[float]]` | Floyd–Warshall | accès d[i][k] en O(1) dans la triple boucle ; O(V²) mémoire ⇒ réservé à n ≤ 400 |
| Union–Find (compression de chemin + union par rang) | Kruskal, réparation de panne | test « crée un cycle ? » en O(α(n)) amorti |
| Tas binaire `heapq` (suppression paresseuse) | Dijkstra, Prim | extraction du minimum en O(log V) ⇒ O((V + E) log V) / O(E log V) |
| `deque` | BFS | file FIFO en O(1) aux deux bouts |

Tous les parcours sont **itératifs** (pile explicite) : pas de limite de récursion sur 5 000 sommets ou plus.

## Hypothèses de modélisation

- Coût d'un arc = `temps_normal` ou `temps_pointe` selon la période du scénario ; `ferme` ⇒ arc retiré ;
  `travaux` ⇒ temps × 1,5 ; tronçons de fibre `interdit` / `panne` exclus.
- Caserne d'intervention = celle dont le temps de trajet vers l'incident est minimal (un Dijkstra multi-source depuis
  toutes les casernes). « Avant » = base en période normale ; « après » = scénario dans sa période (sauf `--periode`).
- Coût de raccordement (M5) : on garde l'ACM de base privée des tronçons perdus et on la complète au moindre coût
  (Kruskal amorcé par les arêtes gardées).
- Les poids négatifs n'existent que dans les jeux M3 (`allow_negative: true`) ; le validateur les refuse ailleurs.

## Architecture

```
novapolis/
  model.py             dataclasses + énumérations
  io/                  reader (CSV → modèle), validator (fichier, ligne, colonne), writer (canonique + SHA-256)
  graph/               digraph (routes), ugraph (fibre), scenario (copie profonde + diff)
  algorithms/          traversal, shortest_paths, negative_cycles, union_find, mst, trace (rejeu pas à pas)
  indicators.py        demandes avant/après + 5 indicateurs de résilience
  services.py          une fonction par opération, partagée par la CLI et l'API
  generator.py         générateur de villes reproductible + presets (mini, realiste, benchmark, test_m3_a/b)
  datastudio.py        aperçu / enregistrement / import / versions / scénarios (studio de l'UI)
  bench.py             benchmarks (perf_counter, ≥ 5 répétitions, graines fixes)
  cli.py               Typer + Rich
  api/                 FastAPI (routes datasets, m1…m5, bench SSE, repro)
ui/                    React 18 + TypeScript + Vite + Tailwind + deck.gl + ECharts + Cytoscape + Framer Motion
tests/                 pytest : mini vs EXPECTED.md, networkx (oracle), cas limites, M3, validateur, reproductibilité
scripts/make_figures.py   CSV de benchmarks → figures matplotlib (reports/figures)
```

## Interface graphique

Dix pages (barre latérale) : Vue d'ensemble · Données & validation (studio de génération, import, éditeur de tables,
constructeur de scénario) · Accessibilité M1 (trois notions de connexité, rejeu BFS/DFS, seuil T) · Itinéraires M2
(itinéraire animé, comparaison des 3 algorithmes, avant/après, limites du modèle) · Circuits absorbants M3 (deux
laboratoires + bac à sable) · Réseau de fibre M4 (Kruskal vs Prim, Union–Find pas à pas, étude de panne) ·
Scénarios M5 (5 indicateurs, barres, radar, carte des différences) · Benchmarks (progression SSE) ·
Reproductibilité · Équipe. Contexte global (jeu, scénario, période) dans l'URL ; **Ctrl+K** palette de commandes ;
**Mode démo** : visite guidée en 8 étapes (← / →).

Types TypeScript des requêtes : `npm --prefix ui run gen:types` (openapi-typescript, API démarrée).

## Tests

```bash
pytest            # ou make test
```

144 tests : jeu `mini` comparé aux calculs à la main, 50 graphes aléatoires recoupés avec networkx (Dijkstra =
Bellman–Ford = Floyd–Warshall), MST (Kruskal = Prim = networkx, forêts, égalités), circuits absorbants A/B, cas limites
(graphe vide, un sommet, source = cible, cible inaccessible, boucle, arcs parallèles, tous les arcs fermés, chaîne de
20 000 sommets), validateur (chaque type d'erreur), immuabilité des scénarios, UI = CLI octet par octet.

## Benchmarks

`make bench && make figures` (≈ 20 s) : mêmes graphes pour tous les algorithmes, génération exclue du chronométrage,
5 répétitions, graine 42. Figures : log-log temps vs n (mesure + c·f(V,E) ajustée), temps vs densité,
Floyd–Warshall (n ≤ 400) et rapport mesure/théorie. Pentes mesurées sur la densité moyenne : BFS/DFS ≈ 1,0 ;
Kruskal/Prim/Dijkstra ≈ 1,0–1,1 (théorie ≈ 1,1) ; Floyd–Warshall ≈ 2,9 (théorie 3) ; Bellman–Ford ≈ 1,6 au lieu de 2 car
l'arrêt anticipé stoppe après ≈ diamètre passes (colonne `passes` du CSV).

## Limites

Temps statiques (pas de trafic temps réel), capacité des casernes et incidents simultanés ignorés, facteur travaux
supposé, coûts de fibre synthétiques. Un chemin de coût minimal ne garantit pas une intervention réaliste.

Contributions : [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) · Plan du rapport : [`reports/rapport_plan.md`](reports/rapport_plan.md).
