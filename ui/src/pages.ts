import { Activity, BarChart3, Database, Home, Infinity as Inf, Layers, Network, Radar, Repeat, Route, Users } from 'lucide-react'

export interface PageDef { id: string; path: string; t: string; st: string; icon: any; tag?: string; g: string }

export const PAGES: PageDef[] = [
  { id: 'overview', path: '/', t: "Vue d'ensemble", st: 'Tableau de bord du réseau', icon: Home, g: 'Pilotage' },
  { id: 'data', path: '/donnees', t: 'Données & validation', st: 'CSV · validateur · générateur', icon: Database, g: 'Pilotage' },
  { id: 'access', path: '/accessibilite', t: 'Accessibilité', st: 'DFS · BFS · connexité · SCC', icon: Radar, tag: 'M1', g: 'Modules' },
  { id: 'routes', path: '/itineraires', t: 'Itinéraires secours', st: 'Dijkstra · Bellman–Ford · Floyd–Warshall', icon: Route, tag: 'M2', g: 'Modules' },
  { id: 'neg', path: '/circuits', t: 'Circuits absorbants', st: 'Jeux de test à poids négatifs', icon: Inf, tag: 'M3', g: 'Modules' },
  { id: 'fibre', path: '/fibre', t: 'Réseau de fibre', st: 'Kruskal · Prim · Union–Find · panne', icon: Network, tag: 'M4', g: 'Modules' },
  { id: 'scen', path: '/scenarios', t: 'Scénarios & résilience', st: 'Comparaison des indicateurs', icon: Layers, tag: 'M5', g: 'Modules' },
  { id: 'bench', path: '/benchmarks', t: 'Benchmarks', st: 'Mesures vs complexité théorique', icon: BarChart3, g: 'Analyse' },
  { id: 'repro', path: '/reproductibilite', t: 'Reproductibilité', st: 'Commandes · graines · empreintes', icon: Repeat, g: 'Analyse' },
  { id: 'team', path: '/equipe', t: 'Équipe & contributions', st: 'Qui a fait quoi', icon: Users, g: 'Analyse' },
]

export const pageByPath = (p: string) => PAGES.find(x => x.path === p) ?? PAGES[0]
export { Activity }
