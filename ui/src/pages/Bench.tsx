// Page 8 — Expériences : configuration, progression en direct (SSE), courbes log-log vs théorie, tableau des mesures.
import { Download, Image, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Callout, Card, ErrorBox, Pill, Skeleton } from '../components/ui'
import { axis, Chart } from '../components/widgets'
import { api, figureUrl, saveBlob } from '../lib/api'
import { fmt } from '../lib/format'
import { useApi, useStore } from '../lib/store'
import type { BenchResult } from '../lib/types'
import { ALGO_COLOR, ALGO_CPLX, ALGO_LABEL } from '../theme/tokens'

const ALGOS = ['bfs', 'dfs', 'kruskal', 'prim', 'dijkstra', 'bellman_ford', 'floyd_warshall']
const DENS = ['faible', 'moyenne', 'forte']
const INK2 = '#3A434F'

/** infobulle « réticule » : seules les séries mesurées (id « m-… ») sont listées. */
const tipMesures = (xLabel: (v: any) => string) => (ps: any[]) => {
  const rows = ps.filter(p => String(p.seriesId).startsWith('m-') && p.value)
  if (!rows.length) return ''
  return `<div style="font-weight:600;margin-bottom:4px">${xLabel(rows[0].value[0])}</div>` + rows
    .sort((a, b) => b.value[1] - a.value[1])
    .map(p => `<div style="display:flex;gap:10px;align-items:center"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>${p.seriesName}<b style="margin-left:auto;padding-left:14px">${fmt(p.value[1], 3)} ms</b></div>`).join('')
}

