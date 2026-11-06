// Page 7 — Module 5 : cinq indicateurs de résilience par scénario, petits multiples, carte des différences, constructeur.
import { Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import NetworkCanvas, { LegendLine } from '../components/NetworkCanvas'
import ScenarioBuilder, { type BuilderAction } from '../components/ScenarioBuilder'
import { Bar, Card, DeltaBadge, ErrorBox, Pill, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { fmt, shortHash } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { ScenarioInd } from '../lib/types'
import { MAP, SCEN_DESCR, scenColor, scenLabel } from '../theme/tokens'

interface Ligne { l: string; k: keyof ScenarioInd; f: (v: number) => string; better: 'lower' | 'higher'; unit?: string; d?: number; max?: number }
const LIGNES: Ligne[] = [
  { l: 'Demandes devenues inaccessibles', k: 'demandes_devenues_inaccessibles', f: v => String(v), better: 'lower', d: 0 },
  { l: 'Hausse moyenne du temps de trajet', k: 'hausse_moyenne', f: v => `+${fmt(v, 2)} min`, better: 'lower', unit: ' min', d: 2 },
  { l: 'Hausse maximale du temps de trajet', k: 'hausse_max', f: v => `+${fmt(v, 2)} min`, better: 'lower', unit: ' min', d: 2 },
  { l: 'Composantes du réseau de fibre', k: 'composantes_fibre_avant_reparation', f: v => String(v), better: 'lower', d: 0 },
  { l: 'Coût du raccordement', k: 'cout_reparation', f: v => `${fmt(v, 0)} k€`, better: 'lower', unit: ' k€', d: 0 },
  { l: 'Sites sensibles restant accessibles', k: 'part_sensibles_accessibles', f: v => `${fmt(v, 1)} %`, better: 'higher', unit: ' pt', d: 1, max: 100 },
]

export default function Scenarios() {
  const s = useStore()
  const [perso, setPerso] = useState<{ nom: string; actions: BuilderAction[] }[]>([])
  const [builder, setBuilder] = useState(false)
  const r = useApi(() => api.scenarios(s.dataset, null, s.periode, perso), [s.dataset, s.periode, perso])
  const [choix, setChoix] = useState<string | null>(null)
  const diffScen = choix ?? (r.data?.scenarios.find(x => x.nb_modifications > 0)?.scenario ?? 'normal')
  const g = useGraph(r.data?.scenarios.find(x => x.scenario === diffScen)?.personnalise ? 'normal' : diffScen)
  const base = useGraph('normal')
  useLastCalc('Indicateurs M5', r.data?.temps_ms, [r.data])

  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />
  const S = r.data?.scenarios ?? []
  const ref = S[0]
  const sel = S.find(x => x.scenario === diffScen)
  const fibreDiff = sel?.diff.filter(d => d.cible === 'fibre') ?? []
  const routeDiff = sel?.diff.filter(d => d.cible === 'route') ?? []
  const iSel = Math.max(0, S.findIndex(x => x.scenario === diffScen))

  return (
    <div className="grid gap-5">
      {/* ---------- cartes de scénarios ---------- */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
        {!r.data && [0, 1, 2, 3, 4, 5].map(k => <Skeleton key={k} h={118} />)}
        {S.map((x, i) => (
          <button key={x.scenario} title={SCEN_DESCR[x.scenario] ?? `${x.nb_modifications} modification(s)`} className={`card text-left transition-shadow ${diffScen === x.scenario ? '' : 'hover:border-[var(--navy-line)]'}`} style={{ padding: '12px 14px', borderTop: `4px solid ${scenColor(i)}`, ...(diffScen === x.scenario ? { boxShadow: `0 0 0 2px ${scenColor(i)}, var(--shadow)` } : {}) }} onClick={() => setChoix(x.scenario)}>
            <div className="flex items-center gap-2">
              <b className="serif text-[16.5px] truncate">{scenLabel(x.scenario)}</b>
              {i === 0 && <span className="pill p-mu ml-auto" style={{ fontSize: 11, padding: '1px 7px' }}>réf.</span>}
              {x.personnalise && <span className="pill p-am ml-auto" style={{ fontSize: 11, padding: '1px 7px' }}>perso</span>}
            </div>
            <div className="caption mt-0.5">période {x.periode} · {x.nb_modifications} modif.</div>
            <div className="flex gap-4 mt-2">
              <div><div className="text-[19px] font-semibold num">+{fmt(x.hausse_moyenne, 2)}</div><div className="caption leading-tight">min en moy.</div></div>
              <div><div className="text-[19px] font-semibold num">{fmt(x.part_sensibles_accessibles, 0)} %</div><div className="caption leading-tight">sensibles</div></div>
            </div>
          </button>
        ))}
      </div>
      {r.data && (
        <div className="flex items-center gap-3 -mt-2 flex-wrap">
          <span className="caption">Cliquez un scénario pour voir ses différences (figure 7).</span>
          <button className={`btn btn-sm ml-auto ${builder ? 'btn-on' : 'btn-gh'}`} onClick={() => setBuilder(b => !b)}><Plus size={14} />Nouveau scénario</button>
        </div>
      )}

      {builder && base.data && (
        <ScenarioBuilder graph={base.data} onClose={() => setBuilder(false)} onEvaluate={(nom, actions) => { setPerso(p => [...p.filter(x => x.nom !== nom), { nom, actions }]); setChoix(nom); s.toast('info', `Scénario « ${nom} » évalué (non enregistré)`) }} />
      )}

      {/* ---------- tableau des indicateurs ---------- */}
      <Card fig="Tableau 6 · sujet §3.5" title="Indicateurs de résilience par scénario"
        right={r.data && <Pill kind={r.data.base_inchangee ? 'ok' : 'ko'}><ShieldCheck size={14} />Base de référence {r.data.base_inchangee ? 'inchangée' : 'MODIFIÉE'} · sha256 {shortHash(r.data.hash_fichiers_avant)} = {shortHash(r.data.hash_fichiers_apres)}</Pill>}>
        {!r.data ? <Skeleton h={260} /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Indicateur</th>{S.map((x, i) => <th key={x.scenario} className="r" style={{ whiteSpace: 'normal', verticalAlign: 'bottom' }}><span className="inline-flex items-center gap-1.5 justify-end"><i className="dot" style={{ background: scenColor(i) }} />{scenLabel(x.scenario)}</span></th>)}</tr></thead>
              <tbody>
                {LIGNES.map(L => (
                  <tr key={L.k}><td className="font-medium" style={{ whiteSpace: 'normal', minWidth: 200 }}>{L.l}</td>
                    {S.map((x, i) => <td key={x.scenario} className="r"><div className="flex flex-col items-end gap-1"><span className="font-semibold">{L.f(Number(x[L.k]))}</span>{i > 0 && <DeltaBadge value={Number(x[L.k]) - Number(ref[L.k])} better={L.better} unit={L.unit} d={L.d ?? 1} />}</div></td>)}</tr>
                ))}
                <tr><td className="mu">Demandes inaccessibles (au total)</td>{S.map(x => <td key={x.scenario} className="r mu">{x.demandes_inaccessibles} / {x.demandes}</td>)}</tr>
                <tr><td className="mu">Composantes fibre après raccordement</td>{S.map(x => <td key={x.scenario} className="r mu">{x.composantes_fibre}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="caption mt-3">▲ dégradation / ▼ amélioration par rapport à « Normal » · chaque scénario est appliqué sur une copie : la base reste intacte.</div>
      </Card>

      {/* ---------- petits multiples ---------- */}
      <Card fig="Figure 6" title="Comparaison visuelle des scénarios">
        {!r.data ? <Skeleton h={300} /> : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {LIGNES.map(L => {
              const vals = S.map(x => Number(x[L.k]))
              const max = L.max ?? Math.max(1e-9, ...vals)
              return (
                <div key={L.k} className="fileC" style={{ padding: '14px 16px' }}>
                  <div className="font-semibold text-[14.5px] mb-2.5">{L.l}</div>
                  {S.map((x, i) => (
                    <div key={x.scenario} className="grid items-center gap-2.5 my-1.5" style={{ gridTemplateColumns: '118px 1fr 82px' }}>
                      <span className="text-[13px] truncate flex items-center gap-1.5"><i className="dot" style={{ background: scenColor(i) }} />{scenLabel(x.scenario)}</span>
                      <Bar value={vals[i]} max={max} color={scenColor(i)} />
                      <span className="num text-right text-[13.5px] font-medium">{L.f(vals[i])}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ---------- carte des différences ---------- */}
      <Card fig="Figure 7" title={<>Carte des différences avec la situation normale · <span className="inline-flex items-center gap-2"><i className="dot" style={{ background: scenColor(iSel), width: 11, height: 11 }} />{scenLabel(diffScen)}</span></>}
        sub={SCEN_DESCR[diffScen] ?? `${sel?.nb_modifications ?? 0} modification(s)`}
        right={<>{routeDiff.length > 0 && <Pill kind="ko">{routeDiff.length} arcs routiers modifiés</Pill>}{fibreDiff.length > 0 && <Pill kind="ko">{fibreDiff.length} tronçon(s) fibre en panne</Pill>}{(sel?.raccordements.length ?? 0) > 0 && <Pill kind="ok">raccordement {sel!.raccordements.join(', ')}</Pill>}</>}>
        <div className="legend mb-3"><LegendLine color={MAP.closed} label="fermé / en panne" dashed /><LegendLine color={MAP.works} label="travaux" dashed /><LegendLine color={MAP.repair} label="raccordement fibre" dashed /></div>
        {g.data ? (
          <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre={fibreDiff.length > 0} height="clamp(420px, calc(100vh - 360px), 600px)"
            edges={[
              ...(sel?.personnalise ? routeDiff.map(d => ({ u: d.u, v: d.v, color: d.apres === 'ferme' ? MAP.closed : MAP.works, dashed: true, width: 3.2 })) : []),
              ...fibreDiff.map(d => ({ u: d.u, v: d.v, color: MAP.closed, dashed: true, width: 3.4 })),
              ...(sel?.raccordements ?? []).map(l => { const [u, v] = splitPair(l, g.data!.sites.map(x => x.id)); return { u, v, color: MAP.repair, dashed: true, glow: true, width: 3.4 } }),
            ]}
            selected={routeDiff.filter(d => d.cible === 'route').flatMap(d => [d.u, d.v]).slice(0, 40)} />
        ) : <Skeleton h={480} />}
      </Card>
    </div>
  )
}

function splitPair(label: string, ids: string[]): [string, string] {
  const set = new Set(ids)
  for (let i = 1; i < label.length; i++) if (label[i] === '-' && set.has(label.slice(0, i)) && set.has(label.slice(i + 1))) return [label.slice(0, i), label.slice(i + 1)]
  const [a, b] = label.split('-')
  return [a, b]
}
