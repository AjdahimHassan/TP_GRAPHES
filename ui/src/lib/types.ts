// Types des réponses de l'API (les requêtes sont aussi décrites dans openapi.d.ts, généré par `npm run gen:types`).
// Les infinis arrivent sous forme de chaînes « +inf » / « -inf ».
export type Num = number | '+inf' | '-inf' | null

export interface SiteP { id: string; nom: string; type: string; lon?: number; lat?: number; x: number; y: number }
export interface RouteP { u: string; v: string; temps_normal?: number; temps_pointe?: number; statut: string; statut_base?: string; type_voie?: string }
export interface FibreP { u: string; v: string; cost?: number; statut: string; statut_base?: string; cle?: number }
export interface DiffP { cible: string; u: string; v: string; champ: string; avant: string; apres: string }

export interface GraphPayload {
  dataset: string; scenario: string; periode: string; synthetique: boolean; allow_negative: boolean; meta: Record<string, any>
  sites: SiteP[]; routes: RouteP[]; fibre: FibreP[]
  demandes: { id: string; origine: string; type: string; priorite: number }[]
  scenarios: string[]; decor: { riviere?: [number, number][] }; diff: DiffP[]
  hash_avant: string; hash_apres: string; base_inchangee: boolean
}

export interface DatasetInfo {
  id: string; groupe?: string; synthetique?: boolean; allow_negative?: boolean; description?: string; preset?: string; graine?: number | null
  hash?: string; fichiers?: Record<string, number>; erreurs?: number; avertissements?: number; statut_fichiers?: Record<string, string>; erreur?: string
  scenarios?: string[]; demandes?: string[]
}

export interface Issue { gravite: string; fichier: string; ligne: number | null; colonne: string; valeur: string; message: string }
export interface Validation { ok: boolean; errors: Issue[]; warnings: Issue[]; stats: Record<string, number> }

export interface TraceEvent { type: string; sommet?: number; depuis?: number; niveau?: number; file?: number[]; pile?: number[]; arete?: number; acceptee?: boolean; cout?: number; uf?: number[] | null; label?: string; tas?: number; u?: number; v?: number; dist?: number }
export interface Trace { events: TraceEvent[]; tronque: boolean; n: number }

export interface AccessResult {
  dataset: string; scenario: string; periode: string; algo: string; sources: string[]; ordre: string[]
  niveau: Record<string, number>; parent: Record<string, string | null>; atteignables: number; total: number; non_atteignables: string[]; niveau_max: number
  scc: string[][]; scc_index: Record<string, number>; nb_scc: number; plus_grande_scc: number
  faible: string[][]; faible_index: Record<string, number>; nb_faible: number
  fibre_composantes: string[][]; fibre_index: Record<string, number>; nb_fibre: number
  cycle: string[] | null; isoles: string[]; non_atteignables_secours: string[]; seuil: number
  temps_secours: Record<string, Num>; hors_delai: { id: string; temps: Num }[]
  temps_ms: Record<string, number>; trace: Trace | null; hash_avant: string; hash_apres: string; base_inchangee: boolean
}

export interface MinHop { u: string; v: string; chemin: string[] | null; arcs: number | null; duree: Num; chemin_plus_rapide: string[]; duree_plus_rapide: Num; temps_ms: number }

export interface RouteRow {
  demande: string; type: string; priorite: number; site: string; caserne_avant: string | null; caserne_apres: string | null
  avant: Num; apres: Num; retard: number | null; retard_pct: number | null; statut_avant: string; statut: string
  chemin_avant: string[]; chemin: string[]; arcs: number | null; arcs_avant: number | null
  fermetures_sur_chemin_initial: string[]; fermetures_proches: string[]
}
export interface RoutesResult {
  dataset: string; scenario: string; periode: string; lignes: RouteRow[]
  resume: { demandes: number; accessibles: number; inaccessibles: number; temps_moyen: number | null; retard_moyen: number; retard_max: number }
  fermetures: DiffP[]; temps_ms: number; hash_avant: string; hash_apres: string; base_inchangee: boolean
}
export interface AlgoRun { algo: string; dist: Num; chemin: string[]; caserne?: string | null; arcs: number | null; temps_ms: number | null; ignore?: boolean; raison?: string; passes?: number }
export interface RouteResult { demande: { id: string; origine: string; type: string; priorite: number }; algos: AlgoRun[]; identiques: boolean; avant_apres: RouteRow; periode: string; hash_avant: string; hash_apres: string; base_inchangee: boolean }

