import { BarChart3, ClipboardCheck, Database, FlaskConical, Home, Infinity as Inf, Layers, Network, Radar, Repeat, Route, Users } from 'lucide-react'

/** n : numéro dans le sommaire · ref : section du sujet couverte · eyebrow : surtitre de la page. */
export interface PageDef { id: string; path: string; n: number; t: string; st: string; icon: any; tag?: string; g: string; ref: string; eyebrow: string }

export const PAGES: PageDef[] = [
  { id: 'overview', path: '/', n: 1, t: "Vue d'ensemble", st: 'Les trois questions de la ville et leurs réponses', icon: Home, g: 'Présentation', ref: '§1', eyebrow: 'Projet intégrateur · Problème métier' },
  { id: 'data', path: '/donnees', n: 2, t: 'Données & validation', st: 'Format CSV, validateur, jeux fournis, générateur reproductible', icon: Database, g: 'Présentation', ref: '§2', eyebrow: 'Réseaux et données' },
  { id: 'access', path: '/accessibilite', n: 3, t: "Diagnostic d'accessibilité", st: 'DFS · BFS · connexité faible et forte · circuits', icon: Radar, tag: 'M1', g: 'Modules du sujet', ref: '§3.1', eyebrow: 'Module 1' },
  { id: 'routes', path: '/itineraires', n: 4, t: 'Itinéraires des secours', st: 'Dijkstra · Bellman–Ford · Floyd–Warshall · avant / après', icon: Route, tag: 'M2', g: 'Modules du sujet', ref: '§3.2', eyebrow: 'Module 2' },
  { id: 'neg', path: '/circuits', n: 5, t: 'Circuits absorbants', st: 'Jeux de test à poids négatifs (artificiels)', icon: Inf, tag: 'M3', g: 'Modules du sujet', ref: '§3.3', eyebrow: 'Module 3' },
  { id: 'fibre', path: '/fibre', n: 6, t: 'Réseau de fibre', st: 'Kruskal · Prim · Union–Find · étude de panne', icon: Network, tag: 'M4', g: 'Modules du sujet', ref: '§3.4', eyebrow: 'Module 4' },
  { id: 'scen', path: '/scenarios', n: 7, t: 'Résilience & scénarios', st: 'Cinq indicateurs comparés sur six scénarios', icon: Layers, tag: 'M5', g: 'Modules du sujet', ref: '§3.5', eyebrow: 'Module 5' },
  { id: 'lab', path: '/laboratoire', n: 8, t: 'Algorithmes en direct', st: 'Choisir un algorithme et ses paramètres, le voir tourner pas à pas', icon: FlaskConical, g: 'Analyse', ref: '§3', eyebrow: 'Laboratoire' },
  { id: 'bench', path: '/benchmarks', n: 9, t: 'Expériences & benchmarks', st: 'Temps mesurés vs complexités théoriques', icon: BarChart3, g: 'Analyse', ref: '§5', eyebrow: 'Pour aller plus loin' },
  { id: 'repro', path: '/reproductibilite', n: 10, t: 'Reproductibilité', st: 'Chaque résultat → sa commande, ses graines, ses empreintes', icon: Repeat, g: 'Analyse', ref: '§6', eyebrow: 'Livrables' },
  { id: 'team', path: '/equipe', n: 11, t: 'Équipe & contributions', st: 'Relevé des contributions de chaque membre', icon: Users, g: 'Analyse', ref: '§6', eyebrow: 'Livrables' },
  { id: 'bilan', path: '/bilan', n: 12, t: 'Bilan & conformité', st: 'Grille d’évaluation, limites et recommandations', icon: ClipboardCheck, g: 'Analyse', ref: '§6 – §7', eyebrow: 'Conclusion' },
]

export const pageByPath = (p: string) => PAGES.find(x => x.path === p) ?? PAGES[0]
