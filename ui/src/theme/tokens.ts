// Jetons de design — thème clair « papier académique ».
// Les palettes catégorielles sont VALIDÉES (lisibilité, daltonisme, contraste) avec le validateur de palettes :
// on ne choisit pas une couleur « à l'œil ». Une même entité garde la même couleur sur toutes les pages.

export const C = {
  paper: '#F3F1EC', surface: '#FFFFFF', surface2: '#FAF9F6', rule: '#E2DED5', rule2: '#CBC5B8',
  ink: '#131A22', ink2: '#3A434F', muted: '#5F6773', faint: '#8A9099',
  navy: '#1F4E79', navySoft: '#EBF1F8',
  ok: '#17663A', ko: '#A4261D', warn: '#855000',
}

/** Palette catégorielle (8 teintes, ordre fixe — jamais recyclée). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
/** Référence / ligne de base : gris neutre (« rien ne change »). */
export const BASELINE = '#898781'
/** Couleurs d'état (graphiques) : toujours accompagnées d'une icône ou d'un libellé. */
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' }

/** Types de sites — validé « toutes paires » (carte = nuage de points) ; la lettre H/C/E/T sert d'encodage secondaire. */
export const TYPE_COLOR: Record<string, string> = {
  hopital: '#c62828', caserne: '#eda100', ecole: '#1baf7a', telecom: '#6250d6', quartier: '#8a919c',
}
export const TYPE_LABEL: Record<string, string> = {
  hopital: 'Hôpital', caserne: 'Caserne', ecole: 'École', telecom: 'Télécom', quartier: 'Quartier',
}
export const TYPE_LETTER: Record<string, string> = { hopital: 'H', caserne: 'C', ecole: 'E', telecom: 'T', quartier: 'Q' }
/** Couleur du texte posé SUR la pastille d'un type (encre sur le jaune, blanc ailleurs). */
export const TYPE_ON: Record<string, string> = { hopital: '#ffffff', caserne: '#0b0b0b', ecole: '#ffffff', telecom: '#ffffff', quartier: '#ffffff' }

/** Scénario n° i dans l'ordre du jeu (0 = « normal », la référence, en gris neutre). */
export const scenColor = (i: number) => (i <= 0 ? BASELINE : SERIES[i - 1] ?? '#b8b3a8')
/** Compatibilité : liste indexée comme avant (index 0 = référence). */
export const SCEN_COLOR = [BASELINE, ...SERIES]

export const SCEN_LABEL: Record<string, string> = {
  normal: 'Normal',
  fermeture_axe: 'Fermeture axe',
  panne_fibre: 'Panne fibre',
  heure_pointe: 'Heure de pointe',
  zone_travaux: 'Zone de travaux',
  crue_nova: 'Crue de la Nova',
}
export const scenLabel = (s: string) => SCEN_LABEL[s] ?? s.replace(/_/g, ' ')

export const SCEN_DESCR: Record<string, string> = {
  normal: 'Situation nominale — scénario de référence',
  fermeture_axe: 'Les trois ponts centraux sur la Nova fermés dans les deux sens',
  panne_fibre: "Panne d'un tronçon critique de l'arbre de fibre",
  heure_pointe: 'Temps de période de pointe sur tout le réseau',
  zone_travaux: 'Chantier autour de la caserne C-04 (temps × 1,5)',
  crue_nova: 'Sites riverains coupés par la crue de la Nova',
}

export const ALGO_COLOR: Record<string, string> = {
  bfs: SERIES[0], dfs: SERIES[1], kruskal: SERIES[2], prim: SERIES[3], dijkstra: SERIES[4], bellman_ford: SERIES[5], floyd_warshall: SERIES[6],
}
export const ALGO_LABEL: Record<string, string> = {
  bfs: 'BFS', dfs: 'DFS', kruskal: 'Kruskal', prim: 'Prim', dijkstra: 'Dijkstra', bellman_ford: 'Bellman–Ford', floyd_warshall: 'Floyd–Warshall',
  tarjan: 'Tarjan', cycle: 'DFS 3 couleurs', dijkstra_seuil: 'Dijkstra (seuil)',
}
export const ALGO_CPLX: Record<string, string> = {
  bfs: 'O(|V| + |E|)', dfs: 'O(|V| + |E|)', kruskal: 'O(|E| log |E|)', prim: 'O(|E| log |V|)', dijkstra: 'O((|V| + |E|) log |V|)', bellman_ford: 'O(|V|·|E|)', floyd_warshall: 'O(|V|³)',
}

/** Rampe ordinale bleue (clair → foncé) : niveaux BFS. La marche la plus claire reste ≥ 2:1 sur le fond. */
export const LEVEL_RAMP = ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
export const levelColor = (l: number, max: number) => {
  if (l < 0) return STATUS.critical
  const t = max ? Math.min(1, l / max) : 0
  return LEVEL_RAMP[Math.round(t * (LEVEL_RAMP.length - 1))]
}

/** Couleurs de la carte (fond clair). */
export const MAP = {
  path: SERIES[0], before: '#6b7280', alt: SERIES[1], cycle: SERIES[6],
  closed: STATUS.critical, works: '#c98500',
  mst: SERIES[0], repair: SERIES[5], cut: STATUS.critical,
  compA: SERIES[0], compB: SERIES[1],
}

export function hexToRgb(hex: string, a = 255): [number, number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a]
}
