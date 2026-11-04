"""Générateur de villes SYNTHÉTIQUES reproductible (graine fixe) + presets.

Presets :
- mini        : petit jeu écrit à la main (8 sites), vérifiable sur papier (voir data/mini/EXPECTED.md) ;
- realiste    : ≥ 150 sites, rivière « la Nova » franchie par quelques ponts, périphérique, avenues,
                sens uniques, travaux, fibre avec zones inondables, demandes et scénarios ;
- benchmark   : n sites et densité réglables (expériences de performance) ;
- test_m3_a   : circuit absorbant ACCESSIBLE depuis S (poids négatifs artificiels) ;
- test_m3_b   : circuit absorbant NON accessible depuis S.

Reproductibilité : tout l'aléa vient d'un unique `random.Random(graine)` ; les lignes sont triées et
les nombres formatés de façon fixe → même graine + mêmes paramètres ⇒ fichiers identiques octet par octet.
"""

from __future__ import annotations

import math
import random
from dataclasses import asdict, dataclass, field

from novapolis import __version__
from novapolis.model import ActionScenario, Arc, Dataset, Demande, Site, Troncon

VERSION_GENERATEUR = f"novapolis.generator {__version__}"

# Repère abstrait 1000 × 600 unités, projeté sur une emprise fictive (≈ 19 km × 13 km).
W, H = 1000.0, 600.0
LON0, LON_SPAN = 2.21, 0.26
LAT0, LAT_SPAN = 48.905, 0.12
VITESSES = {"rue": 22.0, "avenue": 35.0, "periph": 60.0, "pont": 28.0}  # km/h moyens en ville (hypothèses)
TYPES_INCIDENT = ["Incendie", "Malaise", "Accident", "Fuite de gaz", "Effondrement", "Inondation"]
LIBELLES = {"hopital": "Hôpital", "caserne": "Caserne", "ecole": "École", "telecom": "Centre télécom", "quartier": "Quartier"}
PREFIXES = {"hopital": "H", "caserne": "C", "ecole": "E", "telecom": "T", "quartier": "Q"}


@dataclass
class GenParams:
    nom: str = "novapolis"
    preset: str = "realiste"
    graine: int = 42
    n_sites: int = 150
    casernes: int = 6
    hopitaux: int = 4
    ecoles: int = 12
    telecom: int = 5
    degre_moyen: float = 5.0  # degré moyen visé du graphe routier vu comme non orienté
    densite: float | None = None  # si fourni : degre_moyen = densite × (n − 1)
    sens_unique_pct: float = 10.0
    riviere: bool = True
    ponts: int = 6
    periph: bool = True
    forme: str = "ellipse"  # ellipse | rectangle
    pointe_min: float = 1.25
    pointe_max: float = 1.85
    travaux_pct: float = 3.0
    ferme_pct: float = 0.0
    fibre_couverture_pct: float = 85.0
    fibre_interdite_pct: float = 5.0
    cout_min: float = 30.0
    cout_max: float = 150.0
    demandes: int = 40
    priorites: list[float] = field(default_factory=lambda: [30.0, 45.0, 25.0])  # % P1, P2, P3
    scenarios: list[str] = field(default_factory=lambda: ["fermeture_axe", "panne_fibre", "heure_pointe", "zone_travaux", "crue_nova"])
    site_isole: bool = True
    poids_negatifs: bool = False  # uniquement presets test_m3_a / test_m3_b

    def to_dict(self) -> dict:
        return asdict(self)


PRESETS: dict[str, dict] = {
    "mini": {"nom": "mini", "preset": "mini", "n_sites": 8, "casernes": 2, "hopitaux": 1, "ecoles": 1, "telecom": 1, "demandes": 4},
    "realiste": {"nom": "novapolis", "preset": "realiste"},
    "benchmark": {
        "nom": "n1000_moyenne",
        "preset": "benchmark",
        "n_sites": 1000,
        "casernes": 10,
        "hopitaux": 6,
        "ecoles": 20,
        "telecom": 8,
        "degre_moyen": 6.0,
        "riviere": False,
        "periph": False,
        "forme": "rectangle",
        "demandes": 30,
        "scenarios": ["fermeture_axe", "panne_fibre", "heure_pointe"],
        "site_isole": False,
    },
    "test_m3_a": {"nom": "negatif_accessible", "preset": "test_m3_a", "n_sites": 6, "poids_negatifs": True, "demandes": 0},
    "test_m3_b": {"nom": "negatif_inaccessible", "preset": "test_m3_b", "n_sites": 6, "poids_negatifs": True, "demandes": 0},
}

