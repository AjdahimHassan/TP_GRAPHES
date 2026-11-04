// Page 8 — Benchmarks : configuration, progression en direct (SSE), courbes log-log vs théorie, tableau.
import { Download, Image, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, ErrorBox, InfoCallout, Pill, Skeleton } from '../components/ui'
import { axis, Chart } from '../components/widgets'
import { api, figureUrl, saveBlob } from '../lib/api'
import { fmt } from '../lib/format'
import { useApi, useStore } from '../lib/store'
import type { BenchResult } from '../lib/types'
import { ALGO_COLOR, ALGO_LABEL } from '../theme/tokens'

const ALGOS = ['bfs', 'dfs', 'kruskal', 'prim', 'dijkstra', 'bellman_ford', 'floyd_warshall']
const DENS = ['faible', 'moyenne', 'forte']

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
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}<br/>n = ${p.value[0]} · ${fmt(p.value[1], 3)} ms` },
    legend: { data: ana.filter(a => a.algo !== 'floyd_warshall').map(a => a.nom), textStyle: { color: '#8592AE' } },
    xAxis: { type: 'log', name: '|V| (log)', nameLocation: 'middle', nameGap: 26, ...axis() },
    yAxis: { type: 'log', name: 'temps (ms, log)', ...axis() },
    series: ana.filter(a => a.algo !== 'floyd_warshall').flatMap(a => [
      { name: a.nom, type: 'line', symbol: 'circle', symbolSize: 7, lineStyle: { width: 2.4, color: ALGO_COLOR[a.algo] }, itemStyle: { color: ALGO_COLOR[a.algo] }, data: a.points.map(p => [p.V, p.mesure]) },
      { name: a.nom, type: 'line', symbol: 'none', lineStyle: { width: 1.2, type: 'dashed', color: ALGO_COLOR[a.algo], opacity: 0.55 }, data: a.points.map(p => [p.V, p.theorie]), tooltip: { show: false } },
    ]),
    grid: { left: 62, right: 20, top: 40, bottom: 46 },
  }), [ana])

  const lignes = data?.lignes ?? []
  const nRef = useMemo(() => {
    const ns = [...new Set(lignes.filter(l => l.algo !== 'floyd_warshall').map(l => l.n))].sort((a, b) => b - a)
    return ns.find(n => new Set(lignes.filter(l => l.n === n && l.algo !== 'floyd_warshall').map(l => l.densite)).size >= 2) ?? null
  }, [lignes])
  const densite = {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#8592AE' } },
    xAxis: { type: 'value', name: 'degré moyen visé', nameLocation: 'middle', nameGap: 26, min: 2, max: 13, ...axis() },
    yAxis: { type: 'log', name: 'temps (ms, log)', ...axis() },
    series: ALGOS.filter(a => a !== 'floyd_warshall').map(a => ({ name: ALGO_LABEL[a], type: 'line', symbol: 'circle', symbolSize: 7, itemStyle: { color: ALGO_COLOR[a] }, lineStyle: { color: ALGO_COLOR[a] }, data: lignes.filter(l => l.algo === a && l.n === nRef).sort((x, y) => x.degre_moyen - y.degre_moyen).map(l => [l.degre_moyen, l.moyenne_ms]) })).filter(x => x.data.length),
    grid: { left: 62, right: 20, top: 40, bottom: 46 },
  }
  const fw = lignes.filter(l => l.algo === 'floyd_warshall').sort((a, b) => a.n - b.n)
  const cFw = fw.length ? fw.reduce((t, r) => t + r.moyenne_ms * r.V ** 3, 0) / fw.reduce((t, r) => t + r.V ** 6, 0) : 0
  const floyd = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', name: '|V|', data: fw.map(r => r.V), ...axis() },
    yAxis: { type: 'value', name: 'temps (s)', ...axis() },
    series: [
      { name: 'mesure', type: 'bar', itemStyle: { color: '#FF9F43', borderRadius: [4, 4, 0, 0] }, data: fw.map(r => r.moyenne_ms / 1000) },
      { name: 'c·V³', type: 'line', lineStyle: { type: 'dashed', color: '#FFD166' }, itemStyle: { color: '#FFD166' }, data: fw.map(r => (cFw * r.V ** 3) / 1000) },
    ],
    grid: { left: 48, right: 14, top: 30, bottom: 36 },
  }
  const tailleTab = [...new Set(lignes.map(l => l.n))].sort((a, b) => a - b)
  const exporter = () => {
    const ent = Object.keys(lignes[0] ?? {})
    saveBlob(new Blob([[ent.join(','), ...lignes.map(l => ent.map(k => (l as any)[k] ?? '').join(','))].join('\n') + '\n'], { type: 'text/csv' }), 'bench.csv')
  }

  return (
    <div>
      <Card className="mb-3.5">
        <div className="flex gap-4 items-center flex-wrap">
          <span className="mu">Algorithmes</span>
          <div className="flex flex-wrap gap-1">{ALGOS.map(a => (
            <button key={a} className="chip" style={{ borderColor: algos.includes(a) ? ALGO_COLOR[a] + '88' : undefined, color: algos.includes(a) ? ALGO_COLOR[a] : '#5D6A88' }} onClick={() => setAlgos(x => (x.includes(a) ? x.filter(y => y !== a) : [...x, a]))}>
              {algos.includes(a) ? '✓' : '+'} {ALGO_LABEL[a]}{a === 'floyd_warshall' ? ' (n ≤ 400)' : ''}</button>
          ))}</div>
          <span className="mu">Tailles</span><input className="inp" style={{ width: 170 }} value={tailles} onChange={e => setTailles(e.target.value)} />
          <span className="mu">Densités</span>
          <div className="flex gap-1">{DENS.map(d => <button key={d} className="chip" style={{ color: dens.includes(d) ? '#fff' : '#5D6A88' }} onClick={() => setDens(x => (x.includes(d) ? x.filter(y => y !== d) : [...x, d]))}>{dens.includes(d) ? '✓' : '+'} {d}</button>)}</div>
          <span className="mu">Répétitions</span><input className="inp" type="number" min={5} style={{ width: 56 }} value={reps} onChange={e => setReps(Math.max(5, Number(e.target.value)))} />
          <span className="mu">Graine</span><input className="inp" type="number" style={{ width: 64 }} value={graine} onChange={e => setGraine(Number(e.target.value))} />
          <span className="flex-1" />
          <div style={{ width: 220 }}>
            <div className="bar"><div style={{ width: `${prog ? (prog.fait / prog.total) * 100 : data && !data.vide ? 100 : 0}%`, background: 'linear-gradient(90deg,#3DDC97,#2EE6D6)' }} /></div>
            <div className="mu mono text-[10.5px] mt-1 truncate">{prog ? `${prog.fait} / ${prog.total} · ${enCours ? prog.label : 'terminé'}` : data && !data.vide ? `${lignes.length} mesures · reports/bench.csv` : 'aucune mesure'}</div>
          </div>
          <button className="btn btn-pri" disabled={enCours} onClick={lancer}><Play size={12} fill="currentColor" />{enCours ? 'En cours…' : 'Lancer'}</button>
        </div>
        <div className="mu2 text-[11px] mt-2">Mêmes graphes pour tous les algorithmes · seul l'appel de l'algorithme est chronométré (perf_counter, traceur désactivé) · génération et chargement exclus · ≥ 5 répétitions.</div>
      </Card>

      {latest.error && <ErrorBox error={latest.error} />}
      {!data ? <Skeleton h={340} /> : data.vide ? <InfoCallout title="Aucune mesure">Lancez un benchmark ci-dessus ou en CLI : <span className="mono">novapolis bench --reps 5 --seed 42</span></InfoCallout> : (
        <>
          <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 380px' }}>
            <Card title={<>Temps d'exécution vs taille · log-log <span className="mu font-medium">· trait plein = mesure (moyenne de {lignes[0]?.reps}) · pointillé = complexité théorique ajustée</span></>}>
              <Chart option={loglog} height={360} />
            </Card>
            <div className="grid gap-3.5 content-start">
              <Card title="Floyd–Warshall · O(V³)">
                {fw.length ? <Chart option={floyd} height={210} /> : <div className="mu">non mesuré</div>}
                <div className="mu text-[11.5px]">Matrice V² en mémoire et triple boucle : à n = 5000 on estime ≈ {fmt((cFw * 5000 ** 3) / 60000, 0)} min et {fmt((5000 * 5000 * 8) / 1e6, 0)} Mo. Réservé aux petits graphes.</div>
              </Card>
              <Card title="Lecture automatique">
                {data.commentaires.map((c, k) => <div key={k} className="text-[11.5px] mu py-1 border-b border-[#141d35]">{c}</div>)}
              </Card>
            </div>
          </div>
          {nRef && <Card className="mt-3.5" title={`Temps vs densité · n = ${nRef}`}><Chart option={densite} height={280} /></Card>}
          <Card className="mt-3.5" title="Mesures · moyenne ± écart-type (ms)"
            right={<><button className="btn btn-gh btn-sm" onClick={exporter}><Download size={11} />CSV</button>
              {['fig1_loglog_temps_vs_n.png', 'fig2_temps_vs_densite.png', 'fig3_floyd_warshall.png', 'fig4_mesure_sur_theorie.png'].map((f, k) => <a key={f} className="btn btn-gh btn-sm" href={figureUrl(f)} target="_blank" rel="noreferrer"><Image size={11} />PNG {k + 1}</a>)}</>}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Algorithme</th><th>Complexité</th><th>Densité</th>{tailleTab.map(n => <th key={n} className="r">n = {n}</th>)}<th className="r">Pente mesurée</th><th className="r">Pente théorique</th></tr></thead>
                <tbody>{ALGOS.flatMap(a => [...new Set(lignes.filter(l => l.algo === a).map(l => l.densite))].map(d => {
                  const an = ana.find(x => x.algo === a && x.densite === d)
                  return (
                    <tr key={a + d}><td><span style={{ color: ALGO_COLOR[a] }}>●</span> <b>{ALGO_LABEL[a]}</b></td><td className="mono mu">{data.complexites[a]}</td><td className="mu">{d}</td>
                      {tailleTab.map(n => { const l = lignes.find(x => x.algo === a && x.densite === d && x.n === n); return <td key={n} className="r mono">{l ? <>{fmt(l.moyenne_ms, l.moyenne_ms < 10 ? 2 : 0)} <span className="mu2">±{fmt(l.ecart_type_ms, l.ecart_type_ms < 10 ? 2 : 0)}</span></> : ''}</td> })}
                      <td className="r mono">{an ? fmt(an.pente_mesuree, 2) : ''}</td><td className="r mono mu">{an ? fmt(an.pente_theorique, 2) : ''}</td></tr>
                  )
                }))}</tbody>
              </table>
            </div>
            <div className="mu2 text-[11px] mt-2">Bellman–Ford : colonne « passes » dans le CSV — l'arrêt anticipé termine après ≈ diamètre du graphe passes au lieu de |V|−1. <Pill>graine {lignes[0]?.graine}</Pill></div>
          </Card>
        </>
      )}
    </div>
  )
}
