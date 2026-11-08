# Relevé des contributions

| Membre | Modules principaux | Fichiers | Tests / livrables |
|---|---|---|---|
| Hassan AJDAHIM | Développement : modules M1 à M5, données, CLI, API et interface | `novapolis/`, `tests/`, `scripts/`, `data/`, `ui/` | Code source, tests automatisés, jeux de données, README ; rapport : modélisation, architecture |
| Andreja JOVANOVIC | Théorie M1, M2, M3 : parcours, connexité, plus courts chemins, circuits absorbants | `reports/` (problème, M1, M2, M3), `data/mini/EXPECTED.md` (M1 à M3) | Vérification à la main de M1 à M3 sur le jeu `mini` ; rapport : problème, M1, M2, M3 |
| Angelo CUNHA VELHO MACHADO | Théorie M4, M5, benchmarks : arbres couvrants, résilience, analyse des mesures | `reports/` (M4, M5, expériences, limites), `data/mini/EXPECTED.md` (M4, M5) | Vérification à la main de M4 et M5 sur le jeu `mini`, analyse des benchmarks ; rapport : M4, M5, expériences, limites |

## Détail du travail théorique

**Hassan AJDAHIM**

- Justification des structures de données et de l'architecture logicielle.

**Andreja JOVANOVIC**

- Différence entre accessibilité depuis une source, connexité faible et connexité forte.
- Plus courts chemins : pourquoi Dijkstra exige des poids non négatifs, comparaison avec Bellman–Ford et Floyd–Warshall, complexités.
- Circuits absorbants : détection, accessibilité depuis la source, distances égales à −∞.

**Angelo CUNHA VELHO MACHADO**

- Arbres couvrants : pourquoi plusieurs arbres minimaux peuvent exister, Union–Find et complexité, réparation après une panne.
- Résilience : lecture des indicateurs pour chaque scénario, limites du modèle, recommandations.
- Benchmarks : comparaison des mesures aux complexités théoriques et discussion des écarts.
