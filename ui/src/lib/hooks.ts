import { useEffect, useMemo } from 'react'
import { api } from './api'
import { useApi, useStore } from './store'
import type { GraphPayload } from './types'

/** Graphe du jeu courant sous le scénario courant (sites, arcs, fibre, diff, empreintes). */
export function useGraph(scenario?: string) {
  const s = useStore()
  const sc = scenario ?? s.scenario
  const r = useApi<GraphPayload>(() => api.graph({ dataset: s.dataset, scenario: sc, periode: s.periode }), [s.dataset, sc, s.periode])
  useEffect(() => {
    if (!r.data) return
    s.setHash({ avant: r.data.hash_avant, apres: r.data.hash_apres, ok: r.data.base_inchangee })
    if (!scenario) s.setEffectivePeriode(r.data.periode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.data])
  return r
}

export function useTypes(g: GraphPayload | null) {
  return useMemo(() => Object.fromEntries((g?.sites ?? []).map(x => [x.id, x.type])), [g])
}

/** Enregistre « dernier calcul » dans le pied de page. */
export function useLastCalc(label: string, ms: number | null | undefined, deps: any[]) {
  const s = useStore()
  useEffect(() => {
    if (ms !== undefined && ms !== null) s.setLastCalc({ label, ms })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
