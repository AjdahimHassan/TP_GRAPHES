# Jeu « mini » — résultats attendus calculés à la main

Ce jeu (8 sites, 14 arcs, 10 tronçons) est **synthétique** et conçu pour être vérifié sur papier.
Chaque valeur ci-dessous est vérifiée automatiquement par `tests/test_mini_expected.py`.

## 1. Données

Ordre des sites (= indices internes 0…7) : `C1, C2, H1, E1, T1, Q1, Q2, Q3`.

| Arc | normal | pointe | statut | poids retenu (normal / pointe) |
|---|---|---|---|---|
| C1→Q1, Q1→C1 | 4 | 6 | ouvert | 4 / 6 |
| Q1→H1, H1→Q1 | 3 | 5 | ouvert | 3 / 5 |
| C1→E1 | 7 | 9 | ouvert | 7 / 9 |
| H1→E1 | 2 | 3 | ouvert (sens unique) | 2 / 3 |
| H1→Q2, Q2→H1 | 5 | 8 | ouvert | 5 / 8 |
| Q2→T1, T1→Q2 | 2 | 3 | ouvert | 2 / 3 |
| C2→T1, T1→C2 | 6 | 9 | ouvert | 6 / 9 |
| C2→Q2 | 6 | 7 | **travaux** (×1,5) | **9 / 10,5** |
| Q1→E1 | 1 | 2 | **fermé** | retiré |

`Q3` n'a **aucun** arc ni tronçon : site isolé (cas limite). `E1` n'a aucun arc sortant (puits).

Listes d'adjacence (ordre du fichier) :
`C1:[Q1,E1]  Q1:[C1,H1]  H1:[Q1,E1,Q2]  E1:[]  Q2:[H1,T1]  T1:[Q2,C2]  C2:[T1,Q2]  Q3:[]`

## 2. Module 1 — parcours

**BFS multi-source depuis {C1, C2}** (les deux sources au niveau 0, file initiale `[C1, C2]`) :

| étape | défile | découvre | file après |
|---|---|---|---|
| 1 | C1 | Q1 (1), E1 (1) | C2 Q1 E1 |
| 2 | C2 | T1 (1), Q2 (1) | Q1 E1 T1 Q2 |
| 3 | Q1 | H1 (2) | E1 T1 Q2 H1 |
| 4–7 | E1, T1, Q2, H1 | — | ∅ |

Ordre : `C1, C2, Q1, E1, T1, Q2, H1` · niveaux : C1 0, C2 0, Q1 1, E1 1, T1 1, Q2 1, H1 2 · **Q3 non atteignable**.

- BFS depuis C1 seul : `C1, Q1, E1, H1, Q2, T1, C2` (niveaux 0, 1, 1, 2, 3, 4, 5).
- DFS depuis C1 (préordre) : `C1, Q1, H1, E1, Q2, T1, C2`.
- Chemin minimal en arcs C1 → C2 : `C1 → Q1 → H1 → Q2 → T1 → C2` (5 arcs, 20 min).
- Chemin minimal en arcs C2 → H1 : `C2 → Q2 → H1` (2 arcs, 9 + 5 = **14 min**) alors que le plus rapide est
  `C2 → T1 → Q2 → H1` (3 arcs, 6 + 2 + 5 = **13 min**) : minimiser les arcs ≠ minimiser le temps.
- Circuit orienté (DFS 3 couleurs depuis C1) : C1 gris → Q1 gris → arc Q1 → C1 vers un sommet gris ⇒ **C1 → Q1 → C1**.
- Composantes fortement connexes : `{C1, Q1, H1, Q2, T1, C2}`, `{E1}` (puits), `{Q3}` → **3 CFC**.
- Composantes faiblement connexes : `{C1, C2, H1, E1, T1, Q1, Q2}`, `{Q3}` → **2**.
- Site isolé : **Q3**. Seuil T = 10 min depuis {C1, C2, H1} : Q1 = 3, Q2 = 5, Q3 = +∞ ⇒ hors délai : **Q3** ;
  avec T = 4 : **Q2, Q3**.

## 3. Module 2 — plus courts chemins (période normale)

Dijkstra depuis C1 (tas `(distance, indice)`) : fixe C1 0, Q1 4, H1 7 (indice 2 < 3), E1 7, Q2 12, T1 14, C2 20.

