// Page 3 — Accessibilité (M1) : BFS/DFS multi-source, connexité faible / forte, chemin minimal en arcs, seuil T.
import { MousePointerClick, Radar } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendLine } from '../components/NetworkCanvas'
import { Card, ErrorBox, InfoCallout, PathChips, Pill, Seg, Skeleton } from '../components/ui'
import { StepPlayer } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtMs } from '../lib/format'
import { useGraph, useLastCalc, useTypes } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { MinHop } from '../lib/types'
import { TYPE_COLOR } from '../theme/tokens'

const PALETTE = ['#3DDC97', '#7C8CFF', '#FFB547', '#A78BFA', '#2EE6D6', '#FF9F43', '#FFD166', '#FF5468', '#5BC0EB', '#C3F73A']

function lvlColor(l: number, max: number) {
  if (l < 0) return '#FF4D4D'
  const t = max ? l / max : 0
  const a = [61, 220, 151], b = [124, 140, 255], c = [167, 139, 250]
  const m = t < 0.5 ? a.map((x, i) => x + (b[i] - x) * t * 2) : b.map((x, i) => x + (c[i] - x) * (t - 0.5) * 2)
  return `#${m.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

const NOTIONS = {
  reach: { t: 'Depuis les sources', s: 'Sommets atteignables depuis ≥ 1 source', exp: <>Un sommet est <b>accessible</b> s'il existe un chemin <b>orienté</b> depuis au moins une source (BFS/DFS multi-source). C'est la notion utilisée par l'indicateur « quartiers desservis » et « sites non atteignables ».</> },
  weak: { t: 'Connexité faible', s: 'Graphe vu non orienté', exp: <>On <b>oublie le sens</b> des arcs : deux sites sont dans la même composante s'ils sont reliés par une suite de routes, quel que soit le sens. Utile pour repérer les sites <b>physiquement coupés</b> du réseau (site isolé).</> },
  scc: { t: 'Forte (CFC)', s: 'Tarjan · aller ET retour', exp: <>u et v sont <b>fortement connexes</b> si u ⇝ v <b>et</b> v ⇝ u. Un quartier atteignable depuis une caserne ne garantit pas le retour (sens uniques). Indicateur de <b>robustesse</b> : hors de la grande CFC, un véhicule peut entrer sans pouvoir ressortir.</> },
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
    if (replay) return (x: any) => (sourcesSet.has(x.id) ? TYPE_COLOR.caserne : x.id === replay.courant ? '#FFFFFF' : replay.front.includes(x.id) ? '#FFB547' : replay.vus.has(x.id) ? lvlColor(d.niveau[x.id], d.niveau_max) : '#1c2742')
    if (notion === 'reach') return (x: any) => (sourcesSet.has(x.id) ? TYPE_COLOR.caserne : lvlColor(d.niveau[x.id], d.niveau_max))
    if (notion === 'weak') return (x: any) => PALETTE[d.faible_index[x.id] % PALETTE.length]
    return (x: any) => (d.scc_index[x.id] === 0 ? '#3DDC97' : PALETTE[(d.scc_index[x.id] + 1) % PALETTE.length])
  }, [r.data, notion, replay])

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const d = r.data
  const onSite = (id: string) => {
    if (mode === 'chemin') { setSel(xs => (xs.length >= 2 ? [id] : [...xs, id])); setMh(null) }
  }
  const rings = notion === 'reach' ? d?.non_atteignables : notion === 'weak' ? d?.isoles : d?.scc.slice(1).flat().slice(0, 200)
  const paths = mh?.chemin ? [{ ids: mh.chemin, color: '#FFB547', animated: true }, ...(mh.chemin_plus_rapide.join() !== mh.chemin.join() ? [{ ids: mh.chemin_plus_rapide, color: '#2EE6D6', dashed: true, width: 2.5 }] : [])] : []

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 360px' }}>
      <div className="grid gap-3.5 content-start">
        <Card title={<>{NOTIONS[notion].t} <Pill kind="ok">{notion === 'reach' ? `${algo.toUpperCase()} multi-source` : notion === 'weak' ? 'BFS non orienté' : 'Tarjan'}</Pill></>}
          right={<>
            {notion === 'reach' && d && <span className="legend"><span><i style={{ background: lvlColor(0, 1) }} />niveau 0</span><span><i style={{ background: lvlColor(0.5, 1) }} />{Math.round(d.niveau_max / 2)}</span><span><i style={{ background: lvlColor(1, 1) }} />{d.niveau_max} arcs</span><span><i style={{ background: '#FF4D4D' }} />non atteignable</span></span>}
            <Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'bfs', l: 'BFS' }, { v: 'dfs', l: 'DFS' }]} />
            <select className="inp" value={sources} onChange={e => setSources(e.target.value)} style={{ padding: '3px 22px 3px 8px' }}>
              <option value="casernes">casernes</option><option value="hopitaux">hôpitaux</option><option value="casernes,hopitaux">casernes + hôpitaux</option>
            </select>
          </>}>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} decor={g.data.decor} height={500} nodeColor={nodeColor} rings={rings ?? []}
              cycle={voirCycle ? d?.cycle : null} paths={paths} selected={sel} onSiteClick={onSite} labels={sel}
              legend={<><LegendLine color="#FFB547" label="Chemin min. en arcs (BFS)" /><LegendLine color="#2EE6D6" label="Plus rapide (Dijkstra)" dashed /><LegendLine color="#FF5468" label="Circuit orienté détecté" /></>}
              overlay={mh && (
                <div className="mapover" style={{ right: 50, top: 10, maxWidth: 380 }}>
                  <div className="mu text-[11px] mb-1">Chemin minimisant le nombre d'arcs · BFS</div>
                  <PathChips path={mh.chemin} max={9} types={types} />
                  <div className="mono mt-1.5 text-[11px]"><b style={{ color: '#FFB547' }}>{mh.arcs ?? '∞'} arcs</b> · {fmt(mh.duree)} min <span className="mu">· le plus rapide : {fmt(mh.duree_plus_rapide)} min</span></div>
                </div>
              )} />
          ) : <Skeleton h={500} />}
          {d?.trace && (
            <div className="mt-3">
              <StepPlayer total={events.length} step={step ?? events.length} onStep={setStep} label={`étape ${step ?? events.length} / ${events.length}${d.trace.tronque ? ' (tronqué)' : ''}`} />
              <div className="flex gap-1.5 items-center mt-2 text-[11.5px] flex-wrap">
                <span className="mu">{algo === 'bfs' ? 'File' : 'Pile'} :</span>
                {(replay?.front ?? []).slice(0, 14).map(x => <span key={x} className="chip">{x}</span>)}
                {(replay?.taille ?? 0) > 14 && <span className="mu2">… {replay!.taille - 14} de plus</span>}
                {!replay && <span className="mu2">lancez la lecture ▶ pour rejouer le parcours (ordre de visite : {d.ordre.slice(0, 8).join(', ')}…)</span>}
                {replay && <span className="ml-auto mu">visités : <b className="mono text-white">{replay.vus.size}</b></span>}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-3.5 content-start">
        <Card title="Notion de connexité">
          <div className="notion">
            {(Object.keys(NOTIONS) as (keyof typeof NOTIONS)[]).map(k => (
              <button key={k} className={notion === k ? 'on' : ''} onClick={() => setNotion(k)}><b>{NOTIONS[k].t}</b><span>{NOTIONS[k].s}</span></button>
            ))}
          </div>
          <div className="callout mt-2.5">{NOTIONS[notion].exp}</div>
        </Card>
        <Card title="Résultats" right={d && <span className="mono mu text-[11px]">{fmtMs(d.temps_ms[algo])}</span>}>
          {!d ? <Skeleton h={150} /> : (
            <table className="tbl"><tbody>
              <tr><td>Sites atteignables</td><td className="r mono"><b>{d.atteignables}</b> / {d.total}</td></tr>
              <tr><td>Composantes faiblement connexes</td><td className="r mono">{d.nb_faible}</td></tr>
              <tr><td>Composantes fortement connexes</td><td className="r mono">{d.nb_scc} <span className="mu2">(max {d.plus_grande_scc})</span></td></tr>
              <tr><td>Composantes fibre (non orienté)</td><td className="r mono">{d.nb_fibre}</td></tr>
              <tr><td>Circuit orienté <label className="mu2 text-[10.5px] ml-1"><input type="checkbox" checked={voirCycle} onChange={e => setVoirCycle(e.target.checked)} /> afficher</label></td>
                <td className="r">{d.cycle ? <PathChips path={d.cycle} max={6} types={types} /> : <span className="mu">aucun</span>}</td></tr>
              <tr><td>Sites isolés (degré 0)</td><td className="r">{d.isoles.length ? d.isoles.map(x => <span key={x} className="chip chip-h ml-1">{x}</span>) : <span className="mu">aucun</span>}</td></tr>
              <tr><td>Non atteignables (casernes + hôpitaux)</td><td className="r mono">{d.non_atteignables_secours.length}</td></tr>
            </tbody></table>
          )}
          {d?.cycle?.length === 3 && <div className="mu2 text-[11px] mt-2">Une rue à double sens u ↔ v forme déjà un circuit de longueur 2.</div>}
        </Card>
        <Card title={<><MousePointerClick size={14} /> Chemin minimal en arcs</>} right={<button className={`btn btn-sm ${mode === 'chemin' ? 'btn-pri' : 'btn-gh'}`} onClick={() => { setMode(m => (m === 'chemin' ? 'aucun' : 'chemin')); setSel([]); setMh(null) }}>{mode === 'chemin' ? 'Annuler' : 'Choisir 2 sites'}</button>}>
          <div className="mu text-[12px]">{mode === 'chemin' ? (sel.length === 0 ? 'Cliquez le site de départ sur la carte…' : sel.length === 1 ? `Départ ${sel[0]} — cliquez l'arrivée…` : `${sel[0]} → ${sel[1]}`) : 'BFS + reconstruction par les parents ; comparé au chemin le plus rapide (Dijkstra).'}</div>
          {mh && !mh.chemin && <div className="banner ko mt-2">Aucun chemin orienté de {mh.u} vers {mh.v}</div>}
        </Card>
        <Card title={<><Radar size={14} /> Seuil d'intervention</>} right={<span className="mono" style={{ color: '#FFB547' }}>{seuil} min</span>}>
          <input type="range" min={2} max={30} value={seuil} onChange={e => setSeuil(Number(e.target.value))} />
          <div className="mt-2 mu">{d?.hors_delai.length ?? '—'} quartier(s) hors délai depuis toute caserne ou tout hôpital</div>
          <div className="flex flex-wrap gap-1 mt-1.5">{(d?.hors_delai ?? []).slice(0, 24).map(h => <span key={h.id} className="chip" title={`${fmt(h.temps)} min`}>{h.id} <span className="mu2">{fmt(h.temps, 1)}</span></span>)}</div>
        </Card>
        {d && d.nb_fibre > 1 && (
          <Card title="Composantes du réseau de fibre">
            {d.fibre_composantes.map((c, k) => <div key={k} className="text-[11.5px] py-1 border-b border-[#141d35]"><span className="mono mu2 mr-2">#{k + 1}</span><b className="mono">{c.length}</b> site(s) {c.length < 6 && <span className="mu">: {c.join(', ')}</span>}</div>)}
          </Card>
        )}
      </div>
      <InfoCallout title="Pourquoi trois notions ?">Pour un réseau routier <b>orienté</b>, la connexité ordinaire (faible) peut masquer des sens uniques : un quartier peut être relié physiquement au reste de la ville sans être atteignable depuis une caserne, ou atteignable sans pouvoir en repartir.</InfoCallout>
    </div>
  )
}
