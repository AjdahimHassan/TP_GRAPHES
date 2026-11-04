// Page 4 — Itinéraires secours (M2) : demandes, itinéraire animé, comparaison Dijkstra / Bellman–Ford / Floyd–Warshall.
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendLine } from '../components/NetworkCanvas'
import { Card, ErrorBox, PathChips, Pill, Prio, Seg, Skeleton } from '../components/ui'
import { api, saveBlob } from '../lib/api'
import { fmt, fmtMs, isFinite_ } from '../lib/format'
import { useGraph, useLastCalc, useTypes } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { RouteRow } from '../lib/types'
import { ALGO_LABEL, scenLabel } from '../theme/tokens'

const SOUS = { dijkstra: 'tas binaire', bellman_ford: '|V|−1 passes', floyd_warshall: 'toutes paires' } as Record<string, string>

function Limites() {
  const [open, setOpen] = useState(false)
  return (
    <div className="callout mt-3">
      <button className="flex items-center gap-1 font-semibold text-white" onClick={() => setOpen(o => !o)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Limites du modèle</button>
      {open ? (
        <ul className="list-disc ml-5 mt-1.5 space-y-0.5">
          <li><b>Temps statiques</b> : deux valeurs par arc (normal / pointe), pas de trafic en temps réel.</li>
          <li>Les <b>travaux</b> sont modélisés par un facteur ×1,5 (hypothèse) ; une fermeture retire l'arc.</li>
          <li><b>Une seule intervention à la fois</b> : la caserne la plus proche est supposée disponible (capacité ignorée).</li>
          <li><b>Incidents simultanés ignorés</b>, pas de file d'attente ni de priorisation dynamique.</li>
          <li>Temps de traversée des carrefours, feux, véhicules prioritaires : non modélisés.</li>
          <li><b>Qualité des données</b> : jeu synthétique ; un chemin de coût minimal ne garantit pas une intervention réaliste.</li>
        </ul>
      ) : <span className="ml-1">temps statiques, pas de trafic temps réel, capacité des casernes et incidents simultanés ignorés…</span>}
    </div>
  )
}

export default function RoutesPage() {
  const s = useStore()
  const g = useGraph()
  const types = useTypes(g.data)
  const ctx = { dataset: s.dataset, scenario: s.scenario, periode: s.periode }
  const rts = useApi(() => api.routes(ctx), [s.dataset, s.scenario, s.periode])
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'retard' | 'inacc' | 'P1'>('tous')
  const [tri, setTri] = useState<{ k: keyof RouteRow; asc: boolean }>({ k: 'demande', asc: true })
  const d = s.param('d')
  const lignes = rts.data?.lignes ?? []

  useEffect(() => {
    if (!rts.data || (d && lignes.some(l => l.demande === d))) return
    const best = [...lignes].filter(l => l.retard !== null && l.retard > 0).sort((a, b) => (b.retard ?? 0) - (a.retard ?? 0))[0] ?? lignes.find(l => l.statut === 'accessible') ?? lignes[0]
    if (best) s.setParam('d', best.demande)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rts.data])

  const route = useApi(() => api.route({ ...ctx, demande: d!, algo: 'all' }), [s.dataset, s.scenario, s.periode, d], { enabled: !!d && lignes.some(l => l.demande === d) })
  useLastCalc('Dijkstra', route.data?.algos.find(a => a.algo === 'dijkstra')?.temps_ms, [route.data])

  const liste = useMemo(() => lignes.filter(l => {
    if (q && !(l.demande + l.site + l.type).toLowerCase().includes(q.toLowerCase())) return false
    if (filtre === 'retard') return (l.retard ?? 0) > 1e-9
    if (filtre === 'inacc') return l.statut === 'inaccessible'
    if (filtre === 'P1') return l.priorite === 1
    return true
  }), [lignes, q, filtre])

  const triees = useMemo(() => {
    const val = (l: RouteRow) => { const v = l[tri.k] as any; return v === '+inf' ? Infinity : v === null ? -Infinity : v }
    return [...lignes].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (tri.asc ? 1 : -1) })
  }, [lignes, tri])

  const exporter = () => {
    const ent = ['demande', 'type', 'priorite', 'site', 'caserne', 'avant_min', 'apres_min', 'retard_min', 'retard_pct', 'statut', 'chemin']
    const lig = lignes.map(l => [l.demande, l.type, l.priorite, l.site, l.caserne_apres ?? '', l.avant, l.apres, l.retard ?? '', l.retard_pct ?? '', l.statut, l.chemin.join(' > ')].join(','))
    saveBlob(new Blob([[ent.join(','), ...lig].join('\n') + '\n'], { type: 'text/csv' }), `routes_${s.dataset}_${s.scenario}.csv`)
  }

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const aa = route.data?.avant_apres
  const acc = aa?.statut === 'accessible'
  const fermees = (g.data?.routes ?? []).filter(r => r.statut === 'ferme')
  const th = (k: keyof RouteRow, l: string, r = false) => <th className={r ? 'r cursor-pointer' : 'cursor-pointer'} onClick={() => setTri(t => ({ k, asc: t.k === k ? !t.asc : true }))}>{l}{tri.k === k ? (tri.asc ? ' ▲' : ' ▼') : ''}</th>

  return (
    <div>
      <div className="grid gap-3.5 mb-3.5" style={{ gridTemplateColumns: '250px 1fr 330px' }}>
        <Card title="Demandes" right={<Pill>{lignes.length}</Pill>} style={{ padding: 12 }}>
          <div className="flex items-center gap-1.5 inp mb-2"><Search size={12} className="mu" /><input className="bg-transparent outline-none flex-1" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}><X size={11} /></button>}</div>
          <div className="mb-2"><Seg value={filtre} onChange={setFiltre} size="sm" options={[{ v: 'tous', l: 'Toutes' }, { v: 'retard', l: 'Retard' }, { v: 'inacc', l: 'Inacc.' }, { v: 'P1', l: 'P1' }]} /></div>
          <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
            {rts.loading && !rts.data && <Skeleton h={300} />}
            {liste.map(x => {
              const ok = x.statut === 'accessible'
              const retard = (x.retard ?? 0) > 1e-9
              return (
                <div key={x.demande} className={`dem ${x.demande === d ? 'on' : ''}`} onClick={() => s.setParam('d', x.demande)}>
                  <div className="flex items-center gap-[7px]"><b className="mono">{x.demande}</b><Prio p={x.priorite} /><span className="mu text-[11.5px] truncate">{x.type}</span>
                    <span className="ml-auto w-[7px] h-[7px] rounded-full shrink-0" style={{ background: ok ? (retard ? '#FFB547' : '#3DDC97') : '#FF4D4D' }} /></div>
                  <div className="mu text-[11px] mt-[3px]">→ <span className="mono">{x.site}</span> · {ok ? `${fmt(x.apres)} min` : 'inaccessible'}{retard && <span style={{ color: '#FFB547' }}> (+{fmt(x.retard)})</span>}</div>
                </div>
              )
            })}
            {rts.data && !liste.length && <div className="mu text-[12px]">Aucune demande.</div>}
          </div>
        </Card>

        <Card title={<>Itinéraire {d} {s.scenario !== 'normal' && <Pill kind="ko">{scenLabel(s.scenario)}</Pill>}<Pill>{rts.data?.periode ?? s.effectivePeriode}</Pill></>}
          right={<span className="legend"><span><i className="ln" style={{ background: '#FFB547' }} />après</span><span><i className="ln" style={{ background: '#8592AE' }} />avant</span><span><i className="ln" style={{ background: '#FF4D4D' }} />fermé</span></span>}>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} decor={g.data.decor} height={470} focus={aa && !acc ? aa.site : null}
              paths={aa ? [...(aa.chemin_avant.length && aa.chemin_avant.join() !== aa.chemin.join() ? [{ ids: aa.chemin_avant, color: '#8592AE', dashed: true, width: 3 }] : []), ...(acc ? [{ ids: aa.chemin, color: '#FFB547', animated: true }] : [])] : []}
              labels={aa ? [aa.site, ...(aa.caserne_apres ? [aa.caserne_apres] : []), ...(aa.caserne_avant && aa.caserne_avant !== aa.caserne_apres ? [aa.caserne_avant] : [])] : []}
              rings={aa && !acc ? [aa.site] : []}
              legend={fermees.length ? <LegendLine color="#FF4D4D" label={`${fermees.length} arc(s) fermé(s)`} dashed /> : undefined} />
          ) : <Skeleton h={470} />}
          <Limites />
        </Card>

        <div className="grid gap-3.5 content-start">
          <Card title="Comparaison des algorithmes" right={route.data && (route.data.identiques ? <Pill kind="ok">✓ identiques</Pill> : <Pill kind="ko">✗ différents</Pill>)}>
            {route.loading && !route.data && <Skeleton h={150} />}
            {route.error && <ErrorBox error={route.error} />}
            {route.data?.algos.map(a => (
              <div key={a.algo} className="algo">
                <div><div className="font-semibold">{ALGO_LABEL[a.algo]}</div><div className="mu2 text-[10.5px]">{a.ignore ? a.raison : SOUS[a.algo]}{a.passes ? ` · ${a.passes} passes` : ''}</div></div>
                <span className="mono">{a.ignore ? '—' : `${fmt(a.dist)} min`}</span>
                <span className="mono mu">{a.arcs ?? '—'} arcs</span>
                <span className="mono" style={{ color: '#2EE6D6' }}>{fmtMs(a.temps_ms)}</span>
              </div>
            ))}
          </Card>
          <Card title="Avant / après perturbation">
            {!aa ? <Skeleton h={160} /> : acc ? (
              <>
                <div className="ba">
                  <div><div className="lbl">Normal</div><div className="big">{fmt(aa.avant)}<small className="mu text-[12px]"> min</small></div><div className="mu mono text-[11px]">{aa.arcs_avant ?? '—'} arcs</div></div>
                  <div className="mu2 text-center">→</div>
                  <div><div className="lbl">{scenLabel(s.scenario)}</div><div className="big" style={{ color: (aa.retard ?? 0) > 0 ? '#FFB547' : undefined }}>{fmt(aa.apres)}<small className="mu text-[12px]"> min</small></div><div className="mu mono text-[11px]">{aa.arcs} arcs</div></div>
                </div>
                <div className="flex gap-2 my-2.5 flex-wrap">
                  <Pill kind={(aa.retard ?? 0) > 0 ? 'am' : 'ok'}>+{fmt(aa.retard)} min</Pill><Pill kind={(aa.retard ?? 0) > 0 ? 'am' : 'ok'}>+{fmt(aa.retard_pct, 0)} %</Pill><Pill kind="ok">accessible</Pill>
                </div>
                <div className="mu text-[11px] mb-1">Caserne retenue : <span className="chip chip-c">{aa.caserne_apres}</span>{aa.caserne_avant !== aa.caserne_apres && <> (avant : <span className="chip chip-c">{aa.caserne_avant}</span>)</>}</div>
                <PathChips path={aa.chemin} types={types} />
                <div className="mu text-[11px] mt-2.5 mb-1">Fermetures sur l'ancien chemin</div>
                <div className="flex flex-wrap gap-1">{aa.fermetures_sur_chemin_initial.length ? aa.fermetures_sur_chemin_initial.map(x => <span key={x} className="chip chip-h">{x.replace('->', ' → ')}</span>) : <span className="mu2">aucune</span>}</div>
                {!!aa.fermetures_proches.length && <><div className="mu text-[11px] mt-2 mb-1">Fermetures à proximité du nouveau chemin</div><div className="flex flex-wrap gap-1">{aa.fermetures_proches.slice(0, 8).map(x => <span key={x} className="chip">{x.replace('->', ' → ')}</span>)}</div></>}
              </>
            ) : (
              <div className="banner ko"><X size={16} /><div><b>Inaccessible</b><br /><span className="text-[11.5px]">{aa.site} n'est atteignable depuis aucune caserne : distance = +∞{aa.statut_avant === 'accessible' ? ` (accessible avant la perturbation : ${fmt(aa.avant)} min)` : ' dans ce scénario comme dans la base'}.</span></div></div>
            )}
          </Card>
        </div>
      </div>

      <Card title={<>Toutes les demandes · scénario « {scenLabel(s.scenario)} »</>}
        right={<>{rts.data && <span className="mu text-[11.5px]">{rts.data.resume.accessibles}/{rts.data.resume.demandes} accessibles · retard moyen +{fmt(rts.data.resume.retard_moyen)} min · max +{fmt(rts.data.resume.retard_max)} min</span>}<button className="btn btn-gh btn-sm" onClick={exporter}><Download size={11} />Exporter CSV</button></>}>
        <div className="overflow-auto" style={{ maxHeight: 420 }}>
          <table className="tbl">
            <thead><tr>{th('demande', 'Demande')}{th('priorite', 'Type')}{th('site', 'Site')}{th('caserne_apres', 'Caserne')}{th('avant', 'Avant (min)', true)}{th('apres', 'Après (min)', true)}{th('retard', 'Retard', true)}{th('retard_pct', 'Relatif', true)}{th('statut', 'Statut')}<th>Chemin retenu</th></tr></thead>
            <tbody>{triees.map(x => {
              const retard = (x.retard ?? 0) > 1e-9
              return (
                <tr key={x.demande} className="cursor-pointer" onClick={() => s.setParam('d', x.demande)} style={x.demande === d ? { background: '#141f3a' } : undefined}>
                  <td className="mono"><b>{x.demande}</b></td><td><Prio p={x.priorite} /> {x.type}</td><td className="mono">{x.site}</td><td className="mono">{x.caserne_apres ?? '—'}</td>
                  <td className="r mono">{fmt(x.avant)}</td><td className="r mono">{fmt(x.apres)}</td>
                  <td className="r mono" style={{ color: retard ? '#FFB547' : '#8592AE' }}>{x.retard !== null ? `+${fmt(x.retard)}` : '—'}</td>
                  <td className="r mono" style={{ color: retard ? '#FFB547' : '#8592AE' }}>{x.retard_pct !== null ? `+${fmt(x.retard_pct, 0)} %` : '—'}</td>
                  <td>{x.statut === 'accessible' ? <Pill kind="ok">accessible</Pill> : <Pill kind="ko">inaccessible</Pill>}</td>
                  <td style={{ maxWidth: 340, overflow: 'hidden' }}>{isFinite_(x.apres) ? <PathChips path={x.chemin} max={6} types={types} /> : <span className="mu2">aucun chemin</span>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
