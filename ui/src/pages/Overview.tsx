// Page 1 — Vue d'ensemble : KPI, carte, alertes, mini-comparaison des scénarios.
import { AlertTriangle, CheckCircle2, Clock, Network, Route as RouteIcon, Share2, Unplug, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import NetworkCanvas, { LegendLine, pairKey, TypeLegend } from '../components/NetworkCanvas'
import { Bar, Card, ErrorBox, KpiCard, Pill, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { fmt, fmtInt } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import { SCEN_COLOR, scenLabel, TYPE_COLOR } from '../theme/tokens'

export default function Overview() {
  const s = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const g = useGraph()
  const ctx = { dataset: s.dataset, scenario: s.scenario, periode: s.periode }
  const acc = useApi(() => api.access({ ...ctx, seuil: 10 }), [s.dataset, s.scenario, s.periode])
  const rts = useApi(() => api.routes(ctx), [s.dataset, s.scenario, s.periode])
  const mst = useApi(() => api.mst(s.dataset, s.scenario, 'kruskal'), [s.dataset, s.scenario])
  const scen = useApi(() => api.scenarios(s.dataset, null, s.periode), [s.dataset, s.periode])
  const [fibre, setFibre] = useState(false)
  const focus = s.param('site')
  useLastCalc('Dijkstra multi-source', rts.data?.temps_ms, [rts.data])

  const mstSet = useMemo(() => new Set((mst.data?.kruskal?.aretes ?? []).map(e => pairKey(e.u, e.v))), [mst.data])
  const many = (g.data?.sites.length ?? 0) > 400
  const labels = useMemo(() => (g.data && !many ? g.data.sites.filter(x => x.type === 'caserne' || x.type === 'hopital').map(x => x.id) : []), [g.data, many])
  const rings = useMemo(() => new Set([...(acc.data?.isoles ?? []), ...(acc.data?.non_atteignables_secours ?? [])]), [acc.data])

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const parType = (t: string) => g.data?.sites.filter(x => x.type === t).length ?? 0
  const res = rts.data?.resume
  const fibreDiff = (g.data?.diff ?? []).filter(d => d.cible === 'fibre')
  const routeDiff = (g.data?.diff ?? []).filter(d => d.cible === 'route')
  const go = (id: string) => s.setParam('site', id)
  const inacc = (rts.data?.lignes ?? []).filter(l => l.statut === 'inaccessible')
  const maxHausse = Math.max(0.1, ...(scen.data?.scenarios ?? []).map(x => x.hausse_moyenne))

  return (
    <div>
      <div className="grid grid-cols-4 gap-3.5 mb-3.5">
        <KpiCard label="Sites" color="#7C8CFF" icon={<Share2 size={14} />} value={fmtInt(g.data?.sites.length)}
          sub={<span>{['hopital', 'caserne', 'ecole', 'telecom', 'quartier'].map(t => <span key={t} className="mr-2"><span style={{ color: TYPE_COLOR[t] }}>●</span> {parType(t)}</span>)}</span>} />
        <KpiCard label="Demandes accessibles" color="#3DDC97" icon={<CheckCircle2 size={14} />}
          value={res ? <>{res.accessibles}<small className="text-[13px] mu ml-1">/ {res.demandes}</small></> : '—'}
          sub={res ? <><span style={{ color: '#3DDC97' }}>{fmt(res.demandes ? (res.accessibles / res.demandes) * 100 : 0, 0)} %</span> · {acc.data?.isoles.length ?? 0} site(s) isolé(s)</> : ''} />
        <KpiCard label="Temps moyen d'intervention" color="#FFB547" icon={<Clock size={14} />} value={fmt(res?.temps_moyen ?? null)} unit="min" sub={`période ${s.effectivePeriode} · Dijkstra multi-source`} />
        <KpiCard label="Coût ACM fibre" color="#2EE6D6" icon={<Zap size={14} />} value={fmtInt(mst.data?.kruskal?.cout)} unit="k€" sub={`${mst.data?.kruskal?.nb_aretes ?? '—'} tronçons · Kruskal`} />
        <KpiCard label="Arcs routiers" color="#8592AE" icon={<RouteIcon size={14} />} value={fmtInt(g.data?.routes.length)} sub={`${g.data?.routes.filter(r => r.statut === 'ferme').length ?? 0} fermés · ${g.data?.routes.filter(r => r.statut === 'travaux').length ?? 0} en travaux`} />
        <KpiCard label="Tronçons de fibre" color="#2EE6D6" icon={<Network size={14} />} value={fmtInt(g.data?.fibre.length)} sub={`${g.data?.fibre.filter(f => f.statut !== 'disponible').length ?? 0} interdits ou en panne`} />
        <KpiCard label="Composantes fibre" color="#A78BFA" icon={<Unplug size={14} />} value={fmtInt(mst.data?.kruskal?.composantes)} sub={`${mst.data?.non_raccordes.length ?? 0} composante(s) non raccordée(s)`} />
        <KpiCard label="Sites non atteignables" color="#FF5468" icon={<AlertTriangle size={14} />} value={fmtInt(acc.data?.non_atteignables_secours.length)} sub="depuis toute caserne ou hôpital" />
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 340px' }}>
        <Card title={<>Carte du réseau <Pill>{scenLabel(s.scenario)}</Pill>{g.data?.synthetique && <span className="badge-syn">synthétique</span>}</>}
          right={<><TypeLegend /><button className={`btn btn-sm ${fibre ? 'btn-pri' : 'btn-gh'}`} onClick={() => setFibre(f => !f)}>Fibre</button></>}>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre={fibre} mst={mstSet} rings={rings} labels={labels} focus={focus} height={520}
              onSiteClick={id => go(id)}
              legend={<><LegendLine color="#2a3a62" label="Route (plus clair = sens unique)" /><LegendLine color="#FF4D4D" label="Route fermée" dashed /><LegendLine color="#FFB547" label="Travaux" dashed /><LegendLine color="#2EE6D6" label="Fibre (ACM)" /></>} />
          ) : <Skeleton h={520} />}
        </Card>

        <div className="grid gap-3.5 content-start">
          <Card title={<><AlertTriangle size={15} color="#FF5468" /> Alertes</>} right={<Pill kind="ko">{(acc.data?.isoles.length ?? 0) + (acc.data?.hors_delai.length ? 1 : 0) + (inacc.length ? 1 : 0) + (routeDiff.length ? 1 : 0) + (fibreDiff.length ? 1 : 0)}</Pill>}>
            {acc.loading && !acc.data && <Skeleton h={120} />}
            {(acc.data?.isoles ?? []).map(id => (
              <div key={id} className="alert" onClick={() => go(id)}>
                <div className="ai" style={{ background: '#331219', color: '#FF5468' }}><X size={13} /></div>
                <div><b className="text-[12px] block">{id} isolé</b><span className="text-[11.5px] mu">Aucun arc entrant ni sortant</span></div>
              </div>
            ))}
            {!!acc.data?.hors_delai.length && (
              <div className="alert" onClick={() => go(acc.data!.hors_delai.find(h => h.temps !== '+inf')?.id ?? acc.data!.hors_delai[0].id)}>
                <div className="ai" style={{ background: '#33260e', color: '#FFB547' }}><Clock size={13} /></div>
                <div><b className="text-[12px] block">{acc.data.hors_delai.length} quartier(s) au-delà de {acc.data.seuil} min</b><span className="text-[11.5px] mu">{acc.data.hors_delai.slice(0, 5).map(h => h.id).join(', ')}{acc.data.hors_delai.length > 5 ? '…' : ''}</span></div>
              </div>
            )}
            {!!inacc.length && (
              <div className="alert" onClick={() => nav({ pathname: '/itineraires', search: loc.search })}>
                <div className="ai" style={{ background: '#331219', color: '#FF5468' }}><RouteIcon size={13} /></div>
                <div><b className="text-[12px] block">{inacc.length} demande(s) inaccessible(s)</b><span className="text-[11.5px] mu">{inacc.slice(0, 4).map(l => `${l.demande} (${l.site})`).join(', ')}</span></div>
              </div>
            )}
            {!!routeDiff.length && (
              <div className="alert" onClick={() => go(routeDiff[0].u)}>
                <div className="ai" style={{ background: '#331219', color: '#FF5468' }}><RouteIcon size={13} /></div>
                <div><b className="text-[12px] block">{routeDiff.length} arc(s) modifié(s) par « {scenLabel(s.scenario)} »</b><span className="text-[11.5px] mu">retard max +{fmt(rts.data?.resume.retard_max ?? 0)} min</span></div>
              </div>
            )}
            {!!fibreDiff.length && (
              <div className="alert" onClick={() => go(fibreDiff[0].u)}>
                <div className="ai" style={{ background: '#0c2c2f', color: '#2EE6D6' }}><Network size={13} /></div>
                <div><b className="text-[12px] block">Panne {fibreDiff.map(d => `${d.u}–${d.v}`).join(', ')}</b><span className="text-[11.5px] mu">voir l'étude de panne (M4)</span></div>
              </div>
            )}
            {acc.data && !acc.data.isoles.length && !acc.data.hors_delai.length && !inacc.length && !routeDiff.length && !fibreDiff.length && <div className="mu text-[12px]">Aucune alerte.</div>}
          </Card>

          <Card title="Scénarios · hausse moyenne du temps">
            {scen.loading && !scen.data && <Skeleton h={100} />}
            {(scen.data?.scenarios ?? []).map((x, k) => (
              <div key={x.scenario} className="grid items-center gap-2 my-2" style={{ gridTemplateColumns: '104px 1fr 70px' }}>
                <span className="mu truncate">{scenLabel(x.scenario)}</span>
                <Bar value={x.hausse_moyenne} max={maxHausse} color={SCEN_COLOR[k % SCEN_COLOR.length]} />
                <span className="mono text-right">+{fmt(x.hausse_moyenne)} min</span>
              </div>
            ))}
            <button className="btn btn-gh w-full justify-center mt-1.5" onClick={() => nav({ pathname: '/scenarios', search: loc.search })}>Comparer les scénarios →</button>
          </Card>

          <Card title="Connexité">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="big">{acc.data?.atteignables ?? '—'}</div><div className="mu text-[11px]">atteignables</div></div>
              <div><div className="big">{acc.data?.nb_scc ?? '—'}</div><div className="mu text-[11px]">CFC</div></div>
              <div><div className="big">{acc.data?.nb_fibre ?? '—'}</div><div className="mu text-[11px]">comp. fibre</div></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
