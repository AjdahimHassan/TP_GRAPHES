// Page 5 — Circuits absorbants (M3) : deux graphes de test, Bellman–Ford / Floyd–Warshall, bac à sable.
import { AlertTriangle, Infinity as Inf, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Card, ErrorBox, Pill, Seg, Skeleton } from '../components/ui'
import { LabGraph, type LabEdge, type LabNode } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtMs } from '../lib/format'
import { useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { NegResult } from '../lib/types'

function Lab({ dataset, titre }: { dataset: string; titre: string }) {
  const s = useStore()
  const graph = useApi(() => api.graph({ dataset, scenario: 'normal' }), [dataset])
  const [source, setSource] = useState('S')
  const [algo, setAlgo] = useState<'bellman_ford' | 'floyd_warshall'>(dataset.includes('inacc') ? 'floyd_warshall' : 'bellman_ford')
  const [edition, setEdition] = useState(false)
  const [arcs, setArcs] = useState<{ u: string; v: string; w: number }[]>([])
  const [bac, setBac] = useState<NegResult | null>(null)
  const [nouv, setNouv] = useState({ u: 'S', v: 'A', w: -1 })
  const res = useApi(() => api.negcycle(dataset, source, 'all'), [dataset, source])
  useLastCalc(algo === 'bellman_ford' ? 'Bellman–Ford' : 'Floyd–Warshall', res.data?.resultats.find(r => r.algo === algo)?.temps_ms, [res.data, algo])
  useEffect(() => { if (res.data && !arcs.length) setArcs(res.data.arcs.map(a => ({ ...a }))) }, [res.data, arcs.length])

  const data = edition && bac ? bac : res.data
  const r = data?.resultats.find(x => x.algo === algo)
  // positions normalisées dans une boîte 420 × 210 (sinon Cytoscape dézoome et les étiquettes disparaissent)
  const pos = useMemo(() => {
    const sites = graph.data?.sites ?? []
    if (!sites.length) return new Map<string, number[]>()
    const xs = sites.map(x => x.x), ys = sites.map(x => x.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return new Map(sites.map(x => [x.id, [((x.x - x0) / (x1 - x0 || 1)) * 420, ((y1 - x.y) / (y1 - y0 || 1)) * 210]]))
  }, [graph.data])
  const cycleSet = useMemo(() => { const c = r?.cycle ?? []; const m = new Set<string>(); for (let i = 0; i + 1 < c.length; i++) m.add(c[i] + '>' + c[i + 1]); return m }, [r])
  const nodes: LabNode[] = (data?.sommets ?? []).map((id, k) => {
    const d = r?.dist[id]
    const p = pos.get(id) ?? [Math.cos(k) * 120, Math.sin(k) * 80]
    return { id, x: p[0], y: p[1], state: d === '-inf' ? 'minf' : d === '+inf' ? 'inf' : 'fin', source: id === source, label: d === '-inf' ? '−∞' : d === '+inf' ? '+∞' : fmt(d as number, 0) }
  })
  const edges: LabEdge[] = (edition ? arcs : data?.arcs ?? []).map((a, k) => ({ id: `e${k}`, source: a.u, target: a.v, label: String(a.w).replace('-', '−'), red: cycleSet.has(a.u + '>' + a.v), neg: a.w < 0 }))

  const lancer = async () => {
    try { setBac(await api.sandbox(source, arcs, 'all')) } catch (e: any) { s.toast('error', e.message) }
  }

  return (
    <Card title={<>{titre} · <span className="mono">{dataset}</span></>}
      right={<>
        <span className="flex items-center gap-1.5 text-[11px] mu">Source
          <select className="inp" style={{ padding: '2px 20px 2px 8px' }} value={source} onChange={e => setSource(e.target.value)}>{(data?.sommets ?? ['S']).map(x => <option key={x}>{x}</option>)}</select></span>
        <Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'bellman_ford', l: 'Bellman–Ford' }, { v: 'floyd_warshall', l: 'Floyd–W.' }]} />
      </>}>
      {res.error && <ErrorBox error={res.error} />}
      {!data ? <Skeleton h={270} /> : <LabGraph nodes={nodes} edges={edges} layout={edition && arcs.some(a => !pos.has(a.u) || !pos.has(a.v)) ? 'cose' : 'preset'} onNode={id => setSource(id)} />}
      {r && (
        <div className={`banner ${r.accessible ? 'ko' : r.existe ? 'am' : 'ok'} mt-3`}>
          <Inf size={18} />
          <div><b>{r.message}</b><br />
            <span className="mono text-[11.5px]">{r.cycle.length ? `${r.cycle.join(' → ')} · poids total ${fmt(r.poids_cycle, 0).replace('-', '−')}` : 'aucun circuit de poids négatif'}
              {r.algo === 'bellman_ford' && r.existe && (r.accessible ? ` · encore relâchable à la passe |V| = ${data?.sommets.length}` : ' · aucun arc relâchable depuis la source')}
              {r.algo === 'floyd_warshall' && r.existe && (r.accessible ? ' · d[k][k] < 0 et d[source][k] < ∞' : ` · d[k][k] < 0 mais d[${source}][k] = +∞`)}</span></div>
        </div>
      )}
      {data && (
        <table className="tbl mt-2.5">
          <thead><tr><th>Sommet</th><th className="r">Bellman–Ford</th><th className="r">Floyd–Warshall</th><th>Statut</th></tr></thead>
          <tbody>{data.sommets.map(x => {
            const vals = data.resultats.map(y => y.dist[x])
            const st = vals.includes('-inf') ? 'minf' : vals.includes('+inf') ? 'inf' : 'fin'
            return (
              <tr key={x}><td className="mono"><b>{x}</b></td>
                {['bellman_ford', 'floyd_warshall'].map(a => { const v = data.resultats.find(y => y.algo === a)?.dist[x]; return <td key={a} className="r mono" style={{ color: v === '-inf' ? '#FF8a98' : undefined }}>{fmt(v ?? null, 0).replace('-', '−')}</td> })}
                <td>{st === 'minf' ? <Pill kind="ko">diminuable à l'infini</Pill> : st === 'inf' ? <Pill>non atteignable</Pill> : <Pill kind="ok">finie</Pill>}</td></tr>
            )
          })}</tbody>
        </table>
      )}
      <div className="flex items-center gap-2 mt-2.5 text-[11px] mu">
        {data?.resultats.map(x => <span key={x.algo} className="mono">{x.algo === 'bellman_ford' ? 'BF' : 'FW'} {fmtMs(x.temps_ms)}</span>)}
        <button className={`btn btn-sm ml-auto ${edition ? 'btn-pri' : 'btn-gh'}`} onClick={() => { setEdition(e => !e); setBac(null) }}><Pencil size={11} />{edition ? 'Quitter le bac à sable' : 'Éditer le graphe'}</button>
      </div>
      {edition && (
        <div className="mt-2.5 fileC">
          <div className="banner am mb-2 text-[11.5px]"><AlertTriangle size={14} />Poids négatifs artificiels : ce ne sont pas des durées physiques.</div>
          <div className="overflow-auto" style={{ maxHeight: 160 }}>
            {arcs.map((a, k) => (
              <div key={k} className="flex items-center gap-2 py-0.5">
                <span className="mono w-16">{a.u} → {a.v}</span>
                <input className="inp w-20" type="number" value={a.w} onChange={e => setArcs(xs => xs.map((x, j) => (j === k ? { ...x, w: Number(e.target.value) } : x)))} />
                <button className="mu" onClick={() => setArcs(xs => xs.filter((_, j) => j !== k))}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input className="inp w-14" value={nouv.u} onChange={e => setNouv(n => ({ ...n, u: e.target.value.toUpperCase().slice(0, 3) }))} />→
            <input className="inp w-14" value={nouv.v} onChange={e => setNouv(n => ({ ...n, v: e.target.value.toUpperCase().slice(0, 3) }))} />
            <input className="inp w-16" type="number" value={nouv.w} onChange={e => setNouv(n => ({ ...n, w: Number(e.target.value) }))} />
            <button className="btn btn-gh btn-sm" onClick={() => nouv.u && nouv.v && setArcs(xs => [...xs, { ...nouv }])}><Plus size={11} />Arc</button>
            <button className="btn btn-pri btn-sm ml-auto" onClick={lancer}><Play size={11} />Relancer</button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function NegCycles() {
  return (
    <div>
      <div className="banner am mb-3.5"><AlertTriangle size={16} /><span><b>Jeux de test artificiels.</b> Les poids négatifs n'existent que pour vérifier Bellman–Ford et Floyd–Warshall : ce ne sont pas des durées physiques. Les scénarios métier n'ont aucun circuit absorbant (temps ≥ 0, imposé par le validateur).</span></div>
      <div className="grid grid-cols-2 gap-3.5">
        <Lab dataset="negatif_accessible" titre="Test A" />
        <Lab dataset="negatif_inaccessible" titre="Test B" />
      </div>
      <div className="grid grid-cols-3 gap-3.5 mt-3.5">
        <Card title="Règle Bellman–Ford"><div className="mu">Après |V|−1 passes, tout arc encore relâchable marque un sommet ; on propage <b style={{ color: '#FF8a98' }}>−∞</b> à tout ce qui est atteignable depuis lui (BFS). Pour savoir si un circuit existe <b>ailleurs</b>, on relance depuis tous les sommets à 0 (super-source).</div></Card>
        <Card title="Règle Floyd–Warshall"><div className="mu">k est sur un circuit absorbant si d[k][k] &lt; 0. Alors d[i][j] = <b style={{ color: '#FF8a98' }}>−∞</b> s'il existe un tel k avec d[i][k] &lt; ∞ et d[k][j] &lt; ∞. Sinon la distance reste finie et correcte.</div></Card>
        <Card title="Lecture"><div className="mu">Dans B, le circuit C → D → E → C existe (d[C][C] &lt; 0) mais n'est pas accessible depuis S : les distances depuis S restent <b>finies</b>, même vers B que le circuit atteint. Choisissez C comme source pour voir B passer à −∞.</div></Card>
      </div>
    </div>
  )
}