export interface NegRes { algo: string; existe: boolean; accessible: boolean; cycle: string[]; poids_cycle: number | null; dist: Record<string, Num>; message: string; temps_ms: number; passes?: number; marques?: string[]; sur_cycle?: string[] }
export interface NegResult { dataset?: string; source: string; sommets: string[]; arcs: { u: string; v: string; w: number }[]; resultats: NegRes[]; identiques?: boolean; allow_negative?: boolean }

export interface EdgeD { eid: number; cle: number; u: string; v: string; cost: number; label: string }
export interface MstAlgo { aretes: EdgeD[]; cout: number; nb_aretes: number; composantes: number; temps_ms: number; trace: Trace | null }
export interface MstResult {
  dataset: string; scenario: string; n: number; candidats: number; kruskal?: MstAlgo; prim?: MstAlgo
  cout_identique?: boolean; meme_ensemble?: boolean; diff_kruskal?: EdgeD[]; diff_prim?: EdgeD[]
  egalites: { couts_egaux_dans_arbre: Record<string, number>; echange: { ajouter: EdgeD; retirer: EdgeD; cout: number; cycle: EdgeD[] } | null; unique: boolean }
  composantes: string[][]; non_raccordes: string[][]; exclus: { u: string; v: string; cost: number; statut: string }[]
  hash_avant: string; hash_apres: string; base_inchangee: boolean
}
export interface PanneResult { coupee: EdgeD; raccordement: EdgeD | null; reconnecte: boolean; cout_initial: number; nouveau_cout: number; delta: number; composante_u: string[]; composante_v: string[]; temps_ms: number }

export interface ScenarioInd {
  scenario: string; periode: string; demandes: number; demandes_inaccessibles: number; demandes_devenues_inaccessibles: number
  hausse_moyenne: number; hausse_max: number; composantes_fibre: number; composantes_fibre_avant_reparation: number
  cout_reparation: number; raccordements: string[]; troncons_perdus: string[]; part_sensibles_accessibles: number
  sensibles_accessibles: number; sensibles_total: number; nb_modifications: number; diff: DiffP[]
  hash_avant: string; hash_apres: string; base_inchangee: boolean; personnalise?: boolean
}
export interface ScenariosResult { dataset: string; scenarios: ScenarioInd[]; hash_fichiers_avant: string; hash_fichiers_apres: string; base_inchangee: boolean; temps_ms: number }

export interface BenchRow { algo: string; n: number; densite: string; degre_moyen: number; V: number; E: number; reps: number; moyenne_ms: number; ecart_type_ms: number; min_ms: number; max_ms: number; passes: number | null; graine: number }
export interface BenchAna { algo: string; nom: string; complexite: string; densite: string; pente_mesuree: number; pente_theorique: number; constante_ms: number; points: { n: number; V: number; E: number; mesure: number; theorie: number }[] }
export interface BenchResult { lignes: BenchRow[]; analyse: BenchAna[]; commentaires: string[]; complexites: Record<string, string>; noms: Record<string, string>; vide?: boolean }

export interface GenResult {
  nom: string; preset: string; params: Record<string, any>; commande: string
  stats: { sites: number; arcs: number; arcs_actifs: number; troncons: number; troncons_disponibles: number; degre_moyen: number; composantes_fibre: number; nb_scc: number; demandes: number; scenarios: number; par_type: Record<string, number> }
  validation: Validation; fichiers: { nom: string; lignes: number | null; octets: number; apercu: string }[]
  sha256_base: string; carte: { sites: SiteP[]; routes: RouteP[]; fibre: FibreP[]; decor: { riviere?: [number, number][] } } | null
  enregistre: boolean; existe: boolean; chemin?: string
}
export interface Preset { id: string; label: string; params: Record<string, any> }
export interface TablePage { fichier: string; entete: string[]; total: number; offset: number; lignes: { ligne: number; valeurs: string[] }[] }
