# Plan du rapport (10 pages)

Chaque tableau / figure cite sa commande de régénération (page « Reproductibilité » de l'UI).

## 1. Problème et démarche (≈ 0,5 p.)
Les trois questions de Novapolis ; données **synthétiques** (générateur, graines) ; outil reproductible CLI + API + UI.

## 2. Modélisation et données (≈ 1,5 p.)
- Deux graphes sur les mêmes sites : routier **orienté** pondéré (minutes), fibre **non orienté** pondéré (k€).
- Hypothèses : coût = `temps_normal` ou `temps_pointe` ; `ferme` ⇒ arc retiré ; `travaux` ⇒ × 1,5 ; tronçons `interdit`/`panne` exclus ;
  caserne = la plus rapide (Dijkstra multi-source).
- Format CSV (`data/SCHEMA.md`), validateur (exemples de messages), les 4 familles de jeux (mini, tests M3, réaliste ≥ 150 sites, générés 1 000–5 000).
- **Structures de données** et justification : listes d'adjacence, liste d'arêtes, matrice, Union–Find, tas binaire.

## 3. Architecture (≈ 0,5 p.)
Schéma : `io` → `graph` (+ scénarios sur copie profonde) → `algorithms` → `indicators` → `services` → CLI / API → UI.
Une seule couche `services` ⇒ CLI et UI affichent les mêmes nombres.

## 4. M1 — Accessibilité (≈ 1 p.)
BFS/DFS multi-source, composantes, chemin minimal en arcs, circuits (3 couleurs), Tarjan.
**Trois notions** (accessibilité depuis une source, connexité faible, forte) et l'indicateur qui utilise chacune.
Figure : carte des niveaux BFS ; tableau : CFC, sites isolés, quartiers au-delà de T minutes.

## 5. M2 — Itinéraires (≈ 1,5 p.)
Dijkstra (tas), Bellman–Ford, Floyd–Warshall : mêmes distances (tests croisés, networkx comme oracle).
Tableau avant / après pour toutes les demandes (`novapolis routes --scenario fermeture_axe`), retard absolu et relatif,
fermetures sur / près du chemin. Comparaison des temps d'exécution. **Limites du modèle.**

## 6. M3 — Circuits absorbants (≈ 1 p.)
Graphes A et B, règles de détection (BF passe |V| + propagation ; FW diagonale), circuit extrait, tableau des distances avec −∞.
Point clé : un circuit **non accessible** depuis S laisse les distances finies.

## 7. M4 — Fibre (≈ 1 p.)
Kruskal (Union–Find : compression + rang) vs Prim (tas) : coût identique, ensembles différents en cas d'égalité ;
preuve d'existence de plusieurs ACM (échange de même coût) ; forêt couvrante ; étude de panne et raccordement.

## 8. M5 — Résilience (≈ 1 p.)
Tableau des 5 indicateurs × 6 scénarios (`novapolis scenarios --all`), petits multiples (un panneau par indicateur), discussion.
Preuve d'immuabilité : empreinte SHA-256 de la base avant = après.

## 9. Expériences (≈ 1,5 p.)
Protocole (mêmes graphes, graines, ≥ 5 répétitions, chronométrage de l'algorithme seul).
Figures 1–4 (`reports/figures`), pentes mesurées vs théoriques, constante ajustée, écarts (constantes Python, tas,
cache, arrêt anticipé de Bellman–Ford, coût O(V³) / O(V²) de Floyd–Warshall).

## 10. Limites et recommandations (≈ 0,5 p.)
Données statiques, pas de capacité ni d'incidents simultanés ; recommandations à la ville (ponts critiques,
redondance fibre des tronçons dont la panne coûte le plus, quartiers hors délai).

## Annexes
Commandes exactes, versions, contributions (`CONTRIBUTIONS.md`).