export default function Bench() {
  const s = useStore()
  const latest = useApi(() => api.benchLatest(), [])
  const [data, setData] = useState<BenchResult | null>(null)
  const [algos, setAlgos] = useState<string[]>(ALGOS)
  const [tailles, setTailles] = useState('250,500,1000,2000,5000')
  const [dens, setDens] = useState<string[]>(DENS)
  const [reps, setReps] = useState(5)
  const [graine, setGraine] = useState(42)
  const [prog, setProg] = useState<{ fait: number; total: number; label: string } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const es = useRef<EventSource | null>(null)
  useEffect(() => { if (latest.data) setData(latest.data) }, [latest.data])
  useEffect(() => () => es.current?.close(), [])

  const lancer = async () => {
    try {
      const { id } = await api.benchStart({ sizes: tailles.split(',').map(Number).filter(Boolean), densities: dens, reps: Math.max(5, reps), seed: graine, algos })
      setEnCours(true)
      setProg({ fait: 0, total: 1, label: 'démarrage…' })
      const src = api.benchEvents(id)
      es.current = src
      src.onmessage = e => { const d = JSON.parse(e.data); setProg({ fait: d.fait, total: d.total, label: `${ALGO_LABEL[d.algo]} · n = ${d.n} · ${d.densite}` }) }
      src.addEventListener('fin', async (e: any) => {
        src.close()
        setEnCours(false)
        const f = JSON.parse(e.data)
        if (f.etat === 'erreur') { s.toast('error', f.erreur); return }
        const r = await api.benchResult(id)
        if (r.resultat) { setData(r.resultat); s.setLastCalc({ label: 'Benchmarks', ms: null }); s.toast('ok', 'Benchmark terminé · reports/bench.csv mis à jour') }
      })
      src.onerror = () => { src.close(); setEnCours(false) }
    } catch (e: any) { s.toast('error', e.message) }
  }

  const ana = data?.analyse ?? []
  const loglog = useMemo(() => ({
    tooltip: { trigger: 'axis', formatter: tipMesures(v => `|V| = ${v}`) },
    legend: { data: ana.filter(a => a.algo !== 'floyd_warshall').map(a => a.nom) },
    xAxis: { type: 'log', name: 'nombre de sommets |V| (échelle log)', nameLocation: 'middle', nameGap: 30, ...axis() },
    yAxis: { type: 'log', name: 'temps (ms, échelle log)', nameLocation: 'middle', nameGap: 54, nameRotate: 90, ...axis() },
    series: ana.filter(a => a.algo !== 'floyd_warshall').flatMap(a => [
      { id: `m-${a.algo}`, name: a.nom, type: 'line', symbol: 'circle', symbolSize: 8, lineStyle: { width: 2, color: ALGO_COLOR[a.algo] }, itemStyle: { color: ALGO_COLOR[a.algo], borderColor: '#fff', borderWidth: 2 }, data: a.points.map(p => [p.V, p.mesure]) },
      { id: `t-${a.algo}`, name: a.nom, type: 'line', symbol: 'none', lineStyle: { width: 1.4, type: 'dashed', color: ALGO_COLOR[a.algo], opacity: 0.55 }, data: a.points.map(p => [p.V, p.theorie]), tooltip: { show: false } },
    ]),
    grid: { left: 84, right: 24, top: 58, bottom: 56 },
  }), [ana])

  const lignes = data?.lignes ?? []
  const nRef = useMemo(() => {
    const ns = [...new Set(lignes.filter(l => l.algo !== 'floyd_warshall').map(l => l.n))].sort((a, b) => b - a)
    return ns.find(n => new Set(lignes.filter(l => l.n === n && l.algo !== 'floyd_warshall').map(l => l.densite)).size >= 2) ?? null
  }, [lignes])
  const densite = {
    tooltip: { trigger: 'axis', formatter: tipMesures(v => `degré moyen ${v}`) },
    legend: {},
    xAxis: { type: 'value', name: 'degré moyen visé (densité)', nameLocation: 'middle', nameGap: 30, min: 2, max: 13, ...axis() },
    yAxis: { type: 'log', name: 'temps (ms, échelle log)', nameLocation: 'middle', nameGap: 54, nameRotate: 90, ...axis() },
    series: ALGOS.filter(a => a !== 'floyd_warshall').map(a => ({ id: `m-${a}`, name: ALGO_LABEL[a], type: 'line', symbol: 'circle', symbolSize: 8, itemStyle: { color: ALGO_COLOR[a], borderColor: '#fff', borderWidth: 2 }, lineStyle: { color: ALGO_COLOR[a], width: 2 }, data: lignes.filter(l => l.algo === a && l.n === nRef).sort((x, y) => x.degre_moyen - y.degre_moyen).map(l => [l.degre_moyen, l.moyenne_ms]) })).filter(x => x.data.length),
    grid: { left: 84, right: 24, top: 58, bottom: 56 },
  }
  const fw = lignes.filter(l => l.algo === 'floyd_warshall').sort((a, b) => a.n - b.n)
  const cFw = fw.length ? fw.reduce((t, r) => t + r.moyenne_ms * r.V ** 3, 0) / fw.reduce((t, r) => t + r.V ** 6, 0) : 0
  const floyd = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${fmt(v, 3)} s` },
    legend: {},
    xAxis: { type: 'category', name: 'nombre de sommets |V|', nameLocation: 'middle', nameGap: 28, data: fw.map(r => r.V), ...axis() },
    yAxis: { type: 'value', name: 'temps (s)', nameLocation: 'middle', nameGap: 42, nameRotate: 90, ...axis() },
    series: [
      { name: 'mesure (moyenne)', type: 'bar', barMaxWidth: 34, itemStyle: { color: ALGO_COLOR.floyd_warshall, borderRadius: [4, 4, 0, 0] }, data: fw.map(r => r.moyenne_ms / 1000) },
      { name: 'modèle c·V³', type: 'line', symbol: 'circle', symbolSize: 7, lineStyle: { type: 'dashed', color: INK2, width: 1.6 }, itemStyle: { color: INK2 }, data: fw.map(r => (cFw * r.V ** 3) / 1000) },
    ],
    grid: { left: 62, right: 18, top: 44, bottom: 50 },
  }
  const tailleTab = [...new Set(lignes.map(l => l.n))].sort((a, b) => a - b)
  const exporter = () => {
    const ent = Object.keys(lignes[0] ?? {})
    saveBlob(new Blob([[ent.join(','), ...lignes.map(l => ent.map(k => (l as any)[k] ?? '').join(','))].join('\n') + '\n'], { type: 'text/csv' }), 'bench.csv')
  }

  return (
    <div className="grid gap-5">
      <Card title="Protocole expérimental" sub="Mêmes graphes pour tous · algorithme seul chronométré · ≥ 5 répétitions · graines fixes">
        <div className="flex gap-x-6 gap-y-3 items-end flex-wrap">
          <div className="field">Algorithmes
            <div className="flex flex-wrap gap-1.5">{ALGOS.map(a => (
              <button key={a} className="check" style={algos.includes(a) ? { borderColor: 'var(--navy-line)', background: 'var(--navy-soft)', color: 'var(--navy)' } : undefined} onClick={() => setAlgos(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]))}>
                <i className="dot" style={{ background: ALGO_COLOR[a], opacity: algos.includes(a) ? 1 : 0.35 }} />{ALGO_LABEL[a]}{a === 'floyd_warshall' ? ' (n ≤ 400)' : ''}</button>
            ))}</div>
          </div>
          <div className="field">Tailles |V|<input className="inp mono" style={{ width: 200 }} value={tailles} onChange={e => setTailles(e.target.value)} /></div>
          <div className="field">Densités
            <div className="flex gap-1.5">{DENS.map(d => <button key={d} className="check" style={dens.includes(d) ? { borderColor: 'var(--navy-line)', background: 'var(--navy-soft)', color: 'var(--navy)' } : undefined} onClick={() => setDens(x => (x.includes(d) ? x.filter(y => y !== d) : [...x, d]))}>{dens.includes(d) ? '✓ ' : ''}{d}</button>)}</div>
          </div>
          <div className="field">Répétitions<input className="inp mono" type="number" min={5} style={{ width: 76 }} value={reps} onChange={e => setReps(Math.max(5, Number(e.target.value)))} /></div>
          <div className="field">Graine<input className="inp mono" type="number" style={{ width: 86 }} value={graine} onChange={e => setGraine(Number(e.target.value))} /></div>
          <span className="flex-1" />
          <div style={{ width: 260 }}>
            <div className="bar" style={{ height: 8 }}><div style={{ width: `${prog ? (prog.fait / prog.total) * 100 : data && !data.vide ? 100 : 0}%`, background: 'var(--navy)' }} /></div>
            <div className="mu mono text-[12.5px] mt-1.5 truncate">{prog ? `${prog.fait} / ${prog.total} · ${enCours ? prog.label : 'terminé'}` : data && !data.vide ? `${lignes.length} mesures · reports/bench.csv` : 'aucune mesure'}</div>
          </div>
          <button className="btn btn-pri" disabled={enCours} onClick={lancer}><Play size={14} fill="currentColor" />{enCours ? 'Mesure en cours…' : 'Lancer les mesures'}</button>
        </div>
      </Card>

      {latest.error && <ErrorBox error={latest.error} />}
      {!data ? <Skeleton h={360} /> : data.vide ? <Callout kind="rem" title="Aucune mesure">Lancez un benchmark ci-dessus ou en ligne de commande : <span className="mono">novapolis bench --reps 5 --seed 42</span></Callout> : (
        <>
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_480px]">
            <Card fig="Figure 8" title="Temps d’exécution en fonction de la taille" sub="trait plein = mesure · pointillés = complexité théorique ajustée">
              <Chart option={loglog} height={420} />
            </Card>
            <div className="grid gap-5 content-start">
              <Card fig="Figure 9" title={<>Floyd–Warshall · <span className="math">O(|V|³)</span></>}>
                {fw.length ? <Chart option={floyd} height={240} /> : <div className="mu">non mesuré</div>}
                <div className="text-[14px] text-ink2 mt-1">À n = 5 000 : ≈ <b>{fmt((cFw * 5000 ** 3) / 60000, 0)} min</b> et <b>{fmt((5000 * 5000 * 8) / 1e6, 0)} Mo</b> → limité à n ≤ 400.</div>
              </Card>
              <Card title="Lecture des résultats">
                {data.commentaires.map((c, k) => <div key={k} className="text-[14px] text-ink2 py-1.5" style={{ borderBottom: '1px solid var(--hair)' }}>{c}</div>)}
              </Card>
            </div>
          </div>
          {nRef && <Card fig="Figure 10" title={`Temps en fonction de la densité · n = ${nRef}`}><Chart option={densite} height={320} /></Card>}
          <Card fig="Tableau 7" title="Mesures · moyenne ± écart-type (ms)"
            right={<><button className="btn btn-gh btn-sm" onClick={exporter}><Download size={13} />CSV</button>
              {['fig1_loglog_temps_vs_n.png', 'fig2_temps_vs_densite.png', 'fig3_floyd_warshall.png', 'fig4_mesure_sur_theorie.png'].map((f, k) => <a key={f} className="btn btn-gh btn-sm" href={figureUrl(f)} target="_blank" rel="noreferrer"><Image size={13} />Figure {k + 1} (PNG)</a>)}</>}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Algorithme</th><th>Complexité</th><th>Densité</th>{tailleTab.map(n => <th key={n} className="r">n = {n}</th>)}<th className="r">Pente mesurée</th><th className="r">Pente théorique</th></tr></thead>
                <tbody>{ALGOS.flatMap(a => [...new Set(lignes.filter(l => l.algo === a).map(l => l.densite))].map(d => {
                  const an = ana.find(x => x.algo === a && x.densite === d)
                  return (
                    <tr key={a + d}><td><span className="inline-flex items-center gap-2"><i className="dot" style={{ background: ALGO_COLOR[a] }} /><b>{ALGO_LABEL[a]}</b></span></td><td className="math text-ink2">{ALGO_CPLX[a] ?? data.complexites[a]}</td><td className="mu">{d}</td>
                      {tailleTab.map(n => { const l = lignes.find(x => x.algo === a && x.densite === d && x.n === n); return <td key={n} className="r">{l ? <>{fmt(l.moyenne_ms, l.moyenne_ms < 10 ? 2 : 0)} <span className="mu text-[12.5px]">± {fmt(l.ecart_type_ms, l.ecart_type_ms < 10 ? 2 : 0)}</span></> : ''}</td> })}
                      <td className="r font-semibold">{an ? fmt(an.pente_mesuree, 2) : ''}</td><td className="r mu">{an ? fmt(an.pente_theorique, 2) : ''}</td></tr>
                  )
                }))}</tbody>
              </table>
            </div>
            <div className="caption mt-3 flex items-center gap-2 flex-wrap">Bellman–Ford : arrêt anticipé après ≈ diamètre passes, d’où une pente &lt; 2. <Pill>graine {lignes[0]?.graine}</Pill></div>
          </Card>
        </>
      )}
    </div>
  )
}
