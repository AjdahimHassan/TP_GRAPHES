// Page 3 — Module 1 : BFS/DFS multi-source, connexité faible / forte, chemin minimal en arcs, circuits, seuil T.
import { MousePointerClick, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendDot, LegendLine } from '../components/NetworkCanvas'
import { Callout, Card, ErrorBox, IdChip, PathChips, Pill, Seg, Skeleton } from '../components/ui'
import { StepPlayer } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtMs } from '../lib/format'
import { useGraph, useLastCalc, useTypes } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { MinHop } from '../lib/types'
import { LEVEL_RAMP, levelColor, MAP, SERIES, STATUS, TYPE_COLOR } from '../theme/tokens'

const AUTRES = '#b8b3a8'
const compColor = (rank: number) => (rank < 7 ? SERIES[rank] : AUTRES)

const NOTIONS = {
  reach: {
    t: 'Accessibilité', s: 'depuis les sources', algo: (a: string) => `${a.toUpperCase()} multi-source`,
    def: <>Il existe un chemin <b>orienté</b> <span className="math">s ⇝ v</span> depuis une source.</>,
    usage: 'sites atteignables / non atteignables',
  },
  weak: {
    t: 'Connexité faible', s: 'sens des arcs ignoré', algo: () => 'BFS non orienté',
    def: <>Reliés par des routes <b>quel que soit le sens</b>.</>,
    usage: 'sites isolés',
  },
  scc: {
    t: 'Connexité forte', s: 'aller ET retour', algo: () => 'Tarjan · O(|V| + |E|)',
    def: <><span className="math">u ⇝ v</span> <b>et</b> <span className="math">v ⇝ u</span> : on peut repartir d’où l’on est arrivé.</>,
    usage: 'robustesse (sens uniques)',
  },
}

/** rang de la composante (0 = la plus grande) pour chaque sommet, à partir d'une liste de composantes. */
function rangs(comps: string[][] | undefined) {
  const m = new Map<string, number>()
  if (!comps) return m
  const triees = [...comps].sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1))
  triees.forEach((c, k) => c.forEach(x => m.set(x, k)))
  return m
}

