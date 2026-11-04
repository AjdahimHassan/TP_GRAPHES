// Contexte global : jeu, scénario et période (persistés dans les paramètres d'URL), dernier calcul, empreinte.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from './api'
import type { DatasetInfo } from './types'

export interface Toast { id: number; kind: 'error' | 'ok' | 'info'; text: string }

interface Store {
  dataset: string
  scenario: string
  periode: string | null // null = période propre au scénario
  setDataset: (d: string) => void
  setScenario: (s: string) => void
  setPeriode: (p: string | null) => void
  param: (k: string) => string | null
  setParam: (k: string, v: string | null) => void
  runKey: number
  run: () => void
  lastCalc: { label: string; ms: number | null } | null
  setLastCalc: (c: { label: string; ms: number | null }) => void
  hash: { avant: string; apres: string; ok: boolean } | null
  setHash: (h: { avant: string; apres: string; ok: boolean }) => void
  datasets: DatasetInfo[]
  refreshDatasets: () => void
  scenarios: string[]
  setScenarios: (s: string[]) => void
  effectivePeriode: string
  setEffectivePeriode: (p: string) => void
  toasts: Toast[]
  toast: (kind: Toast['kind'], text: string) => void
  apiOk: boolean | null
  demo: number | null
  setDemo: (n: number | null) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sp, setSp] = useSearchParams()
  const [runKey, setRunKey] = useState(0)
  const [lastCalc, setLastCalc] = useState<Store['lastCalc']>(null)
  const [hash, setHash] = useState<Store['hash']>(null)
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [scenarios, setScenarios] = useState<string[]>(['normal'])
  const [effectivePeriode, setEffectivePeriode] = useState('normal')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [demo, setDemo] = useState<number | null>(null)
  const tid = useRef(0)

  const dataset = sp.get('ds') ?? 'novapolis'
  const scenario = sp.get('sc') ?? 'normal'
  const periode = sp.get('p')

  const setParam = useCallback((k: string, v: string | null) => {
    setSp(prev => {
      const n = new URLSearchParams(prev)
      if (v === null || v === '') n.delete(k)
      else n.set(k, v)
      return n
    }, { replace: true })
  }, [setSp])

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++tid.current
    setToasts(t => [...t.slice(-3), { id, kind, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5200)
  }, [])

  const refreshDatasets = useCallback(() => {
    api.datasets().then(setDatasets).catch(() => setDatasets([]))
  }, [])

  useEffect(() => { refreshDatasets() }, [refreshDatasets])

  useEffect(() => {
    let vivant = true
    const ping = () => api.health().then(() => vivant && setApiOk(true)).catch(() => vivant && setApiOk(false))
    ping()
    const t = setInterval(ping, 8000)
    return () => { vivant = false; clearInterval(t) }
  }, [])

  const value = useMemo<Store>(() => ({
    dataset, scenario, periode,
    setDataset: d => setSp(prev => { const n = new URLSearchParams(prev); n.set('ds', d); n.delete('sc'); n.delete('d'); n.delete('site'); return n }, { replace: true }),
    setScenario: s => setParam('sc', s === 'normal' ? null : s),
    setPeriode: p => setParam('p', p),
    param: k => sp.get(k), setParam,
    runKey, run: () => setRunKey(k => k + 1),
    lastCalc, setLastCalc, hash, setHash,
    datasets, refreshDatasets, scenarios, setScenarios,
    effectivePeriode, setEffectivePeriode,
    toasts, toast, apiOk, demo, setDemo,
  }), [dataset, scenario, periode, sp, setSp, setParam, runKey, lastCalc, hash, datasets, refreshDatasets, scenarios, effectivePeriode, toasts, toast, apiOk, demo])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider manquant')
  return s
}

/** Appel d'API avec état de chargement / erreur ; relancé quand `deps` change ou sur « Exécuter ». */
export function useApi<T>(fn: () => Promise<T>, deps: any[], opts: { enabled?: boolean; silent?: boolean } = {}) {
  const { runKey, toast } = useStore()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const enabled = opts.enabled ?? true
  useEffect(() => {
    if (!enabled) return
    let vivant = true
    setLoading(true)
    setError(null)
    fn()
      .then(d => { if (vivant) setData(d) })
      .catch((e: unknown) => {
        if (!vivant) return
        const msg = e instanceof ApiError ? e.message : String(e)
        setError(msg)
        if (!opts.silent) toast('error', msg)
      })
      .finally(() => { if (vivant) setLoading(false) })
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, runKey, tick, enabled])
  return { data, error, loading, reload: () => setTick(t => t + 1), setData }
}
