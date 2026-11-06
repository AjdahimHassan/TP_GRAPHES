// Page 5 — Module 3 : circuits absorbants sur deux graphes de test (Bellman–Ford / Floyd–Warshall) + bac à sable.
import { Infinity as Inf, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Callout, Card, ErrorBox, Pill, Seg, Skeleton } from '../components/ui'
import { LabGraph, type LabEdge, type LabNode } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtMs } from '../lib/format'
import { useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { NegResult } from '../lib/types'

const moins = (x: string) => x.replace('-', '−')

function Lab({ dataset, fig, titre }: { dataset: string; fig: string; titre: string }) {
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
  // positions normalisées dans une boîte 440 × 220 (sinon Cytoscape dézoome et les étiquettes disparaissent)
  const pos = useMemo(() => {
    const sites = graph.data?.sites ?? []
    if (!sites.length) return new Map<string, number[]>()
    const xs = sites.map(x => x.x), ys = sites.map(x => x.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return new Map(sites.map(x => [x.id, [((x.x - x0) / (x1 - x0 || 1)) * 440, ((y1 - x.y) / (y1 - y0 || 1)) * 220]]))
  }, [graph.data])
  const cycleSet = useMemo(() => { const c = r?.cycle ?? []; const m = new Set<string>(); for (let i = 0; i + 1 < c.length; i++) m.add(c[i] + '>' + c[i + 1]); return m }, [r])
  const nodes: LabNode[] = (data?.sommets ?? []).map((id, k) => {
    const d = r?.dist[id]
    const p = pos.get(id) ?? [Math.cos(k) * 120, Math.sin(k) * 80]
    return { id, x: p[0], y: p[1], state: d === '-inf' ? 'minf' : d === '+inf' ? 'inf' : 'fin', source: id === source, label: d === '-inf' ? '−∞' : d === '+inf' ? '+∞' : moins(fmt(d as number, 0)) }
  })
  const edges: LabEdge[] = (edition ? arcs : data?.arcs ?? []).map((a, k) => ({ id: `e${k}`, source: a.u, target: a.v, label: moins(String(a.w)), red: cycleSet.has(a.u + '>' + a.v), neg: a.w < 0 }))

  const lancer = async () => {
    try { setBac(await api.sandbox(source, arcs, 'all')) } catch (e: any) { s.toast('error', e.message) }
  }

  return (
    <Card fig={fig} title={titre}
      right={<>
        <label className="flex items-center gap-2 text-[13.5px] mu font-medium">Source
          <select className="inp mono" value={source} onChange={e => setSource(e.target.value)}>{(data?.sommets ?? ['S']).map(x => <option key={x}>{x}</option>)}</select></label>
        <Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'bellman_ford', l: 'Bellman–Ford' }, { v: 'floyd_warshall', l: 'Floyd–Warshall' }]} />
      </>}>
      {res.error && <ErrorBox error={res.error} />}
      {!data ? <Skeleton h={300} /> : <LabGraph nodes={nodes} edges={edges} height={300} layout={edition && arcs.some(a => !pos.has(a.u) || !pos.has(a.v)) ? 'cose' : 'preset'} onNode={id => setSource(id)} />}
      <div className="legend mt-2.5">
        <span><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 2.5px #1F4E79' }} />source</span>
        <span><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 2.5px #3F9A63' }} />distance finie</span>
        <span><i style={{ background: '#FBEBE9', boxShadow: 'inset 0 0 0 2.5px #d03b3b' }} />−∞ (diminuable sans fin)</span>
        <span><i style={{ background: '#F1EEE8', boxShadow: 'inset 0 0 0 2px #A8AFB8' }} />+∞ (non atteignable)</span>
        <span><i className="ln" style={{ background: '#d03b3b' }} />circuit extrait</span>
      </div>
      {r && (
        <div className={`banner ${r.accessible ? 'ko' : r.existe ? 'am' : 'ok'} mt-3`}>
          <Inf size={20} />
          <div><b>{r.message}</b><br />
            <span className="text-[14px]">{r.cycle.length ? <><span className="mono">{r.cycle.join(' → ')}</span> · poids total <b>{moins(fmt(r.poids_cycle, 0))}</b></> : 'aucun circuit de poids négatif'}
              {r.algo === 'bellman_ford' && r.existe && (r.accessible ? ` · un arc reste relâchable à la passe |V| = ${data?.sommets.length}` : ' · aucun arc relâchable depuis la source')}
              {r.algo === 'floyd_warshall' && r.existe && (r.accessible ? ' · d[k][k] < 0 et d[source][k] < ∞' : ` · d[k][k] < 0 mais d[${source}][k] = +∞`)}</span></div>
        </div>
      )}
      {data && (
        <table className="tbl compact mt-3">
          <thead><tr><th>Sommet</th><th className="r">Bellman–Ford</th><th className="r">Floyd–Warshall</th><th>Statut de la distance</th></tr></thead>
          <tbody>{data.sommets.map(x => {
            const vals = data.resultats.map(y => y.dist[x])
            const st = vals.includes('-inf') ? 'minf' : vals.includes('+inf') ? 'inf' : 'fin'
            return (
              <tr key={x} className={x === source ? 'sel' : ''}><td className="mono font-semibold">{x}{x === source && <span className="mu font-normal"> (source)</span>}</td>
                {['bellman_ford', 'floyd_warshall'].map(a => { const v = data.resultats.find(y => y.algo === a)?.dist[x]; return <td key={a} className="r font-semibold" style={{ color: v === '-inf' ? 'var(--ko)' : v === '+inf' ? 'var(--muted)' : undefined }}>{moins(fmt(v ?? null, 0))}</td> })}
                <td>{st === 'minf' ? <Pill kind="ko">diminuable à l’infini</Pill> : st === 'inf' ? <Pill>non atteignable</Pill> : <Pill kind="ok">finie</Pill>}</td></tr>
            )
          })}</tbody>
        </table>
      )}
      <div className="flex items-center gap-3 mt-3 text-[13px] mu flex-wrap">
        {data?.resultats.map(x => <span key={x.algo} className="mono">{x.algo === 'bellman_ford' ? 'BF' : 'FW'} {fmtMs(x.temps_ms)}</span>)}
        <button className={`btn btn-sm ml-auto ${edition ? 'btn-on' : 'btn-gh'}`} onClick={() => { setEdition(e => !e); setBac(null) }}><Pencil size={13} />{edition ? 'Quitter le bac à sable' : 'Modifier le graphe (bac à sable)'}</button>
      </div>
      {edition && (
        <div className="mt-3 fileC">
          <Callout kind="warn" className="mb-3">Poids négatifs <b>artificiels</b> : ce ne sont pas des durées physiques.</Callout>
          <div className="overflow-auto" style={{ maxHeight: 180 }}>
            {arcs.map((a, k) => (
              <div key={k} className="flex items-center gap-2.5 py-1">
                <span className="mono w-20">{a.u} → {a.v}</span>
                <input className="inp mono w-24" type="number" value={a.w} onChange={e => setArcs(xs => xs.map((x, j) => (j === k ? { ...x, w: Number(e.target.value) } : x)))} />
                <button className="mu hover:text-ink" onClick={() => setArcs(xs => xs.filter((_, j) => j !== k))} title="Supprimer l’arc"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input className="inp mono w-16" value={nouv.u} onChange={e => setNouv(n => ({ ...n, u: e.target.value.toUpperCase().slice(0, 3) }))} aria-label="origine" />→
            <input className="inp mono w-16" value={nouv.v} onChange={e => setNouv(n => ({ ...n, v: e.target.value.toUpperCase().slice(0, 3) }))} aria-label="extrémité" />
            <input className="inp mono w-20" type="number" value={nouv.w} onChange={e => setNouv(n => ({ ...n, w: Number(e.target.value) }))} aria-label="poids" />
            <button className="btn btn-gh btn-sm" onClick={() => nouv.u && nouv.v && setArcs(xs => [...xs, { ...nouv }])}><Plus size={13} />Arc</button>
            <button className="btn btn-pri btn-sm ml-auto" onClick={lancer}><Play size={13} />Relancer les deux algorithmes</button>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function NegCycles() {
  return (
    <div className="grid gap-5">
      <Callout kind="warn">Poids négatifs <b>artificiels</b>, uniquement pour tester Bellman–Ford et Floyd–Warshall : les données métier n’ont aucun circuit absorbant.</Callout>
      <div className="grid gap-5 2xl:grid-cols-2">
        <Lab dataset="negatif_accessible" fig="Figure 4a · test A" titre="Circuit absorbant accessible depuis S" />
        <Lab dataset="negatif_inaccessible" fig="Figure 4b · test B" titre="Circuit absorbant non accessible depuis S" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Callout kind="def" title="Bellman–Ford">Un arc encore relâchable après <span className="math">|V| − 1</span> passes ⇒ circuit absorbant ; tout ce qu’il atteint vaut <b>−∞</b>.</Callout>
        <Callout kind="def" title="Floyd–Warshall"><span className="math">d[k][k] &lt; 0</span> ⇒ k est sur un circuit absorbant.</Callout>
        <Callout kind="rem" title="Test B">Le circuit existe mais S ne l’atteint pas : distances <b>finies</b>. Prenez C comme source pour voir −∞.</Callout>
      </div>
    </div>
  )
}