export default function Access() {
  const s = useStore()
  const g = useGraph()
  const types = useTypes(g.data)
  const [notion, setNotion] = useState<'reach' | 'weak' | 'scc'>('reach')
  const [algo, setAlgo] = useState<'bfs' | 'dfs'>('bfs')
  const [sources, setSources] = useState('casernes')
  const [seuil, setSeuil] = useState(10)
  const [seuilDeb, setSeuilDeb] = useState(10)
  const [mode, setMode] = useState<'aucun' | 'chemin'>('aucun')
  const [sel, setSel] = useState<string[]>([])
  const [mh, setMh] = useState<MinHop | null>(null)
  const [voirCycle, setVoirCycle] = useState(true)
  const [step, setStep] = useState<number | null>(null)
  useEffect(() => { const t = setTimeout(() => setSeuilDeb(seuil), 300); return () => clearTimeout(t) }, [seuil])

  const r = useApi(() => api.access({ dataset: s.dataset, scenario: s.scenario, periode: s.periode, sources, algo, trace: true, seuil: seuilDeb }), [s.dataset, s.scenario, s.periode, sources, algo, seuilDeb])
  useLastCalc(algo.toUpperCase(), r.data?.temps_ms?.[algo], [r.data])
  useEffect(() => setStep(null), [r.data])

  useEffect(() => {
    if (sel.length !== 2) return
    api.minhop({ dataset: s.dataset, scenario: s.scenario, periode: s.periode, u: sel[0], v: sel[1] }).then(setMh).catch(e => s.toast('error', e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  const ids = useMemo(() => g.data?.sites.map(x => x.id) ?? [], [g.data])
  const events = r.data?.trace?.events ?? []
  const rangFaible = useMemo(() => rangs(r.data?.faible), [r.data])
  const rangForte = useMemo(() => rangs(r.data?.scc), [r.data])
  // rejeu de la trace jusqu'à l'étape courante
  const replay = useMemo(() => {
    if (step === null) return null
    const vus = new Set<string>(), front: string[] = []
    let courant: string | null = null
    let taille = 0
    for (let k = 0; k < Math.min(step, events.length); k++) {
      const e = events[k]
      if (e.type === 'visite' && e.sommet !== undefined) { vus.add(ids[e.sommet]); courant = ids[e.sommet] }
      if (e.type === 'decouvre' && e.sommet !== undefined) vus.add(ids[e.sommet])
      if (e.file) { front.length = 0; e.file.forEach(i => front.push(ids[i])); taille = (e as any).taille ?? e.file.length }
      if (e.pile) { front.length = 0; e.pile.forEach(i => front.push(ids[i])); taille = (e as any).taille ?? e.pile.length }
    }
    return { vus, front, courant, taille }
  }, [step, events, ids])

  const nodeColor = useMemo(() => {
    const d = r.data
    if (!d) return undefined
    const sourcesSet = new Set(d.sources)
    if (replay) return (x: any) => (sourcesSet.has(x.id) ? TYPE_COLOR.caserne : x.id === replay.courant ? '#131A22' : replay.front.includes(x.id) ? STATUS.serious : replay.vus.has(x.id) ? levelColor(d.niveau[x.id], d.niveau_max) : '#DAD6CD')
    if (notion === 'reach') return (x: any) => (sourcesSet.has(x.id) ? TYPE_COLOR.caserne : levelColor(d.niveau[x.id], d.niveau_max))
    if (notion === 'weak') return (x: any) => compColor(rangFaible.get(x.id) ?? 99)
    return (x: any) => compColor(rangForte.get(x.id) ?? 99)
  }, [r.data, notion, replay, rangFaible, rangForte])

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const d = r.data
  const onSite = (id: string) => {
    if (mode === 'chemin') { setSel(xs => (xs.length >= 2 ? [id] : [...xs, id])); setMh(null) }
  }
  const rings = notion === 'reach' ? d?.non_atteignables : notion === 'weak' ? d?.isoles : d?.scc.slice(1).flat().slice(0, 200)
  const paths = mh?.chemin ? [{ ids: mh.chemin, color: MAP.alt, animated: true }, ...(mh.chemin_plus_rapide.join() !== mh.chemin.join() ? [{ ids: mh.chemin_plus_rapide, color: '#131A22', dashed: true, width: 2.6 }] : [])] : []
  const comps = notion === 'weak' ? d?.faible : notion === 'scc' ? d?.scc : null
  const compsTriees = comps ? [...comps].sort((a, b) => b.length - a.length) : []
  const N = NOTIONS[notion]

  const legende = notion === 'reach' && d ? (
    <>
      <span className="flex items-center gap-2"><span className="mu">niveau BFS</span><span className="mono text-[12px]">0</span>
        <i style={{ width: 90, height: 9, borderRadius: 3, background: `linear-gradient(90deg, ${LEVEL_RAMP.join(',')})` }} /><span className="mono text-[12px]">{d.niveau_max} arcs</span></span>
      <LegendDot color={TYPE_COLOR.caserne} label="source (caserne)" />
      <LegendDot color={STATUS.critical} label="non atteignable" />
      {d.cycle && voirCycle && <LegendLine color={MAP.cycle} label="circuit orienté détecté" />}
      {mh?.chemin && <><LegendLine color={MAP.alt} label="moins d’arcs (BFS)" /><LegendLine color="#131A22" label="plus rapide (Dijkstra)" dashed /></>}
    </>
  ) : d && comps ? (
    <>
      {compsTriees.slice(0, 7).map((c, k) => <LegendDot key={k} color={compColor(k)} label={<>composante {k + 1} · <b className="num">{c.length}</b> site{c.length > 1 ? 's' : ''}</>} />)}
      {compsTriees.length > 7 && <LegendDot color={AUTRES} label={`${compsTriees.length - 7} autres`} />}
    </>
  ) : null

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-5 content-start min-w-0">
        <Card fig="Figure 2" title={<>{notion === 'reach' ? `Accessibilité depuis les ${sources === 'casernes' ? 'casernes' : sources === 'hopitaux' ? 'hôpitaux' : 'casernes et hôpitaux'}` : N.t} <Pill kind="in">{N.algo(algo)}</Pill></>}
          right={<>
            <Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'bfs', l: 'BFS' }, { v: 'dfs', l: 'DFS' }]} />
            <select className="inp" value={sources} onChange={e => setSources(e.target.value)} aria-label="Sources">
              <option value="casernes">depuis les casernes</option><option value="hopitaux">depuis les hôpitaux</option><option value="casernes,hopitaux">casernes + hôpitaux</option>
            </select>
          </>}>
          {legende && <div className="legend mb-3">{legende}</div>}
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} decor={g.data.decor} height="clamp(380px, calc(100vh - 390px), 640px)" nodeColor={nodeColor} rings={rings ?? []}
              cycle={voirCycle ? d?.cycle : null} paths={paths} selected={sel} onSiteClick={onSite} labels={sel}
              overlay={mh && (
                <div className="mapover" style={{ left: 12, top: 12, maxWidth: 440 }}>
                  <div className="lbl mb-1.5">Chemin minimisant le nombre d’arcs (BFS)</div>
                  <PathChips path={mh.chemin} max={9} types={types} />
                  <div className="mt-2 text-[14px]"><b style={{ color: 'var(--ink)' }}>{mh.arcs ?? '∞'} arcs</b> · {fmt(mh.duree)} min <span className="mu">· le plus rapide : {fmt(mh.duree_plus_rapide)} min</span></div>
                </div>
              )} />
          ) : <Skeleton h={520} />}
          {d?.trace && (
            <div className="mt-3">
              <StepPlayer total={events.length} step={step ?? events.length} onStep={setStep} label={`étape ${step ?? events.length} / ${events.length}${d.trace.tronque ? ' (tronqué)' : ''}`} />
              <div className="flex gap-1.5 items-center mt-2.5 text-[13.5px] flex-wrap">
                <span className="mu font-medium">{algo === 'bfs' ? 'File (FIFO)' : 'Pile (LIFO)'} :</span>
                {(replay?.front ?? []).slice(0, 14).map(x => <IdChip key={x} id={x} types={types} />)}
                {(replay?.taille ?? 0) > 14 && <span className="mu">… {replay!.taille - 14} de plus</span>}
                {!replay && <span className="mu">lancez la lecture ▶ pour rejouer le parcours · ordre de visite : <span className="mono">{d.ordre.slice(0, 8).join(', ')}…</span></span>}
                {replay && <span className="ml-auto mu">sites visités : <b className="mono text-ink">{replay.vus.size}</b></span>}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 content-start">
        <Card title="Trois notions de connexité">
          <div className="notion">
            {(Object.keys(NOTIONS) as (keyof typeof NOTIONS)[]).map(k => (
              <button key={k} className={notion === k ? 'on' : ''} onClick={() => setNotion(k)}><b>{NOTIONS[k].t}</b><span>{NOTIONS[k].s}</span></button>
            ))}
          </div>
          <Callout kind="def" className="mt-3">{N.def} <span className="mu">→ {N.usage}</span></Callout>
        </Card>

        <Card fig="Tableau 2" title="Résultats du diagnostic" right={d && <span className="mono mu text-[13px]" title="Temps du parcours seul">{fmtMs(d.temps_ms[algo])}</span>}>
          {!d ? <Skeleton h={180} /> : (
            <table className="tbl kv"><tbody>
              <tr><td>Sites atteignables depuis les sources</td><td className="r"><b className="text-[16px]">{d.atteignables}</b> <span className="mu">/ {d.total}</span></td></tr>
              <tr><td>Composantes faiblement connexes</td><td className="r font-semibold">{d.nb_faible}</td></tr>
              <tr><td>Composantes fortement connexes</td><td className="r"><b>{d.nb_scc}</b> <span className="mu">(la plus grande : {d.plus_grande_scc})</span></td></tr>
              <tr><td>Composantes du réseau de fibre</td><td className="r font-semibold">{d.nb_fibre}</td></tr>
              <tr><td>Circuit orienté (DFS 3 couleurs) <label className="mu text-[12.5px] ml-1 cursor-pointer"><input type="checkbox" checked={voirCycle} onChange={e => setVoirCycle(e.target.checked)} /> voir</label></td>
                <td className="r">{d.cycle ? <PathChips path={d.cycle} max={6} types={types} /> : <span className="mu">aucun</span>}</td></tr>
              <tr><td>Sites isolés (degré 0)</td><td className="r">{d.isoles.length ? <span className="inline-flex gap-1 flex-wrap justify-end">{d.isoles.map(x => <span key={x} className="chip chip-ko">{x}</span>)}</span> : <span className="mu">aucun</span>}</td></tr>
              <tr><td>Non atteignables depuis casernes + hôpitaux</td><td className="r font-semibold" style={{ color: d.non_atteignables_secours.length ? 'var(--ko)' : undefined }}>{d.non_atteignables_secours.length}</td></tr>
            </tbody></table>
          )}
        </Card>

        <Card title={<><MousePointerClick size={18} /> Itinéraire minimal en nombre d’arcs</>} right={<button className={`btn btn-sm ${mode === 'chemin' ? 'btn-on' : 'btn-gh'}`} onClick={() => { setMode(m => (m === 'chemin' ? 'aucun' : 'chemin')); setSel([]); setMh(null) }}>{mode === 'chemin' ? 'Annuler' : 'Choisir 2 sites'}</button>}>
          <div className="text-[14px] text-ink2">{mode === 'chemin' ? (sel.length === 0 ? 'Cliquez le départ sur la carte…' : sel.length === 1 ? <>Départ <span className="mono">{sel[0]}</span> — cliquez l’arrivée…</> : <><span className="mono">{sel[0]}</span> → <span className="mono">{sel[1]}</span></>) : 'BFS vs Dijkstra entre deux sites.'}</div>
          {mh && !mh.chemin && <div className="banner ko mt-2.5">Aucun chemin orienté de {mh.u} vers {mh.v}</div>}
        </Card>

        <Card title={<><Timer size={18} /> Seuil d’intervention T</>} right={<span className="big" style={{ fontSize: 22 }}>{seuil}<small>min</small></span>}>
          <input type="range" min={2} max={30} value={seuil} onChange={e => setSeuil(Number(e.target.value))} aria-label="Seuil T en minutes" />
          <div className="mt-2 text-[14px]"><b>{d?.hors_delai.length ?? '—'}</b> quartier(s) à plus de {seuil} min des secours</div>
          <div className="flex flex-wrap gap-1.5 mt-2">{(d?.hors_delai ?? []).slice(0, 24).map(h => <span key={h.id} className="chip" title={`${fmt(h.temps)} min`}>{h.id} <span className="mu">{fmt(h.temps, 1)}</span></span>)}</div>
        </Card>

        {d && d.nb_fibre > 1 && (
          <Card title="Composantes du réseau de fibre">
            {[...d.fibre_composantes].sort((a, b) => b.length - a.length).map((c, k) => <div key={k} className="text-[14px] py-1.5" style={{ borderBottom: '1px solid var(--hair)' }}><span className="mono mu mr-2">#{k + 1}</span><b className="num">{c.length}</b> site(s) {c.length < 6 && <span className="mu">: <span className="mono">{c.join(', ')}</span></span>}</div>)}
          </Card>
        )}
      </div>
    </div>
  )
}