| depuis | C1 | C2 | H1 | E1 | T1 | Q1 | Q2 | Q3 |
|---|---|---|---|---|---|---|---|---|
| C1 | 0 | 20 | 7 | 7 | 14 | 4 | 12 | +∞ |
| C2 | 20 | 0 | 13 | 15 | 6 | 16 | 8 | +∞ |

Bellman–Ford et Floyd–Warshall donnent **la même matrice** (test `test_trois_algos_identiques`).

Caserne retenue = la plus proche (Dijkstra multi-source depuis {C1, C2}) :

| Demande | site | normal | fermeture_axe (Q1↔H1 fermé) | heure_pointe |
|---|---|---|---|---|
| D1 | Q2 | 8 (C2→T1→Q2) | 8 · +0 | **10,5** (C2→Q2 direct, travaux 7×1,5) · +2,5 (+31,25 %) |
| D2 | E1 | 7 (C1→E1) | 7 · +0 | **9** · +2 (+28,57 %) |
| D3 | Q3 | +∞ inaccessible | +∞ | +∞ |
| D4 | H1 | 7 (C1→Q1→H1) | **13** (C2→T1→Q2→H1) · +6 (+85,71 %) | **11** (C1→Q1→H1, 6+5) · +4 (+57,14 %) |

Fermeture de Q1↔H1 : depuis C1 on n'atteint plus que Q1 et E1 ; H1 est servi par C2.
Fermeture sur l'ancien chemin de D4 : `Q1->H1`.

## 4. Module 4 — fibre

Tronçons disponibles triés (coût, ordre du fichier) — `Q1–E1` est interdit :

| # | tronçon | coût | Kruskal |
|---|---|---|---|
| 1 | Q2–T1 | 5 | ✓ |
| 2 | Q1–H1 | 8 | ✓ |
| 3 | E1–H1 | 8 | ✓ |
| 4 | T1–C2 | 9 | ✓ |
| 5 | C2–Q2 | 9 | ✗ cycle (C2–T1–Q2) |
| 6 | C1–Q1 | 10 | ✓ |
| 7 | C1–E1 | 12 | ✗ cycle |
| 8 | H1–Q2 | 15 | ✓ (relie les deux arbres) |
| 9 | H1–T1 | 30 | ✗ cycle |

- **Kruskal** : {Q2–T1, Q1–H1, E1–H1, T1–C2, C1–Q1, H1–Q2}, coût **55 k€**, forêt de **2** composantes (Q3 seul).
- **Prim** depuis C1 (égalités départagées par ordre d'insertion dans le tas) : C1–Q1, Q1–H1, E1–H1, H1–Q2,
  Q2–T1, puis au coût 9 le tas contient C2–Q2 (inséré en 7ᵉ) avant T1–C2 (8ᵉ) ⇒ **C2–Q2** ; coût **55 k€**.
- Kruskal et Prim : **même coût, ensembles différents** (T1–C2 ↔ C2–Q2). Échange de même coût : ajouter C2–Q2
  crée le cycle C2–T1–Q2 dont l'arête maximale T1–C2 vaut aussi 9 ⇒ plusieurs ACM.
- **Panne H1–Q2** : morceaux {C1, Q1, H1, E1} et {Q2, T1, C2} ; seul candidat disponible : H1–T1 (30)
  ⇒ nouveau coût 55 − 15 + 30 = **70 k€** (Δ **+15**).
- Panne Q2–T1 : raccordement C2–Q2 (9) ⇒ 59 k€ (Δ +4).

## 5. Module 5 — indicateurs

| indicateur | normal | fermeture_axe | panne_fibre | heure_pointe |
|---|---|---|---|---|
| demandes devenues inaccessibles | 0 | 0 | 0 | 0 |
| hausse moyenne (D1, D2, D4) | 0 | (0+0+6)/3 = **2** | 0 | (2,5+2+4)/3 = **2,833** |
| hausse maximale | 0 | **6** | 0 | **4** |
| composantes fibre avant réparation | 2 | 2 | **3** | 2 |
| coût de raccordement | 0 | 0 | **30** | 0 |
| sites sensibles accessibles | 100 % | 100 % | 100 % | 100 % |
