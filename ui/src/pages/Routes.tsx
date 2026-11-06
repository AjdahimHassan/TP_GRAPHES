// Page 4 — Module 2 : itinéraire d'une demande, avant / après perturbation, Dijkstra vs Bellman–Ford vs Floyd–Warshall.
import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendLine } from '../components/NetworkCanvas'
import { Card, ErrorBox, IdChip, PathChips, Pill, Prio, Seg, Skeleton } from '../components/ui'
import { api, saveBlob } from '../lib/api'
import { fmt, fmtMs, isFinite_ } from '../lib/format'
import { useGraph, useLastCalc, useTypes } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { RouteRow } from '../lib/types'
import { ALGO_CPLX, ALGO_LABEL, MAP, scenColor, scenLabel } from '../theme/tokens'

const SOUS: Record<string, string> = { dijkstra: 'tas binaire, poids ≥ 0', bellman_ford: '|V| − 1 passes max.', floyd_warshall: 'toutes les paires' }

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

  const triees = useMemo(() => {
    const val = (l: RouteRow) => { const v = l[tri.k] as any; return v === '+inf' ? Infinity : v === null ? -Infinity : v }
    return [...lignes]
      .filter(l => {
        if (q && !(l.demande + ' ' + l.site + ' ' + l.type).toLowerCase().includes(q.toLowerCase())) return false
        if (filtre === 'retard') return (l.retard ?? 0) > 1e-9
        if (filtre === 'inacc') return l.statut === 'inaccessible'
        if (filtre === 'P1') return l.priorite === 1
        return true
      })
      .sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (tri.asc ? 1 : -1) })
  }, [lignes, tri, q, filtre])

  const exporter = () => {
    const ent = ['demande', 'type', 'priorite', 'site', 'caserne', 'avant_min', 'apres_min', 'retard_min', 'retard_pct', 'statut', 'chemin']
    const lig = lignes.map(l => [l.demande, l.type, l.priorite, l.site, l.caserne_apres ?? '', l.avant, l.apres, l.retard ?? '', l.retard_pct ?? '', l.statut, l.chemin.join(' > ')].join(','))
    saveBlob(new Blob([[ent.join(','), ...lig].join('\n') + '\n'], { type: 'text/csv' }), `routes_${s.dataset}_${s.scenario}.csv`)
  }

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const aa = route.data?.avant_apres
  const acc = aa?.statut === 'accessible'
  const fermees = (g.data?.routes ?? []).filter(r => r.statut === 'ferme')
  const idx = lignes.findIndex(l => l.demande === d)
  const pas = (k: number) => { const n = lignes[(idx + k + lignes.length) % lignes.length]; if (n) s.setParam('d', n.demande) }
  const th = (k: keyof RouteRow, l: string, r = false) => <th className={`${r ? 'r ' : ''}cursor-pointer select-none`} onClick={() => setTri(t => ({ k, asc: t.k === k ? !t.asc : true }))}>{l}{tri.k === k ? (tri.asc ? ' ▲' : ' ▼') : ''}</th>
  const iScen = Math.max(0, (g.data?.scenarios ?? []).indexOf(s.scenario))
  const retardOk = (aa?.retard ?? 0) > 1e-9

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <Card fig="Figure 3" title={<>Itinéraire de secours · demande <span className="mono">{d ?? '—'}</span> <Pill kind={s.scenario === 'normal' ? 'mu' : 'in'}><i className="dot" style={{ background: scenColor(iScen) }} />{scenLabel(s.scenario)}</Pill><Pill>période {rts.data?.periode ?? s.effectivePeriode}</Pill></>}>
          <div className="legend mb-3">
            <LegendLine color={MAP.path} label={s.scenario === 'normal' ? 'itinéraire retenu' : 'itinéraire après perturbation'} />
            {s.scenario !== 'normal' && <LegendLine color={MAP.before} label="itinéraire avant (situation normale)" dashed />}
            <LegendLine color={MAP.closed} label={`route fermée${fermees.length ? ` (${fermees.length} arcs)` : ''}`} dashed />
            <LegendLine color={MAP.works} label="travaux" dashed />
          </div>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} decor={g.data.decor} height="clamp(380px, calc(100vh - 370px), 660px)" focus={aa && !acc ? aa.site : null}
              paths={aa ? [...(aa.chemin_avant.length && aa.chemin_avant.join() !== aa.chemin.join() ? [{ ids: aa.chemin_avant, color: MAP.before, dashed: true, width: 3.2 }] : []), ...(acc ? [{ ids: aa.chemin, color: MAP.path, animated: true }] : [])] : []}
              labels={aa ? [aa.site, ...(aa.caserne_apres ? [aa.caserne_apres] : []), ...(aa.caserne_avant && aa.caserne_avant !== aa.caserne_apres ? [aa.caserne_avant] : [])] : []}
              rings={aa && !acc ? [aa.site] : []} />
          ) : <Skeleton h={520} />}
        </Card>

        <div className="grid gap-5 content-start">
          <Card title="Demande d’intervention" right={<span className="mu text-[13.5px] num">{idx >= 0 ? idx + 1 : '—'} / {lignes.length}</span>}>
            <div className="flex items-center gap-2">
              <button className="btn btn-gh btn-sm" onClick={() => pas(-1)} title="Demande précédente"><ChevronLeft size={16} /></button>
              <select className="inp flex-1" value={d ?? ''} onChange={e => s.setParam('d', e.target.value)} aria-label="Demande">
                {lignes.map(l => <option key={l.demande} value={l.demande}>{l.demande} · {l.type} · P{l.priorite} · site {l.site}{l.statut === 'inaccessible' ? ' · inaccessible' : (l.retard ?? 0) > 1e-9 ? ` · +${fmt(l.retard)} min` : ''}</option>)}
              </select>
              <button className="btn btn-gh btn-sm" onClick={() => pas(1)} title="Demande suivante"><ChevronRight size={16} /></button>
            </div>
            {route.data && (
              <div className="flex items-center gap-2.5 mt-3 text-[14px] flex-wrap">
                <Prio p={route.data.demande.priorite} /><b>{route.data.demande.type}</b><span className="mu">sur le site</span><IdChip id={route.data.demande.origine} types={types} />
              </div>
            )}
          </Card>

          <Card fig="Avant / après" title="Coût du trajet et retard" glow={aa && !acc ? 'var(--ko-line)' : undefined}>
            {!aa ? <Skeleton h={170} /> : acc ? (
              <>
                <div className="ba">
                  <div><div className="lbl">Situation normale</div><div className="big mt-1">{fmt(aa.avant, 2)}<small>min</small></div><div className="mu text-[13px] mt-0.5">{aa.arcs_avant ?? '—'} arcs · <span className="mono">{aa.caserne_avant}</span></div></div>
                  <div className="mu2 text-center text-[20px]">→</div>
                  <div><div className="lbl">{scenLabel(s.scenario)}</div><div className="big mt-1" style={{ color: retardOk ? 'var(--warn)' : undefined }}>{fmt(aa.apres, 2)}<small>min</small></div><div className="mu text-[13px] mt-0.5">{aa.arcs} arcs · <span className="mono">{aa.caserne_apres}</span></div></div>
                </div>
                <div className="flex gap-2 my-3 flex-wrap">
                  <Pill kind={retardOk ? 'am' : 'ok'}>retard absolu +{fmt(aa.retard, 2)} min</Pill>
                  <Pill kind={retardOk ? 'am' : 'ok'}>retard relatif +{fmt(aa.retard_pct, 1)} %</Pill>
                  <Pill kind="ok">✓ accessible</Pill>
                </div>
                <div className="lbl mb-1.5">Chemin retenu ({aa.arcs} arcs)</div>
                <PathChips path={aa.chemin} types={types} max={12} />
                <div className="lbl mt-3.5 mb-1.5">Fermetures sur l’ancien chemin</div>
                <div className="flex flex-wrap gap-1.5">{aa.fermetures_sur_chemin_initial.length ? aa.fermetures_sur_chemin_initial.map(x => <span key={x} className="chip chip-ko">{x.replace('->', ' → ')}</span>) : <span className="mu text-[14px]">aucune</span>}</div>
                {!!aa.fermetures_proches.length && <><div className="lbl mt-3 mb-1.5">Fermetures à proximité du nouveau chemin</div><div className="flex flex-wrap gap-1.5">{aa.fermetures_proches.slice(0, 8).map(x => <span key={x} className="chip">{x.replace('->', ' → ')}</span>)}</div></>}
              </>
            ) : (
              <div className="banner ko"><X size={18} /><div><b>Inaccessible</b><br /><span className="text-[14px]">Le site <span className="mono">{aa.site}</span> n’est atteignable depuis aucune caserne : distance <b>+∞</b>{aa.statut_avant === 'accessible' ? ` (accessible avant la perturbation : ${fmt(aa.avant)} min)` : ', dans ce scénario comme dans la base'}.</span></div></div>
            )}
          </Card>

          <Card fig="Tableau 3" title="Comparaison des trois algorithmes" right={route.data && (route.data.identiques ? <Pill kind="ok">✓ distances identiques</Pill> : <Pill kind="ko">✗ distances différentes</Pill>)}>
            {route.loading && !route.data && <Skeleton h={130} />}
            {route.error && <ErrorBox error={route.error} />}
            {route.data && (
              <table className="tbl compact">
                <thead><tr><th>Algorithme</th><th className="r">Distance</th><th className="r">Arcs</th><th className="r">Temps</th></tr></thead>
                <tbody>{route.data.algos.map(a => (
                  <tr key={a.algo}>
                    <td style={{ whiteSpace: 'normal' }}><b>{ALGO_LABEL[a.algo]}</b><div className="caption">{a.ignore ? a.raison : <><span className="math">{ALGO_CPLX[a.algo]}</span> · {SOUS[a.algo]}{a.passes ? ` · ${a.passes} passes` : ''}</>}</div></td>
                    <td className="r font-semibold">{a.ignore ? '—' : `${fmt(a.dist, 2)} min`}</td>
                    <td className="r">{a.arcs ?? '—'}</td>
                    <td className="r mono text-[13px]">{fmtMs(a.temps_ms)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <details className="callout warn">
        <summary className="cursor-pointer"><span className="callout-t inline-flex" style={{ marginBottom: 0 }}>Limites du modèle</span> <span className="ml-2">temps statiques · une intervention à la fois · données synthétiques</span></summary>
        <ul className="list-disc ml-5 mt-2 space-y-0.5">
          <li>deux temps par arc (normal / pointe), pas de trafic réel ; travaux = × 1,5 (hypothèse)</li>
          <li>caserne supposée disponible, incidents simultanés ignorés</li>
          <li>un chemin de coût minimal ne garantit pas une intervention réaliste</li>
        </ul>
      </details>

      <Card fig="Tableau 4" title={<>Toutes les demandes · scénario « {scenLabel(s.scenario)} »</>}
        sub={rts.data && <><b className="text-ink2">{rts.data.resume.accessibles}/{rts.data.resume.demandes}</b> accessibles · retard moyen <b className="text-ink2">+{fmt(rts.data.resume.retard_moyen, 2)} min</b> · max <b className="text-ink2">+{fmt(rts.data.resume.retard_max, 2)} min</b></>}
        right={<>
          <div className="flex items-center gap-2 inp" style={{ padding: '5px 9px' }}><Search size={14} className="mu" /><input className="bg-transparent outline-none w-[150px]" placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}><X size={13} /></button>}</div>
          <Seg value={filtre} onChange={setFiltre} size="sm" options={[{ v: 'tous', l: 'Toutes' }, { v: 'retard', l: 'Retardées' }, { v: 'inacc', l: 'Inaccessibles' }, { v: 'P1', l: 'P1' }]} />
          <button className="btn btn-gh btn-sm" onClick={exporter}><Download size={13} />Exporter CSV</button>
        </>}>
        <div className="tbl-wrap" style={{ maxHeight: 480 }}>
          <table className="tbl">
            <thead><tr>{th('demande', 'Demande')}{th('priorite', 'Type')}{th('site', 'Site')}{th('caserne_apres', 'Caserne')}{th('avant', 'Avant (min)', true)}{th('apres', 'Après (min)', true)}{th('retard', 'Retard (min)', true)}{th('retard_pct', 'Relatif', true)}{th('statut', 'Statut')}<th>Chemin retenu</th></tr></thead>
            <tbody>{triees.map(x => {
              const retard = (x.retard ?? 0) > 1e-9
              return (
                <tr key={x.demande} className={`cursor-pointer ${x.demande === d ? 'sel' : ''}`} onClick={() => s.setParam('d', x.demande)}>
                  <td className="mono font-semibold">{x.demande}</td>
                  <td><span className="inline-flex items-center gap-2"><Prio p={x.priorite} />{x.type}</span></td>
                  <td className="mono">{x.site}</td>
                  <td className="mono">{x.caserne_apres ?? '—'}</td>
                  <td className="r">{fmt(x.avant, 2)}</td>
                  <td className="r font-semibold">{fmt(x.apres, 2)}</td>
                  <td className="r" style={{ color: retard ? 'var(--warn)' : 'var(--faint)', fontWeight: retard ? 600 : 400 }}>{x.retard !== null ? `+${fmt(x.retard, 2)}` : '—'}</td>
                  <td className="r" style={{ color: retard ? 'var(--warn)' : 'var(--faint)' }}>{x.retard_pct !== null ? `+${fmt(x.retard_pct, 1)} %` : '—'}</td>
                  <td>{x.statut === 'accessible' ? <Pill kind="ok">accessible</Pill> : <Pill kind="ko">inaccessible</Pill>}</td>
                  <td style={{ maxWidth: 380, overflow: 'hidden' }}>{isFinite_(x.apres) ? <PathChips path={x.chemin} max={6} types={types} /> : <span className="mu">aucun chemin</span>}</td>
                </tr>
              )
            })}</tbody>
          </table>
          {rts.data && !triees.length && <div className="mu p-4 text-center">Aucune demande ne correspond au filtre.</div>}
        </div>
      </Card>
    </div>
  )
}