DENSITES = {"faible": 3.0, "moyenne": 6.0, "forte": 12.0}  # degré moyen visé (benchmarks)


def preset_params(preset: str, **surcharges) -> GenParams:
    if preset not in PRESETS:
        raise KeyError(f"Preset inconnu : {preset} (disponibles : {', '.join(PRESETS)})")
    valeurs = dict(PRESETS[preset])
    valeurs.update({k: v for k, v in surcharges.items() if v is not None})
    return GenParams(**valeurs)


# --- géométrie -----------------------------------------------------------------------------------


def _bezier(p0, p1, p2, p3, pas=100):
    pts = []
    for i in range(pas + 1):
        t = i / pas
        u = 1 - t
        pts.append(
            (
                u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
            )
        )
    return pts


RIVIERE = _bezier((-10, 410), (180, 360), (300, 420), (470, 360)) + _bezier((470, 360), (640, 300), (760, 250), (1010, 270))


def riviere_y(x: float) -> float:
    for i in range(1, len(RIVIERE)):
        if RIVIERE[i][0] >= x:
            x0, y0 = RIVIERE[i - 1]
            x1, y1 = RIVIERE[i]
            return y0 + (y1 - y0) * (x - x0) / ((x1 - x0) or 1)
    return RIVIERE[-1][1]


def _rive_sud(p) -> bool:
    return p[1] > riviere_y(p[0])


def _ellipse(p) -> float:
    return ((p[0] - 500) / 485) ** 2 + ((p[1] - 300) / 290) ** 2


def _lonlat(p) -> tuple[float, float]:
    return round(LON0 + p[0] / W * LON_SPAN, 6), round(LAT0 - p[1] / H * LAT_SPAN, 6)


def _km(a: Site, b: Site) -> float:
    lat = math.radians((a.latitude + b.latitude) / 2)
    dx = (a.longitude - b.longitude) * 111.32 * math.cos(lat)
    dy = (a.latitude - b.latitude) * 110.57
    return math.hypot(dx, dy)


def _points(rng: random.Random, n: int, forme: str) -> tuple[list[tuple[float, float]], float]:
    """Grille jittérée dans la forme, puis on retire les points les plus périphériques pour en garder n."""
    remplissage = math.pi / 4 if forme == "ellipse" else 1.0
    facteur = 1.15
    while True:
        cols = max(2, math.ceil(math.sqrt(n * facteur / remplissage * W / H)))
        rows = max(2, math.ceil(n * facteur / remplissage / cols))
        sx, sy = W / cols, H / rows
        pts = []
        for gy in range(rows):
            for gx in range(cols):
                x = (gx + 0.5) * sx + (rng.random() - 0.5) * 0.7 * sx
                y = (gy + 0.5) * sy + (rng.random() - 0.5) * 0.7 * sy
                if forme != "ellipse" or _ellipse((x, y)) < 1.0:
                    pts.append((x, y))
        if len(pts) >= n:
            break
        facteur *= 1.1
    pts.sort(key=lambda p: (_ellipse(p), p[0], p[1]))  # les plus centraux d'abord
    pts = pts[:n]
    pts.sort(key=lambda p: (round(p[1], 6), round(p[0], 6)))  # ordre de lecture (haut → bas, gauche → droite)
    return pts, (sx + sy) / 2


