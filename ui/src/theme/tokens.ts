// Jetons de design (cf. maquette.html) — même couleur + même icône pour un type de site partout.
export const C = {
  bg: '#070B16', s1: '#0E1527', s2: '#131C33', s3: '#18233F', bd: '#1E2A47', bd2: '#2A3A60',
  tx: '#E7ECF5', mu: '#8592AE', mu2: '#5D6A88',
  red: '#FF5468', amb: '#FFB547', cy: '#2EE6D6', ok: '#3DDC97', ko: '#FF4D4D', info: '#7C8CFF',
}

export const TYPE_COLOR: Record<string, string> = {
  hopital: '#FF5468', caserne: '#FF9F43', ecole: '#FFD166', telecom: '#A78BFA', quartier: '#5B6B8F',
}
export const TYPE_LABEL: Record<string, string> = {
  hopital: 'Hôpital', caserne: 'Caserne', ecole: 'École', telecom: 'Télécom', quartier: 'Quartier',
}
export const TYPE_LETTER: Record<string, string> = { hopital: 'H', caserne: 'C', ecole: 'E', telecom: 'T', quartier: 'Q' }

export const SCEN_COLOR = ['#3DDC97', '#FF5468', '#2EE6D6', '#FFB547', '#A78BFA', '#7C8CFF', '#FF9F43', '#FFD166']

export const SCEN_LABEL: Record<string, string> = {
  normal: 'Normal',
  fermeture_axe: 'Fermeture axe',
  panne_fibre: 'Panne fibre',
  heure_pointe: 'Heure de pointe',
  zone_travaux: 'Zone de travaux',
  crue_nova: 'Crue de la Nova',
}
export const scenLabel = (s: string) => SCEN_LABEL[s] ?? s.replace(/_/g, ' ')

export const ALGO_COLOR: Record<string, string> = {
  bfs: '#3DDC97', dfs: '#7C8CFF', kruskal: '#2EE6D6', prim: '#A78BFA', dijkstra: '#FFB547', bellman_ford: '#FF5468', floyd_warshall: '#FF9F43',
}
export const ALGO_LABEL: Record<string, string> = {
  bfs: 'BFS', dfs: 'DFS', kruskal: 'Kruskal', prim: 'Prim', dijkstra: 'Dijkstra', bellman_ford: 'Bellman–Ford', floyd_warshall: 'Floyd–Warshall',
  tarjan: 'Tarjan', cycle: 'DFS 3 couleurs', dijkstra_seuil: 'Dijkstra (seuil)',
}

export function hexToRgb(hex: string, a = 255): [number, number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a]
}
