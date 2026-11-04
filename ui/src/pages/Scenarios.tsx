// Page 7 — Scénarios & résilience (M5) : 5 indicateurs par scénario, graphiques, carte des différences, constructeur.
import { Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import NetworkCanvas, { LegendLine } from '../components/NetworkCanvas'
import ScenarioBuilder, { type BuilderAction } from '../components/ScenarioBuilder'
import { Card, DeltaBadge, ErrorBox, Pill, Skeleton } from '../components/ui'
import { axis, Chart } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, shortHash } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { ScenarioInd } from '../lib/types'
import { SCEN_COLOR, scenLabel } from '../theme/tokens'

const DESCR: Record<string, string> = {
  normal: 'Situation nominale (référence)',
  fermeture_axe: 'Ponts centraux fermés dans les deux sens',
  panne_fibre: "Panne d'un tronçon critique de l'ACM",
  heure_pointe: 'Temps de pointe sur tout le réseau',
  zone_travaux: 'Chantier autour d’une caserne (×1,5)',
  crue_nova: 'Sites riverains coupés par la crue',
}

const LIGNES: { l: string; k: keyof ScenarioInd; f: (v: number) => string; better: 'lower' | 'higher'; unit?: string; d?: number }[] = [
  { l: 'Demandes devenues inaccessibles', k: 'demandes_devenues_inaccessibles', f: v => String(v), better: 'lower', d: 0 },
  { l: 'Hausse moyenne du temps', k: 'hausse_moyenne', f: v => `+${fmt(v)} min`, better: 'lower', unit: ' min' },
  { l: 'Hausse maximale du temps', k: 'hausse_max', f: v => `+${fmt(v)} min`, better: 'lower', unit: ' min' },
  { l: 'Composantes fibre (avant réparation)', k: 'composantes_fibre_avant_reparation', f: v => String(v), better: 'lower', d: 0 },
  { l: 'Coût de raccordement', k: 'cout_reparation', f: v => `${fmt(v, 0)} k€`, better: 'lower', unit: ' k€', d: 0 },
  { l: 'Sites sensibles accessibles', k: 'part_sensibles_accessibles', f: v => `${fmt(v, 1)} %`, better: 'higher', unit: ' pts' },
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
  const col = (i: number) => SCEN_COLOR[i % SCEN_COLOR.length]
  const maxOf = (k: keyof ScenarioInd) => Math.max(1e-9, ...S.map(x => Number(x[k])))

  const barres = {
    legend: { data: S.map(x => scenLabel(x.scenario)), textStyle: { color: '#8592AE' } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['Hausse moy. (min)', 'Hausse max (min)', 'Coût racc. (k€)', 'Sensibles acc. (%)', 'Dem. inaccessibles'], ...axis() },
    yAxis: { type: 'value', name: '% du maximum', max: 100, ...axis() },
    series: S.map((x, i) => ({
      name: scenLabel(x.scenario), type: 'bar', barGap: '10%', itemStyle: { color: col(i), borderRadius: [4, 4, 0, 0] },
      data: [x.hausse_moyenne / maxOf('hausse_moyenne') * 100, x.hausse_max / maxOf('hausse_max') * 100, x.cout_reparation / maxOf('cout_reparation') * 100, x.part_sensibles_accessibles, x.demandes_inaccessibles / maxOf('demandes_inaccessibles') * 100].map(v => Math.round(v * 10) / 10),
    })),
    grid: { left: 50, right: 14, top: 62, bottom: 30 },
  }
  const total = ref?.demandes || 1
  const radar = {
    legend: { data: S.map(x => scenLabel(x.scenario)), textStyle: { color: '#8592AE' }, top: 0 },
    tooltip: { trigger: 'item' },
    radar: {
      indicator: [{ name: 'Accessibilité', max: 1 }, { name: 'Délai moyen', max: 1 }, { name: 'Délai max', max: 1 }, { name: 'Fibre', max: 1 }, { name: 'Coût', max: 1 }, { name: 'Sensibles', max: 1 }],
      axisName: { color: '#8592AE' }, splitLine: { lineStyle: { color: '#1E2A47' } }, splitArea: { areaStyle: { color: ['#0b1224', '#0d1528'] } }, axisLine: { lineStyle: { color: '#1E2A47' } }, center: ['50%', '56%'], radius: '62%',
    },
    series: [{
      type: 'radar', data: S.map((x, i) => ({
        name: scenLabel(x.scenario), lineStyle: { color: col(i) }, itemStyle: { color: col(i) }, areaStyle: { color: col(i) + '22' },
        value: [1 - x.demandes_inaccessibles / total, 1 - x.hausse_moyenne / maxOf('hausse_moyenne'), 1 - x.hausse_max / maxOf('hausse_max'), 1 - (x.composantes_fibre_avant_reparation - 1) / Math.max(1, maxOf('composantes_fibre_avant_reparation')), 1 - x.cout_reparation / maxOf('cout_reparation'), x.part_sensibles_accessibles / 100].map(v => Math.round(Math.max(0, v) * 1000) / 1000),
      })),
    }],
  }
  const sel = S.find(x => x.scenario === diffScen)
  const fibreDiff = sel?.diff.filter(d => d.cible === 'fibre') ?? []
  const routeDiff = sel?.diff.filter(d => d.cible === 'route') ?? []

  return (
    <div>
      <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: `repeat(${Math.min(S.length + 1, 7)}, minmax(0, 1fr))` }}>
        {!r.data && [0, 1, 2, 3].map(k => <Skeleton key={k} h={110} />)}
        {S.map((x, i) => (
          <button key={x.scenario} className="card text-left" style={{ borderTop: `3px solid ${col(i)}`, boxShadow: diffScen === x.scenario ? `0 0 24px -12px ${col(i)}` : undefined }} onClick={() => setChoix(x.scenario)}>
            <div className="card-title"><span style={{ color: col(i) }}>●</span> {scenLabel(x.scenario)}{i === 0 && <span className="pill p-mu ml-auto">référence</span>}{x.personnalise && <span className="pill p-am ml-auto">perso</span>}</div>
            <div className="mu text-[11.5px] mb-2 min-h-[30px]">{DESCR[x.scenario] ?? `${x.nb_modifications} modification(s)`} · {x.periode}</div>
            <div className="flex gap-3.5">
              <div><div className="big text-[18px]">+{fmt(x.hausse_moyenne)}</div><div className="mu2 text-[10.5px]">min moy.</div></div>
              <div><div className="big text-[18px]">{fmt(x.part_sensibles_accessibles, 0)} %</div><div className="mu2 text-[10.5px]">sensibles OK</div></div>
            </div>
          </button>
        ))}
        {r.data && (
          <button className="card grid place-items-center text-center" style={{ border: '1px dashed #3a4a75' }} onClick={() => setBuilder(b => !b)}>
            <div><Plus size={24} className="mx-auto mu" /><b>Nouveau scénario</b><div className="mu text-[11.5px]">Sélectionner arcs / tronçons sur la carte</div></div>
          </button>
        )}
      </div>

      {builder && base.data && (
        <div className="mb-3.5">
          <ScenarioBuilder graph={base.data} onClose={() => setBuilder(false)} onEvaluate={(nom, actions) => { setPerso(p => [...p.filter(x => x.nom !== nom), { nom, actions }]); setChoix(nom); s.toast('info', `Scénario « ${nom} » évalué (non enregistré)`) }} />
        </div>
      )}

      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.25fr 1fr' }}>
        <Card title="Indicateurs de résilience" right={r.data && <Pill kind={r.data.base_inchangee ? 'ok' : 'ko'}><ShieldCheck size={12} />Base de référence {r.data.base_inchangee ? 'inchangée' : 'MODIFIÉE'} · sha256 {shortHash(r.data.hash_fichiers_avant)} = {shortHash(r.data.hash_fichiers_apres)}</Pill>}>
          {!r.data ? <Skeleton h={220} /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Indicateur</th>{S.map((x, i) => <th key={x.scenario} className="r" style={{ color: col(i) }}>{scenLabel(x.scenario)}</th>)}</tr></thead>
                <tbody>
                  {LIGNES.map(L => (
                    <tr key={L.k}><td>{L.l}</td>
                      {S.map((x, i) => <td key={x.scenario} className="r mono">{L.f(Number(x[L.k]))} {i > 0 && <DeltaBadge value={Number(x[L.k]) - Number(ref[L.k])} better={L.better} unit={L.unit} d={L.d ?? 1} />}</td>)}</tr>
                  ))}
                  <tr><td className="mu">Demandes inaccessibles (total)</td>{S.map(x => <td key={x.scenario} className="r mono mu">{x.demandes_inaccessibles} / {x.demandes}</td>)}</tr>
                  <tr><td className="mu">Composantes fibre (après réparation)</td>{S.map(x => <td key={x.scenario} className="r mono mu">{x.composantes_fibre}</td>)}</tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="callout mt-3">Chaque perturbation est appliquée sur une <b>copie profonde</b> du graphe de base ; l'empreinte SHA-256 des fichiers de base est recalculée avant et après. Une demande inaccessible dans la base (site isolé) n'est pas comptée comme « devenue » inaccessible.</div>
        </Card>
        <Card title="Comparaison visuelle">
          {r.data ? <><Chart option={barres} height={250} /><Chart option={radar} height={300} /><div className="mu2 text-[11px]">Radar : résilience normalisée (1 = meilleur scénario observé, 0 = pire) sur chaque axe.</div></> : <Skeleton h={500} />}
        </Card>
      </div>

      <Card className="mt-3.5" title={<>Carte des différences vs Normal · <span className="mono">{scenLabel(diffScen)}</span> {routeDiff.length > 0 && <Pill kind="ko">{routeDiff.length} arcs routiers modifiés</Pill>}{fibreDiff.length > 0 && <Pill kind="cy">{fibreDiff.length} tronçon(s) fibre en panne</Pill>}{(sel?.raccordements.length ?? 0) > 0 && <Pill kind="ok">raccordement {sel!.raccordements.join(', ')}</Pill>}</>}
        right={<span className="mu text-[11px]">cliquez une carte de scénario pour changer</span>}>
        {g.data ? (
          <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre={fibreDiff.length > 0} height={460}
            edges={[
              ...(sel?.personnalise ? routeDiff.map(d => ({ u: d.u, v: d.v, color: d.apres === 'ferme' ? '#FF4D4D' : '#FFB547', dashed: true, width: 3 })) : []),
              ...fibreDiff.map(d => ({ u: d.u, v: d.v, color: '#FF4D4D', dashed: true, width: 3.2 })),
              ...(sel?.raccordements ?? []).map(l => { const [u, v] = splitPair(l, g.data!.sites.map(x => x.id)); return { u, v, color: '#3DDC97', dashed: true, glow: true, width: 3.2 } }),
            ]}
            selected={routeDiff.filter(d => d.cible === 'route').flatMap(d => [d.u, d.v]).slice(0, 40)}
            legend={<><LegendLine color="#FF4D4D" label="Fermé / en panne" dashed /><LegendLine color="#FFB547" label="Travaux" dashed /><LegendLine color="#3DDC97" label="Raccordement" dashed /></>} />
        ) : <Skeleton h={460} />}
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
