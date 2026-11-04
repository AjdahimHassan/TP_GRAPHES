# Format des données Novapolis

Un jeu de données est un dossier de `data/` contenant 5 fichiers CSV et un `meta.json`.
Encodage **UTF-8 sans BOM**, séparateur `,`, fin de ligne `\n`, première ligne = en-tête.

> **Toutes les données livrées sont SYNTHÉTIQUES** (générées par `novapolis.generator`, graines documentées).
> La ville de Novapolis est fictive ; les coordonnées sont une emprise imaginaire. Aucune donnée réelle n'est utilisée.

## sites.csv

| colonne | type | description |
|---|---|---|
| `id` | texte | identifiant unique (ex. `C-03`, `Q-017`) |
| `nom` | texte | libellé lisible |
| `type` | énum | `hopital`, `caserne`, `ecole`, `telecom`, `quartier` |
| `longitude` | réel | degrés décimaux |
| `latitude` | réel | degrés décimaux |

Sites **sensibles** (indicateur M5) : `hopital`, `caserne`, `ecole`, `telecom`.

## routes.csv (graphe orienté)

| colonne | type | description |
|---|---|---|
| `u`, `v` | id de site | arc **orienté** u → v (une rue à double sens = deux lignes) |
| `temps_normal` | réel ≥ 0 | minutes, période normale |
| `temps_pointe` | réel ≥ 0 | minutes, heure de pointe |
| `statut` | énum | `ouvert`, `ferme` (arc retiré), `travaux` (temps × 1,5 — hypothèse) |
| `type_voie` | texte, *facultatif* | `rue`, `avenue`, `periph`, `pont` (informatif) |
| `capacite` | entier, *facultatif* | véhicules/heure (informatif, non utilisé par les algorithmes) |

Les temps négatifs sont **interdits**, sauf si `meta.json` contient `"allow_negative": true` (jeux de test M3 uniquement).

## fibre.csv (graphe non orienté)

| colonne | type | description |
|---|---|---|
| `u`, `v` | id de site | tronçon **non orienté** u – v |
| `cost` | réel ≥ 0 | coût de construction en **k€** (arrondi à 5 k€ ⇒ nombreuses égalités) |
| `statut` | énum | `disponible`, `interdit` (zone inondable, emprise refusée), `panne` |

Seuls les tronçons `disponible` sont candidats pour l'arbre couvrant.

## demandes.csv

| colonne | type | description |
|---|---|---|
| `id` | texte | identifiant unique (ex. `D-07`) |
| `origine` | id de site | lieu de l'incident |
| `type` | texte | Incendie, Malaise, Accident, Fuite de gaz, Effondrement, Inondation |
| `priorite` | 1, 2, 3 | 1 = la plus urgente |

Caserne d'intervention = la caserne de **temps de trajet minimal** vers le site (Dijkstra multi-source depuis toutes les casernes).

## scenarios.csv

Chaque ligne décrit **une modification appliquée à une copie** des données ; le jeu de base n'est jamais modifié.

| colonne | description |
|---|---|
| `scenario` | nom du scénario (plusieurs lignes peuvent former un même scénario) |
| `cible` | `route`, `fibre` ou `site` (vide si `action = aucune`) |
| `u`, `v` | extrémités (ou `*` = tous les sites) ; pour `cible = site`, seul `u` est utilisé |
| `action` | `aucune`, `fermer`, `ouvrir`, `travaux`, `modifier_temps`, `multiplier_temps`, `panne`, `interdire` |
| `valeur` | nouveau temps (`modifier_temps`) ou facteur (`multiplier_temps`) |
| `periode` | `normal` ou `pointe` : période de calcul du scénario |

Effets : `route + fermer` → statut `ferme` ; `route + travaux` → statut `travaux` ; `fibre + panne/interdire` → tronçon exclu ;
`site + fermer` → tous les arcs entrants et sortants du site fermés ; `site + panne` → tous ses tronçons en panne.

Scénarios générés pour le jeu réaliste : `normal`, `fermeture_axe` (ponts centraux, deux sens), `panne_fibre`
(tronçon critique de l'ACM), `heure_pointe`, `zone_travaux` (chantier autour de la caserne centrale), `crue_nova`
(sites riverains coupés).

## meta.json

| clé | description |
|---|---|
| `nom`, `description` | identification |
| `synthetique` | `true` pour toutes les données générées |
| `generateur`, `preset`, `graine`, `parametres` | reproduction exacte (`novapolis generate …`) |
| `allow_negative` | `true` uniquement pour `negatif_accessible` / `negatif_inaccessible` |
| `sha256` | empreinte de chaque CSV |
| `sha256_base` | empreinte des **données de base** (sites, routes, fibre, demandes) affichée dans l'UI |

## Erreurs détectées par le validateur (`novapolis validate`)

Erreurs : fichier obligatoire absent, colonne manquante, identifiant vide ou dupliqué, site inexistant référencé par
un arc / tronçon / demande / scénario, type ou statut inconnu, valeur non numérique, temps ou coût négatif hors jeu de test,
priorité hors {1, 2, 3}, action / cible / période inconnue.
Avertissements : boucle u → u, arc ou tronçon parallèle dupliqué, colonne non documentée, scénario sans effet.
Chaque message cite le fichier, la ligne, la colonne et la valeur.