def _paires_candidates(pts, rayon: float) -> list[tuple[float, int, int]]:
    """Toutes les paires à distance ≤ rayon (grille de hachage spatial), triées par distance."""
    cellule = rayon
    grille: dict[tuple[int, int], list[int]] = {}
    for i, (x, y) in enumerate(pts):
        grille.setdefault((int(x // cellule), int(y // cellule)), []).append(i)
    paires = []
    for (cx, cy), membres in grille.items():
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                autres = grille.get((cx + dx, cy + dy))
                if not autres:
                    continue
                for i in membres:
                    for j in autres:
                        if j <= i:
                            continue
                        d = math.dist(pts[i], pts[j])
                        if d <= rayon:
                            paires.append((d, i, j))
    paires.sort()
    return paires


def _croise(pts, i, j) -> bool:
    return _rive_sud(pts[i]) != _rive_sud(pts[j])


class _UF:
    """Petit Union–Find local (le générateur ne dépend pas du module d'algorithmes pour la topologie)."""

    def __init__(self, n):
        self.p = list(range(n))

    def f(self, x):
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def u(self, a, b):
        a, b = self.f(a), self.f(b)
        if a == b:
            return False
        self.p[max(a, b)] = min(a, b)
        return True


# --- presets écrits à la main ----------------------------------------------------------------------


def _mini(p: GenParams) -> Dataset:
    """Jeu « mini » : toutes les valeurs attendues sont calculées à la main dans EXPECTED.md."""
    S = lambda i, n, t, lo, la: Site(i, n, t, lo, la)  # noqa: E731
    sites = [
        S("C1", "Caserne Nord", "caserne", 2.3, 48.88),
        S("C2", "Caserne Est", "caserne", 2.34, 48.87),
        S("H1", "Hôpital Central", "hopital", 2.32, 48.865),
        S("E1", "École Jaurès", "ecole", 2.305, 48.86),
        S("T1", "Centre Télécom", "telecom", 2.335, 48.86),
        S("Q1", "Quartier Gare", "quartier", 2.315, 48.875),
        S("Q2", "Quartier Rivière", "quartier", 2.33, 48.855),
        S("Q3", "Quartier Isolé", "quartier", 2.29, 48.85),
    ]
    R = lambda u, v, a, b, s="ouvert": Arc(u, v, a, b, s)  # noqa: E731
    routes = [
        R("C1", "Q1", 4, 6), R("Q1", "C1", 4, 6), R("Q1", "H1", 3, 5), R("H1", "Q1", 3, 5),
        R("C1", "E1", 7, 9), R("H1", "E1", 2, 3), R("H1", "Q2", 5, 8), R("Q2", "H1", 5, 8),
        R("Q2", "T1", 2, 3), R("T1", "Q2", 2, 3), R("C2", "T1", 6, 9), R("T1", "C2", 6, 9),
        R("C2", "Q2", 6, 7, "travaux"), R("Q1", "E1", 1, 2, "ferme"),
    ]
    F = lambda u, v, c, s="disponible": Troncon(u, v, c, s)  # noqa: E731
    fibre = [
        F("C1", "Q1", 10), F("Q1", "H1", 8), F("C1", "E1", 12), F("E1", "H1", 8), F("H1", "Q2", 15),
        F("Q2", "T1", 5), F("T1", "C2", 9), F("C2", "Q2", 9), F("Q1", "E1", 20, "interdit"), F("H1", "T1", 30),
    ]
    demandes = [Demande("D1", "Q2", "Incendie", 1), Demande("D2", "E1", "Malaise", 2), Demande("D3", "Q3", "Accident", 1), Demande("D4", "H1", "Fuite de gaz", 3)]
    A = ActionScenario
    scen = [
        A("normal", "", "", "", "aucune", "", "normal"),
        A("fermeture_axe", "route", "Q1", "H1", "fermer", "", "normal"),
        A("fermeture_axe", "route", "H1", "Q1", "fermer", "", "normal"),
        A("panne_fibre", "fibre", "H1", "Q2", "panne", "", "normal"),
        A("heure_pointe", "route", "*", "*", "aucune", "", "pointe"),
    ]
    meta = {
        "nom": p.nom,
        "synthetique": True,
        "description": "Petit graphe vérifiable à la main (voir EXPECTED.md).",
        "generateur": VERSION_GENERATEUR,
        "preset": "mini",
        "graine": None,
        "allow_negative": False,
    }
    return Dataset(p.nom, sites, routes, fibre, demandes, scen, meta)


def _test_m3(p: GenParams, accessible: bool) -> Dataset:
    """Graphes artificiels à poids négatifs (Module 3). Les poids NE SONT PAS des durées."""
    if accessible:
        pos = {"S": (55, 125), "A": (185, 55), "B": (335, 55), "C": (260, 160), "D": (430, 225), "E": (150, 225)}
        arcs = [("S", "A", 2), ("A", "B", 1), ("B", "C", -3), ("C", "A", 1), ("C", "D", 2), ("S", "E", 5), ("E", "D", 4)]
        desc = "Test M3 · A : circuit absorbant A → B → C → A (poids −1) accessible depuis S."
    else:
        pos = {"S": (55, 95), "A": (200, 35), "B": (345, 95), "C": (110, 205), "D": (255, 225), "E": (400, 195)}
        arcs = [("S", "A", 3), ("A", "B", 2), ("S", "B", 6), ("C", "D", 2), ("D", "E", -4), ("E", "C", 1), ("E", "B", 1)]
        desc = "Test M3 · B : circuit absorbant C → D → E → C (poids −1) NON accessible depuis S."
    sites = [Site(k, f"Sommet {k}", "quartier", *_lonlat((x * 2, y * 2))) for k, (x, y) in pos.items()]
    routes = [Arc(u, v, float(w), float(w), "ouvert") for u, v, w in arcs]
    meta = {
        "nom": p.nom,
        "synthetique": True,
        "description": desc + " Jeu de test artificiel : les poids négatifs ne sont pas des durées physiques.",
        "generateur": VERSION_GENERATEUR,
        "preset": p.preset,
        "graine": None,
        "allow_negative": True,
        "source_conseillee": "S",
    }
    scen = [ActionScenario("normal", "", "", "", "aucune", "", "normal")]
    return Dataset(p.nom, sites, routes, [], [], scen, meta)


# --- ville générée -----------------------------------------------------------------------------------


def _fps(rng, candidats: list[int], pts, k: int, deja: list[int]) -> list[int]:
    """Échantillonnage par point le plus éloigné : répartit k sites spéciaux dans la ville."""
    choisis: list[int] = []
    if k <= 0 or not candidats:
        return choisis
    restants = list(candidats)
    premier = restants[rng.randrange(len(restants))]
    choisis.append(premier)
    restants.remove(premier)
    while len(choisis) < k and restants:
        ref = choisis + deja
        meilleur = max(restants, key=lambda i: (min(math.dist(pts[i], pts[j]) for j in ref) if ref else 0, -i))
        choisis.append(meilleur)
        restants.remove(meilleur)
    return choisis


def _quartier_nom(p) -> str:
    x, y = p
    if math.hypot(x - 500, y - 300) < 170:
        return "Centre"
    if abs(x - 500) * 0.6 > abs(y - 300):
        return "Ouest" if x < 500 else "Est"
    return "Nord" if y < 300 else "Sud"


def _ville(p: GenParams) -> Dataset:
    rng = random.Random(p.graine)
    n = max(4, int(p.n_sites))
    degre = p.densite * (n - 1) if p.densite else p.degre_moyen
    degre = max(1.0, degre)
    pts, pas = _points(rng, n, p.forme)

    # 1. site isolé (cas limite) : le point le plus périphérique
    isole = max(range(n), key=lambda i: (_ellipse(pts[i]) if p.forme == "ellipse" else math.dist(pts[i], (500, 300)), -i)) if p.site_isole else -1
    actifs = [i for i in range(n) if i != isole]

    # 2. types de sites (répartis par point le plus éloigné)
    types = ["quartier"] * n
    pris: set[int] = set()
    for t, k in (("caserne", p.casernes), ("hopital", p.hopitaux), ("telecom", p.telecom), ("ecole", p.ecoles)):
        candidats = [i for i in actifs if i not in pris]
        for i in _fps(rng, candidats, pts, min(k, len(candidats)), []):
            types[i] = t
            pris.add(i)

    # 3. paires candidates (routes non orientées) : les plus courtes jusqu'à atteindre le degré visé
    cible = int(round(degre * len(actifs) / 2))
    rayon = pas * (math.sqrt(degre / math.pi * 1.6) + 1.0)
    while True:
        cand = [(d, i, j) for d, i, j in _paires_candidates(pts, rayon) if i != isole and j != isole]
        if len(cand) >= cible or rayon > max(W, H):
            break
        rayon *= 1.3
    ponts: set[tuple[int, int]] = set()
    if p.riviere:
        croisantes = [(d, i, j) for d, i, j in cand if _croise(pts, i, j)]
        for b in range(max(p.ponts, 0)):
            x_cible = W * (b + 0.5) / max(p.ponts, 1)
            meilleur = min(
                croisantes,
                key=lambda c: (abs((pts[c[1]][0] + pts[c[2]][0]) / 2 - x_cible) + 2 * c[0], c[1], c[2]),
                default=None,
            )
            if meilleur:
                ponts.add((meilleur[1], meilleur[2]))
        cand = [c for c in cand if not _croise(pts, c[1], c[2]) or (c[1], c[2]) in ponts]
    choisies: list[tuple[int, int]] = [(i, j) for _, i, j in cand[:cible]]
    choisies_set = set(choisies)
    for b in sorted(ponts):
        if b not in choisies_set:
            choisies.append(b)
            choisies_set.add(b)

    # 4. périphérique : anneau des points extérieurs (sans franchir la rivière)
    periph: set[tuple[int, int]] = set()
    if p.periph and p.forme == "ellipse":
        bord = sorted((i for i in actifs if _ellipse(pts[i]) > 0.72), key=lambda i: math.atan2(pts[i][1] - 300, pts[i][0] - 500))
        for k in range(len(bord)):
            a, b = bord[k], bord[(k + 1) % len(bord)]
            if a == b or math.dist(pts[a], pts[b]) > 3.2 * pas or (p.riviere and _croise(pts, a, b)):
                continue
            paire = (min(a, b), max(a, b))
            periph.add(paire)
            if paire not in choisies_set:
                choisies.append(paire)
                choisies_set.add(paire)

    # 5. connexité : on relie chaque composante isolée à la plus proche (sans franchir la rivière si possible)
    uf = _UF(n)
    for i, j in choisies:
        uf.u(i, j)
    while True:
        groupes: dict[int, list[int]] = {}
        for i in actifs:
            groupes.setdefault(uf.f(i), []).append(i)
        if len(groupes) <= 1:
            break
        petit = min(groupes.values(), key=lambda g: (len(g), g[0]))
        dans = set(petit)
        options = []
        for i in petit:
            for j in actifs:
                if j in dans:
                    continue
                croise = p.riviere and _croise(pts, i, j)
                options.append((croise, math.dist(pts[i], pts[j]), min(i, j), max(i, j)))
        _, _, a, b = min(options)
        choisies.append((a, b))
        choisies_set.add((a, b))
        if p.riviere and _croise(pts, a, b):
            ponts.add((a, b))
        uf.u(a, b)
    choisies.sort()

    # 6. identifiants et sites
    compte = {t: types.count(t) for t in PREFIXES}
    largeur = {t: max(2, len(str(compte[t]))) for t in PREFIXES}
    numero = {t: 0 for t in PREFIXES}
    ids = [""] * n
    for i in range(n):  # numérotation dans l'ordre de lecture de la carte
        t = types[i]
        numero[t] += 1
        ids[i] = f"{PREFIXES[t]}-{numero[t]:0{largeur[t]}d}"
    sites = []
    for i in range(n):
        lon, lat = _lonlat(pts[i])
        num = ids[i].split("-")[1]
        nom = f"{LIBELLES[types[i]]} {num} ({_quartier_nom(pts[i])})" if i != isole else f"{LIBELLES[types[i]]} {num} (isolé)"
        sites.append(Site(ids[i], nom, types[i], lon, lat))

    # 7. arcs routiers orientés
    routes: list[Arc] = []
    centre_h = [i for i in actifs if abs(pts[i][1] - 300) < 0.6 * pas]
    centre_v = [i for i in actifs if abs(pts[i][0] - 500) < 0.6 * pas]
    avenue_pts = set(centre_h) | set(centre_v)
    for i, j in choisies:
        if (i, j) in ponts:
            voie = "pont"
        elif (i, j) in periph:
            voie = "periph"
        elif i in avenue_pts and j in avenue_pts:
            voie = "avenue"
        else:
            voie = "rue"
        km = _km(sites[i], sites[j])
        tn = max(0.1, round(km / VITESSES[voie] * 60 * (0.9 + 0.3 * rng.random()), 2))
        tp = round(tn * (p.pointe_min + (p.pointe_max - p.pointe_min) * rng.random()) * (1.15 if voie == "pont" else 1.0), 2)
        r = rng.random() * 100
        statut = "ouvert"
        if voie not in ("pont", "periph"):
            if r < p.ferme_pct:
                statut = "ferme"
            elif r < p.ferme_pct + p.travaux_pct:
                statut = "travaux"
        cap = {"rue": "600", "avenue": "1200", "periph": "2400", "pont": "1500"}[voie]
        sens = rng.random() * 100
        if voie in ("rue",) and sens < p.sens_unique_pct:
            a, b = (i, j) if rng.random() < 0.5 else (j, i)
            routes.append(Arc(ids[a], ids[b], tn, tp, statut, voie, cap))
        else:
            routes.append(Arc(ids[i], ids[j], tn, tp, statut, voie, cap))
            routes.append(Arc(ids[j], ids[i], tn, tp, statut, voie, cap))

    # 8. fibre : tronçons candidats le long des rues, coût en k€ arrondi à 5 (⇒ égalités fréquentes)
    fibre: list[Troncon] = []
    for i, j in choisies:
        if rng.random() * 100 >= p.fibre_couverture_pct:
            continue
        km = _km(sites[i], sites[j])
        brut = p.cout_min + (p.cout_max - p.cout_min) * min(1.0, km / 2.5) * (0.8 + 0.4 * rng.random())
        cout = float(min(p.cout_max, max(p.cout_min, 5 * round(brut / 5))))
        milieu = ((pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2)
        pres_riviere = p.riviere and abs(milieu[1] - riviere_y(milieu[0])) < 1.2 * pas
        proba = p.fibre_interdite_pct * (3 if pres_riviere else 1)
        statut = "interdit" if rng.random() * 100 < proba else "disponible"
        fibre.append(Troncon(ids[i], ids[j], cout, statut))

    # 9. demandes d'intervention
    centraux = sorted(ponts, key=lambda b: abs((pts[b[0]][0] + pts[b[1]][0]) / 2 - 500))
    nb_fermes = 3 if len(ponts) >= 5 else min(2, len(ponts))
    ponts_centraux = centraux[:nb_fermes]
    eligibles = [i for i in actifs if types[i] != "caserne"]
    demandes_sites: list[int] = []
    if p.site_isole and p.demandes > 0:
        demandes_sites.append(isole)
    # 30 % des incidents parmi les sites les plus pénalisés par la fermeture des ponts centraux
    # (sinon le scénario « fermeture_axe » serait peu informatif) ; le reste est tiré au hasard.
    impact = _impact_fermeture(n, ids, types, routes, {(ids[a], ids[b]) for a, b in ponts_centraux} | {(ids[b], ids[a]) for a, b in ponts_centraux})
    touches = sorted((i for i in eligibles if impact[i] > 1e-9), key=lambda i: (-impact[i], i))
    demandes_sites += touches[: max(0, int(p.demandes * 0.3))]
    reste = [i for i in eligibles if i not in demandes_sites]
    rng.shuffle(reste)
    while len(demandes_sites) < p.demandes and reste:
        demandes_sites.append(reste.pop())
    larg_d = max(2, len(str(len(demandes_sites))))
    tot = sum(p.priorites) or 1
    demandes = []
    for k, s in enumerate(demandes_sites[: p.demandes]):
        r = rng.random() * tot
        prio = 1 if r < p.priorites[0] else (2 if r < p.priorites[0] + p.priorites[1] else 3)
        demandes.append(Demande(f"D-{k + 1:0{larg_d}d}", ids[s], TYPES_INCIDENT[rng.randrange(len(TYPES_INCIDENT))], prio))

    # 10. scénarios
    A = ActionScenario
    scen = [A("normal", "", "", "", "aucune", "", "normal")]
    if "fermeture_axe" in p.scenarios:
        if ponts_centraux:
            for a, b in sorted(ponts_centraux):
                scen.append(A("fermeture_axe", "route", ids[a], ids[b], "fermer", "", "normal"))
                scen.append(A("fermeture_axe", "route", ids[b], ids[a], "fermer", "", "normal"))
        else:  # pas de rivière : on ferme l'axe le plus central (arcs touchant le sommet le plus central)
            c = min(actifs, key=lambda i: (math.dist(pts[i], (500, 300)), i))
            scen.append(A("fermeture_axe", "site", ids[c], "", "fermer", "", "normal"))
    if "panne_fibre" in p.scenarios:
        panne = _troncon_critique(sites, fibre, pts, ids)
        if panne:
            scen.append(A("panne_fibre", "fibre", panne[0], panne[1], "panne", "", "normal"))
    if "heure_pointe" in p.scenarios:
        scen.append(A("heure_pointe", "route", "*", "*", "aucune", "", "pointe"))
    if "zone_travaux" in p.scenarios:
        # chantier autour de la caserne la plus centrale : ralentit ses sorties (temps × 1,5)
        cas = [i for i in actifs if types[i] == "caserne"] or actifs
        centre = pts[min(cas, key=lambda i: (math.dist(pts[i], (500, 300)), i))]
        pos_id = {ids[i]: pts[i] for i in range(n)}
        dans_zone = lambda s: math.dist(pos_id[s], centre) < 1.6 * pas  # noqa: E731
        zone = sorted({(a.u, a.v) for a in routes if dans_zone(a.u) and dans_zone(a.v)})
        for u, v in zone:  # uniquement des arcs existants (les sens uniques ne sont pas dédoublés)
            scen.append(A("zone_travaux", "route", u, v, "travaux", "", "normal"))

    if "crue_nova" in p.scenarios and p.riviere:
        # crue de la Nova : le site riverain le plus exposé portant une demande et l'école la plus
        # proche du fleuve sont coupés (tous leurs arcs fermés)
        bord = lambda i: abs(pts[i][1] - riviere_y(pts[i][0]))  # noqa: E731
        avec_demande = [s for s in demandes_sites[: p.demandes] if s != isole]
        coupes = []
        if avec_demande:
            coupes.append(min(avec_demande, key=lambda i: (bord(i), i)))
        ecoles = [i for i in actifs if types[i] in ("ecole", "telecom") and i not in coupes]
        if ecoles:
            coupes.append(min(ecoles, key=lambda i: (bord(i), i)))
        for i in sorted(coupes, key=lambda i: ids[i]):
            scen.append(A("crue_nova", "site", ids[i], "", "fermer", "", "normal"))

    # 11. tri canonique (reproductibilité octet par octet)
    sites.sort(key=lambda s: s.id)
    routes.sort(key=lambda a: (a.u, a.v))
    fibre.sort(key=lambda t: (t.u, t.v))
    demandes.sort(key=lambda d: d.id)
    meta = {
        "nom": p.nom,
        "synthetique": True,
        "description": "Ville fictive générée (données SYNTHÉTIQUES, aucune donnée réelle).",
        "generateur": VERSION_GENERATEUR,
        "preset": p.preset,
        "graine": p.graine,
        "allow_negative": False,
        "parametres": p.to_dict(),
        "ponts": len(ponts),
        "ponts_centraux_fermes": [f"{ids[a]}-{ids[b]}" for a, b in ponts_centraux],
        "site_isole": ids[isole] if isole >= 0 else None,
    }
    return Dataset(p.nom, sites, routes, fibre, demandes, scen, meta)


def _impact_fermeture(n, ids, types, routes, fermes: set[tuple[str, str]]) -> list[float]:
    """Hausse du temps d'intervention (depuis la caserne la plus proche) si l'on ferme `fermes`."""
    from novapolis.algorithms.shortest_paths import dijkstra
    from novapolis.graph.digraph import DiGraph, arc_weight

    def graphe(exclus):
        g = DiGraph(ids)
        for a in routes:
            if a.statut != "ferme" and (a.u, a.v) not in exclus:
                g.add_arc(g.index[a.u], g.index[a.v], arc_weight(a.temps_normal, a.temps_pointe, a.statut, "normal"))
        return g

    casernes = [i for i in range(n) if types[i] == "caserne"]
    d0 = dijkstra(graphe(set()), casernes).dist
    d1 = dijkstra(graphe(fermes), casernes).dist
    return [(d1[i] - d0[i]) if d0[i] < float("inf") and d1[i] < float("inf") else 0.0 for i in range(n)]


def _troncon_critique(sites, fibre, pts, ids) -> tuple[str, str] | None:
    """Tronçon de l'ACM dont la panne coupe le réseau en deux grosses parties, près du centre,
    et pour lequel un raccordement existe (sinon la panne ne serait pas réparable)."""
    from novapolis.algorithms.mst import kruskal, repair_after_failure
    from novapolis.graph.ugraph import UGraph

    ug = UGraph([s.id for s in sorted(sites, key=lambda s: s.id)])
    for k, t in enumerate(sorted(fibre, key=lambda t: (t.u, t.v))):
        if t.statut == "disponible":
            ug.add_edge(ug.index[t.u], ug.index[t.v], t.cost, k)
    r = kruskal(ug)
    pos = {ids[i]: pts[i] for i in range(len(ids))}
    meilleur, score_max = None, -1e18

    def dist_centre(eid):
        e = ug.edges[eid]
        a, b = pos[ug.ids[e.u]], pos[ug.ids[e.v]]
        return (math.dist(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (500, 300)), eid)

    for eid in sorted(r.aretes, key=dist_centre)[:60]:  # 60 candidats centraux suffisent
        rep = repair_after_failure(ug, r.aretes, eid)
        if not rep["reconnecte"]:
            continue
        e = ug.edges[eid]
        a, b = pos[ug.ids[e.u]], pos[ug.ids[e.v]]
        milieu = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        taille = min(len(rep["composante_u"]), len(rep["composante_v"]))
        score = taille - math.dist(milieu, (500, 300)) / 40
        if score > score_max:
            score_max, meilleur = score, (ug.ids[e.u], ug.ids[e.v])
    return meilleur


def generate(p: GenParams) -> Dataset:
    if p.preset == "mini":
        return _mini(p)
    if p.preset == "test_m3_a":
        return _test_m3(p, accessible=True)
    if p.preset == "test_m3_b":
        return _test_m3(p, accessible=False)
    if p.poids_negatifs:
        raise ValueError("Les poids négatifs ne sont autorisés que dans les presets test_m3_a / test_m3_b")
    return _ville(p)


def cli_command(p: GenParams) -> str:
    """Commande CLI équivalente (affichée dans l'UI)."""
    base = f"novapolis generate --preset {p.preset}"
    if p.preset in ("mini", "test_m3_a", "test_m3_b"):
        return f"{base} --out data/{p.nom}"
    defaut = GenParams(**PRESETS[p.preset])
    morceaux = [base]
    if p.n_sites != defaut.n_sites:
        morceaux.append(f"--n {p.n_sites}")
    if p.densite:
        morceaux.append(f"--density {p.densite}")
    morceaux.append(f"--seed {p.graine}")
    autres = {k: v for k, v in p.to_dict().items() if k not in ("nom", "preset", "graine", "n_sites", "densite") and v != getattr(defaut, k)}
    if autres:
        morceaux.append("--params params.json")
    morceaux.append(f"--out data/{p.nom}")
    return " ".join(morceaux)


# --- jeux standard du projet (make data) -----------------------------------------------------------

GENERES_TAILLES = (1000, 2000, 5000)
GRAINE_GENERES = 42


def standard_datasets() -> list[tuple[str, GenParams]]:
    """(sous-dossier de data/, paramètres) de tous les jeux livrés. Graines documentées ici."""
    jeux = [
        ("mini", preset_params("mini")),
        ("negatif_accessible", preset_params("test_m3_a")),
        ("negatif_inaccessible", preset_params("test_m3_b")),
        ("novapolis", preset_params("realiste", nom="novapolis", graine=42)),
    ]
    for n in GENERES_TAILLES:
        for nom_d, degre in DENSITES.items():
            nom = f"n{n}_{nom_d}"
            p = preset_params(
                "benchmark",
                nom=nom,
                n_sites=n,
                degre_moyen=degre,
                graine=GRAINE_GENERES,
                casernes=max(4, n // 100),
                hopitaux=max(3, n // 160),
                ecoles=max(6, n // 50),
                telecom=max(3, n // 125),
            )
            jeux.append((f"generes/{nom}", p))
    return jeux
