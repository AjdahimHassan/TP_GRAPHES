// Client HTTP typé : TOUS les calculs sont faits par l'API Python (aucun algorithme en JavaScript).
import type {
  AccessResult, BenchResult, DatasetInfo, GenResult, GraphPayload, LabResult, MinHop, MstResult, NegResult, PanneResult, Preset,
  RouteResult, RoutesResult, ScenariosResult, TablePage, Validation,
} from './types'

const enDev = typeof location !== 'undefined' && location.port === '5173'
export const API: string = (import.meta as any).env?.VITE_API ?? (enDev ? 'http://127.0.0.1:8000' : '')

export class ApiError extends Error {
  status: number
  detail: any
  constructor(status: number, message: string, detail?: any) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  let r: Response
  try {
    r = await fetch(API + path, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "API injoignable : lancez « novapolis serve » (port 8000)")
  }
  if (!r.ok) {
    let detail: any = null
    try { detail = await r.json() } catch { /* corps non JSON */ }
    throw new ApiError(r.status, detail?.detail ?? `Erreur ${r.status}`, detail)
  }
  return (await r.json()) as T
}

const q = (o: Record<string, any>) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)) })
  const s = p.toString()
  return s ? '?' + s : ''
}

export interface Ctx { dataset: string; scenario: string; periode?: string | null }

export const api = {
  health: () => req<{ ok: boolean; version: string }>('GET', '/health'),
  datasets: () => req<DatasetInfo[]>('GET', '/datasets'),
  dataset: (id: string) => req<DatasetInfo>('GET', `/datasets/${id}`),
  presets: () => req<Preset[]>('GET', '/datasets/presets'),
  generate: (preset: string, params: any, preview = true, ecraser = false) => req<GenResult>('POST', '/datasets/generate', { preset, params, preview, ecraser }),
  validate: (id: string) => req<Validation>('GET', `/datasets/${id}/validate`),
  graph: (c: Ctx) => req<GraphPayload>('GET', `/datasets/${c.dataset}/graph${q({ scenario: c.scenario, periode: c.periode })}`),
  table: (id: string, nom: string, offset = 0, limit = 50, filtre = '') => req<TablePage>('GET', `/datasets/${id}/tables/${nom}${q({ offset, limit, q: filtre })}`),
  tables: (id: string) => req<Record<string, TablePage>>('GET', `/datasets/${id}/tables`),
  newVersion: (id: string, tables: Record<string, { entete: string[]; lignes: string[][] }>) => req<{ nom: string; validation: Validation; enregistre: boolean }>('POST', `/datasets/${id}/versions`, { tables }),
  appendScenario: (id: string, nom: string, actions: any[]) => req<any>('POST', `/datasets/${id}/scenarios`, { nom, actions }),
  importDataset: (form: FormData) => req<{ nom: string; validation: Validation; enregistre: boolean; fichiers_recus: string[] }>('POST', '/datasets/import', form),
  doc: async (nom: string) => {
    const r = await fetch(API + `/docs-projet/${nom}`)
    if (!r.ok) throw new ApiError(r.status, `Document ${nom} introuvable`)
    return r.text()
  },

  access: (c: Ctx & { sources?: string | string[]; algo?: string; trace?: boolean; seuil?: number; mode?: string }) => req<AccessResult>('POST', '/m1/access', c),
  minhop: (c: Ctx & { u: string; v: string }) => req<MinHop>('POST', '/m1/minhop', c),
  route: (c: Ctx & { demande: string; algo?: string }) => req<RouteResult>('POST', '/m2/route', c),
  routes: (c: Ctx) => req<RoutesResult>('POST', '/m2/routes', c),
  negcycle: (dataset: string, source: string, algo = 'all') => req<NegResult>('POST', '/m3/negcycle', { dataset, source, algo }),
  sandbox: (source: string, arcs: { u: string; v: string; w: number }[], algo = 'all') => req<NegResult>('POST', '/m3/sandbox', { source, arcs, algo }),
  mst: (dataset: string, scenario = 'normal', algo = 'both', trace = false) => req<MstResult>('POST', '/m4/mst', { dataset, scenario, algo, trace }),
  panne: (dataset: string, edge: string, algo = 'kruskal', scenario = 'normal') => req<PanneResult>('POST', '/m4/panne', { dataset, edge, algo, scenario }),
  scenarios: (dataset: string, scenarios?: string[] | null, periode?: string | null, personnalises: any[] = []) => req<ScenariosResult>('POST', '/m5/scenarios', { dataset, scenarios, periode, personnalises }),
  lab: (c: Ctx & { algo: string; source?: string | null; cible?: string | null }) => req<LabResult>('POST', '/lab/run', c),

  benchLatest: () => req<BenchResult>('GET', '/bench/latest'),
  benchStart: (p: { sizes: number[]; densities: string[]; reps: number; seed: number; algos?: string[] | null }) => req<{ id: string }>('POST', '/bench', p),
  benchResult: (id: string) => req<{ etat: string; erreur: string | null; resultat: BenchResult | null }>('GET', `/bench/${id}/result`),
  benchEvents: (id: string) => new EventSource(API + `/bench/${id}/events`),
  repro: () => req<any>('GET', '/repro'),
  regenerate: () => req<{ produits: string[]; temps_ms: number }>('POST', '/repro/regenerate'),
}

export const fileUrl = (id: string, nom: string) => `${API}/datasets/${id}/files/${nom}`
export const zipUrl = (id: string) => `${API}/datasets/${id}/export.zip`
export const figureUrl = (nom: string) => `${API}/figures/${nom}`

/** Télécharge un fichier d'un jeu généré (non enregistré) : l'API le régénère à l'identique. */
export async function downloadGenerated(preset: string, params: any, fichier: string | null, nomFichier: string) {
  const r = await fetch(API + '/datasets/generate/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset, params, fichier }) })
  if (!r.ok) throw new ApiError(r.status, 'Téléchargement impossible')
  saveBlob(await r.blob(), nomFichier)
}

export function saveBlob(blob: Blob, nom: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
