// Page 1 — Vue d'ensemble : le problème métier (3 questions du sujet), leurs réponses chiffrées, la carte, les alertes.
import { AlertTriangle, ArrowRight, Clock, Network, Route as RouteIcon, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import NetworkCanvas, { LegendLine, pairKey, TypeLegend, TypeMark } from '../components/NetworkCanvas'
import { Bar, Card, ErrorBox, Pill, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { fmt, fmtInt } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import { MAP, scenColor, scenLabel, TYPE_LABEL } from '../theme/tokens'

function Question({ n, q, children, to, cta }: { n: number; q: ReactNode; children: ReactNode; to: () => void; cta: string }) {
  return (
    <div className="card flex flex-col" style={{ padding: '18px 20px' }}>
      <div className="flex gap-3 items-start">
        <span className="grid place-items-center shrink-0 serif font-semibold text-[18px]" style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--navy)', color: '#fff' }}>{n}</span>
        <div className="serif text-[18px] leading-snug font-semibold text-ink">{q}</div>
      </div>
      <div className="flex-1 mt-3.5">{children}</div>
      <button className="btn btn-gh btn-sm self-start mt-3" onClick={to}>{cta}<ArrowRight size={14} /></button>
    </div>
  )
}

function Fig({ v, l, tone }: { v: ReactNode; l: ReactNode; tone?: 'ko' | 'ok' | 'warn' }) {
  return (
    <div className="min-w-0">
      <div className="big" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</div>
      <div className="text-[13.5px] mu leading-snug mt-0.5">{l}</div>
    </div>
  )
}

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
  const go = (path: string) => nav({ pathname: path, search: loc.search })
  const parType = (t: string) => g.data?.sites.filter(x => x.type === t).length ?? 0
  const res = rts.data?.resume
  const fibreDiff = (g.data?.diff ?? []).filter(d => d.cible === 'fibre')
  const routeDiff = (g.data?.diff ?? []).filter(d => d.cible === 'route')
  const goSite = (id: string) => s.setParam('site', id)
  const inacc = (rts.data?.lignes ?? []).filter(l => l.statut === 'inaccessible')
  const scens = scen.data?.scenarios ?? []
  const maxHausse = Math.max(0.1, ...scens.map(x => x.hausse_moyenne))
  const pireFibre = [...scens].sort((a, b) => b.cout_reparation - a.cout_reparation)[0]
  const meta = g.data?.meta ?? {}
  const nbAlertes = (acc.data?.isoles.length ?? 0) + (acc.data?.hors_delai.length ? 1 : 0) + (inacc.length ? 1 : 0) + (routeDiff.length ? 1 : 0) + (fibreDiff.length ? 1 : 0)

  return (
    <div className="grid gap-5">
      {/* ---------- page de titre ---------- */}
      <section className="card" style={{ padding: '26px 30px', background: 'linear-gradient(180deg, #FFFFFF 0%, #FBFAF7 100%)' }}>
        <div className="grid gap-6 items-end" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
          <div className="min-w-0">
            <div className="eyebrow">Projet intégrateur · Algorithmique et théorie des graphes · ING-APP1-BDML</div>
            <h2 className="serif text-[40px] leading-[1.1] font-semibold mt-2" style={{ color: 'var(--navy)' }}>Novapolis Résilience</h2>
            <div className="serif italic text-[20px] text-ink2 mt-1">Planification des secours et conception d’un réseau urbain résilient</div>
          </div>
          <div className="hidden xl:flex flex-col gap-2 text-[14px] min-w-[300px]">
            <div className="flex items-center gap-2"><span className="lbl">Jeu</span><span className="mono font-semibold">{s.dataset}</span>{g.data?.synthetique && <span className="badge-syn">synthétique</span>}{meta.graine !== undefined && meta.graine !== null && <span className="mu">· graine <span className="mono text-ink">{meta.graine}</span></span>}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
              {['caserne', 'hopital', 'ecole', 'telecom', 'quartier'].map(t => <span key={t} className="flex items-center gap-1.5"><TypeMark type={t} size={t === 'quartier' ? 11 : 17} /><b className="num">{parType(t)}</b><span className="mu">{TYPE_LABEL[t].toLowerCase()}{parType(t) > 1 ? 's' : ''}</span></span>)}
            </div>
            <div className="mu num">{fmtInt(g.data?.routes.length)} arcs routiers · {fmtInt(g.data?.fibre.length)} tronçons de fibre · {fmtInt(g.data?.demandes.length)} demandes</div>
          </div>
        </div>
      </section>

      {/* ---------- les trois questions du sujet ---------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Question n={1} q="Quels quartiers ne sont pas suffisamment accessibles depuis une caserne ou un hôpital ?" to={() => go('/accessibilite')} cta="Module 1 · accessibilité">
          {!acc.data ? <Skeleton h={70} /> : (
            <div className="grid grid-cols-2 gap-4">
              <Fig v={<>{acc.data.atteignables}<small>/ {acc.data.total}</small></>} l="sites atteignables" />
              <Fig v={acc.data.hors_delai.length} l={<>quartiers à plus de {acc.data.seuil} min</>} tone={acc.data.hors_delai.length ? 'warn' : 'ok'} />
            </div>
          )}
        </Question>
        <Question n={2} q="Quels itinéraires recommander lorsque des routes sont congestionnées ou fermées ?" to={() => go('/itineraires')} cta="Module 2 · itinéraires">
          {!res ? <Skeleton h={70} /> : (
            <div className="grid grid-cols-2 gap-4">
              <Fig v={<>{res.accessibles}<small>/ {res.demandes}</small></>} l="demandes accessibles" tone={res.inaccessibles ? 'warn' : undefined} />
              <Fig v={<>{fmt(res.temps_moyen ?? null)}<small>min</small></>} l={s.scenario === 'normal' ? 'temps moyen d’intervention' : <>temps moyen · retard max +{fmt(res.retard_max)} min</>} />
            </div>
          )}
        </Question>
        <Question n={3} q="Comment déployer la fibre avec un budget limité tout en gardant une solution de secours en cas de panne ?" to={() => go('/fibre')} cta="Module 4 · fibre">
          {!mst.data?.kruskal ? <Skeleton h={70} /> : (
            <div className="grid grid-cols-2 gap-4">
              <Fig v={<>{fmtInt(mst.data.kruskal.cout)}<small>k€</small></>} l={<>arbre minimal · {mst.data.kruskal.nb_aretes} tronçons</>} />
              <Fig v={pireFibre && pireFibre.cout_reparation > 0 ? <>+{fmtInt(pireFibre.cout_reparation)}<small>k€</small></> : mst.data.kruskal.composantes} l={pireFibre && pireFibre.cout_reparation > 0 ? 'pour réparer une panne' : 'composante(s)'} />
            </div>
          )}
        </Question>
      </div>

      {/* ---------- carte + alertes ---------- */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card fig="Figure 1" title={<>Carte du réseau de Novapolis <Pill kind={s.scenario === 'normal' ? 'mu' : 'in'}><i className="dot" style={{ background: scenColor(Math.max(0, (g.data?.scenarios ?? []).indexOf(s.scenario))) }} />{scenLabel(s.scenario)}</Pill></>}
          right={<button className={`btn btn-sm ${fibre ? 'btn-on' : 'btn-gh'}`} onClick={() => setFibre(f => !f)}><Network size={14} />{fibre ? 'Masquer la fibre' : 'Afficher la fibre (ACM)'}</button>}>
          <div className="mb-3"><TypeLegend /></div>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre={fibre} mst={mstSet} rings={rings} labels={labels} focus={focus} height="clamp(440px, calc(100vh - 330px), 640px)"
              onSiteClick={id => goSite(id)}
              legend={<><LegendLine color="#AEB5C1" label="Route à double sens" /><LegendLine color="#707E98" label="Sens unique" /><LegendLine color={MAP.closed} label="Route fermée" dashed /><LegendLine color={MAP.works} label="Travaux (× 1,5)" dashed />{fibre && <LegendLine color={MAP.mst} label="Fibre retenue (ACM)" />}</>} />
          ) : <Skeleton h={540} />}
        </Card>

        <div className="grid gap-5 content-start">
          <Card title={<><AlertTriangle size={18} color="var(--ko)" /> Points d’attention</>} right={<Pill kind={nbAlertes ? 'ko' : 'ok'}>{nbAlertes}</Pill>}>
            {acc.loading && !acc.data && <Skeleton h={120} />}
            {(acc.data?.isoles ?? []).map(id => (
              <div key={id} className="alert" onClick={() => goSite(id)}>
                <div className="ai" style={{ background: 'var(--ko-bg)', color: 'var(--ko)', borderColor: 'var(--ko-line)' }}><X size={15} /></div>
                <div><b className="text-[14.5px] block">Site <span className="mono">{id}</span> isolé</b><span className="text-[13.5px] mu">aucun arc entrant ni sortant : inatteignable</span></div>
              </div>
            ))}
            {!!acc.data?.hors_delai.length && (
              <div className="alert" onClick={() => goSite(acc.data!.hors_delai.find(h => h.temps !== '+inf')?.id ?? acc.data!.hors_delai[0].id)}>
                <div className="ai" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn-line)' }}><Clock size={15} /></div>
                <div><b className="text-[14.5px] block">{acc.data.hors_delai.length} quartier(s) au-delà de {acc.data.seuil} min</b><span className="text-[13.5px] mu">{acc.data.hors_delai.slice(0, 5).map(h => h.id).join(', ')}{acc.data.hors_delai.length > 5 ? '…' : ''}</span></div>
              </div>
            )}
            {!!inacc.length && (
              <div className="alert" onClick={() => go('/itineraires')}>
                <div className="ai" style={{ background: 'var(--ko-bg)', color: 'var(--ko)', borderColor: 'var(--ko-line)' }}><RouteIcon size={15} /></div>
                <div><b className="text-[14.5px] block">{inacc.length} demande(s) inaccessible(s)</b><span className="text-[13.5px] mu">{inacc.slice(0, 4).map(l => `${l.demande} (${l.site})`).join(', ')}</span></div>
              </div>
            )}
            {!!routeDiff.length && (
              <div className="alert" onClick={() => goSite(routeDiff[0].u)}>
                <div className="ai" style={{ background: 'var(--ko-bg)', color: 'var(--ko)', borderColor: 'var(--ko-line)' }}><RouteIcon size={15} /></div>
                <div><b className="text-[14.5px] block">{routeDiff.length} arc(s) modifié(s) par « {scenLabel(s.scenario)} »</b><span className="text-[13.5px] mu">retard maximal +{fmt(rts.data?.resume.retard_max ?? 0)} min</span></div>
              </div>
            )}
            {!!fibreDiff.length && (
              <div className="alert" onClick={() => goSite(fibreDiff[0].u)}>
                <div className="ai" style={{ background: 'var(--navy-soft)', color: 'var(--navy)', borderColor: 'var(--navy-line)' }}><Network size={15} /></div>
                <div><b className="text-[14.5px] block">Panne fibre {fibreDiff.map(d => `${d.u}–${d.v}`).join(', ')}</b><span className="text-[13.5px] mu">voir l’étude de panne (module 4)</span></div>
              </div>
            )}
            {acc.data && !nbAlertes && <div className="banner ok text-[14px]">Aucun point d’attention dans ce scénario.</div>}
          </Card>

          <Card title="Retard moyen par scénario">
            {scen.loading && !scen.data && <Skeleton h={120} />}
            {scens.map((x, k) => (
              <div key={x.scenario} className="grid items-center gap-3 my-2.5" style={{ gridTemplateColumns: '130px 1fr 78px' }}>
                <span className="flex items-center gap-2 text-[14px] truncate"><i className="dot" style={{ background: scenColor(k) }} />{scenLabel(x.scenario)}</span>
                <Bar value={x.hausse_moyenne} max={maxHausse} color={scenColor(k)} />
                <span className="num text-right text-[14px] font-medium">+{fmt(x.hausse_moyenne, 2)} min</span>
              </div>
            ))}
            <button className="btn btn-gh w-full justify-center mt-2" onClick={() => go('/scenarios')}>Voir les scénarios <ArrowRight size={14} /></button>
          </Card>
        </div>
      </div>
    </div>
  )
}
