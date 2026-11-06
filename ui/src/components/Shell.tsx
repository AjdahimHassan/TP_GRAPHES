// Coque de l'application : sommaire latéral, en-tête (titre + contexte global), pied de page, palette Ctrl+K,
// mode présentation (visite guidée plein écran, ← / →).
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Command, MonitorPlay, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { fmtMs, shortHash } from '../lib/format'
import { useStore } from '../lib/store'
import { PAGES, pageByPath } from '../pages'
import { scenColor, scenLabel, TYPE_COLOR } from '../theme/tokens'

function Logo({ size = 38 }: { size?: number }) {
  return (
    <div className="grid place-items-center shrink-0" style={{ width: size, height: size, borderRadius: 10, background: 'var(--navy)', boxShadow: '0 1px 2px rgba(19,26,34,.2)' }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M7 6.3l10 .6M6 8l5 8.3M18 9l-5 7.3" opacity=".85" />
        <circle cx="5" cy="6" r="2.2" fill="#fff" /><circle cx="19" cy="7" r="2.2" fill="#fff" /><circle cx="12" cy="18" r="2.2" fill="#fff" />
      </svg>
    </div>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { apiOk } = useStore()
  const loc = useLocation()
  let groupe = ''
  return (
    <aside className="flex flex-col min-h-0 overflow-hidden no-print" style={{ background: 'var(--surface)', borderRight: '1px solid var(--rule)', padding: '18px 12px 12px', width: collapsed ? 70 : 262, transition: 'width .2s' }}>
      <div className="flex gap-3 items-center px-2 pb-4 mb-1" style={{ borderBottom: '1px solid var(--rule)' }}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0">
            <div className="serif text-[18px] font-semibold leading-tight text-ink">Novapolis <span className="font-normal italic">Résilience</span></div>
            <div className="text-[12px] mu leading-snug mt-0.5">Théorie des graphes · ING1 BDML</div>
          </div>
        )}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-1" aria-label="Sommaire">
        {PAGES.map(p => {
          const entete = p.g !== groupe ? ((groupe = p.g), true) : false
          const Icon = p.icon
          return (
            <div key={p.id}>
              {entete && !collapsed && <div className="text-[11.5px] tracking-[.1em] uppercase font-semibold px-2.5 pt-4 pb-1.5" style={{ color: 'var(--faint)' }}>{p.g}</div>}
              {entete && collapsed && <div className="mx-2 my-2" style={{ borderTop: '1px solid var(--rule)' }} />}
              <NavLink to={{ pathname: p.path, search: loc.search }} end className={({ isActive }) => `navlink ${isActive ? 'on' : ''}`} title={`${p.n}. ${p.t}`}>
                {collapsed ? <Icon size={18} className="mx-auto" /> : <><span className="n">{p.n}</span><Icon size={17} className="shrink-0 opacity-80" /><span className="truncate">{p.t}</span>{p.tag && <span className="tag">{p.tag}</span>}</>}
              </NavLink>
            </div>
          )
        })}
      </nav>
      <div className="pt-3 px-2 text-[13px] mu" style={{ borderTop: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2" title="État de l'API Python (tous les calculs y sont faits)">
          <span className="dot" style={{ background: apiOk ? '#0ca30c' : apiOk === false ? '#d03b3b' : '#fab219' }} />
          {!collapsed && (apiOk ? <span>API connectée · <span className="mono">:8000</span></span> : apiOk === false ? <span style={{ color: 'var(--ko)' }}>API hors ligne</span> : 'connexion…')}
        </div>
        <button className="mt-2 flex items-center gap-1 text-[12.5px] hover:text-ink" onClick={onToggle}>{collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /> réduire le sommaire</>}</button>
      </div>
    </aside>
  )
}

function CtxBox({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-[9px] pl-3 pr-1 py-1 text-[13.5px]" style={{ background: 'var(--surface)', border: '1px solid var(--rule-2)' }} title={title}>
      <span className="mu font-medium whitespace-nowrap">{label}</span>
      {children}
    </label>
  )
}

const selectStyle: React.CSSProperties = { border: 0, background: 'transparent', padding: '4px 26px 4px 4px', fontWeight: 600, fontSize: 14, boxShadow: 'none', backgroundPosition: 'right 6px center' }

export function TopBar({ onPalette, onPresent }: { onPalette: () => void; onPresent: () => void }) {
  const s = useStore()
  const loc = useLocation()
  const page = pageByPath(loc.pathname)
  const info = s.datasets.find(d => d.id === s.dataset)
  const scenarios = info?.scenarios ?? ['normal']
  const groupes: Record<string, string> = { mini: 'Vérifiable à la main', test: 'Tests M3 (poids négatifs)', realiste: 'Réaliste (≥ 100 sites)', generes: 'Générés (benchmarks)', benchmark: 'Générés (benchmarks)' }
  const parGroupe = useMemo(() => {
    const m = new Map<string, typeof s.datasets>()
    s.datasets.forEach(d => { const g = groupes[d.groupe ?? ''] ?? 'Autres'; m.set(g, [...(m.get(g) ?? []), d]) })
    return [...m.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.datasets])
  const per = s.periode ?? s.effectivePeriode
  const iScen = Math.max(0, scenarios.indexOf(s.scenario))
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-6 py-3 min-w-0" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--rule)' }}>
      <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
        <div className="eyebrow truncate">{page.eyebrow}<span className="mu2 font-medium normal-case tracking-normal"> · sujet {page.ref}</span></div>
        <h1 className="serif text-[23px] 2xl:text-[25px] leading-tight font-semibold truncate mt-0.5" title={page.st}>{page.t}</h1>
      </div>
      <div className="ctx flex flex-wrap items-center gap-2">
        <CtxBox label="Jeu">
          <select className="inp mono" style={{ ...selectStyle, maxWidth: 180 }} value={s.dataset} onChange={e => s.setDataset(e.target.value)} aria-label="Jeu de données">
            {!info && <option value={s.dataset}>{s.dataset}</option>}
            {parGroupe.map(([g, ds]) => <optgroup key={g} label={g}>{ds.map(d => <option key={d.id} value={d.id}>{d.id}</option>)}</optgroup>)}
          </select>
          {info?.synthetique && <span className="badge-syn mr-1 hidden 2xl:inline" title="Données générées : aucune donnée réelle">synthétique</span>}
        </CtxBox>
        <CtxBox label="Scénario">
          <i className="dot" style={{ background: scenColor(iScen) }} />
          <select className="inp" style={{ ...selectStyle, maxWidth: 175 }} value={s.scenario} onChange={e => s.setScenario(e.target.value)} aria-label="Scénario">
            {scenarios.map(sc => <option key={sc} value={sc}>{scenLabel(sc)}</option>)}
          </select>
        </CtxBox>
        <div className="flex items-center gap-1.5" title={s.periode ? 'Période imposée (avant ET après)' : 'Période propre au scénario'}>
          <span className="mu text-[13.5px] font-medium hidden 2xl:inline">Période</span>
          <div className="seg sm">
            {['normal', 'pointe'].map(p => (
              <button key={p} className={per === p ? 'on' : ''} onClick={() => s.setPeriode(p)}>{p === 'normal' ? 'Normale' : 'Pointe'}</button>
            ))}
            {s.periode && <button onClick={() => s.setPeriode(null)} title="Revenir à la période du scénario"><RotateCcw size={13} /></button>}
          </div>
        </div>
        <button className="btn btn-gh" onClick={onPresent} title="Visite guidée de 10 minutes en plein écran (← / →, Échap pour quitter)"><MonitorPlay size={16} />Présenter</button>
        <button className="btn btn-pri" onClick={() => { s.run(); s.toast('info', 'Recalcul demandé à l’API Python') }} title="Relancer tous les calculs de la page" aria-label="Recalculer"><RefreshCw size={15} /><span className="hidden 2xl:inline">Recalculer</span></button>
        <button className="kbd flex items-center gap-1 py-1" onClick={onPalette} title="Palette de commandes (Ctrl+K)"><Command size={11} />K</button>
      </div>
    </header>
  )
}

export function Footer() {
  const s = useStore()
  const info = s.datasets.find(d => d.id === s.dataset)
  const ok = s.hash ? s.hash.ok : true
  return (
    <footer className="flex items-center gap-5 px-6 text-[13px] mu overflow-hidden whitespace-nowrap no-print" style={{ background: 'var(--surface)', borderTop: '1px solid var(--rule)', height: 34 }}>
      <span>Dernier calcul : <b className="text-ink">{s.lastCalc?.label ?? '—'}</b> · <span className="mono">{fmtMs(s.lastCalc?.ms ?? null)}</span></span>
      <span>Empreinte de la base <span className="mono text-ink2">sha256 {shortHash(s.hash?.avant ?? info?.hash)}</span></span>
      <span className="flex items-center gap-1.5" style={{ color: ok ? 'var(--ok)' : 'var(--ko)' }}><i className="dot" style={{ background: ok ? '#0ca30c' : '#d03b3b' }} />{ok ? 'Base de référence inchangée' : 'Base modifiée !'}</span>
      <span className="flex-1" />
      {info?.fichiers && <span className="mono text-[12.5px] truncate">{info.fichiers['sites.csv']} sites · {info.fichiers['routes.csv']} arcs · {info.fichiers['fibre.csv']} tronçons · {info.fichiers['demandes.csv']} demandes</span>}
    </footer>
  )
}

interface Item { label: string; sub: string; go: () => void; color?: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState('')
  const [sites, setSites] = useState<{ id: string; nom: string; type: string }[]>([])
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!open) return
    setQ('')
    api.table(s.dataset, 'sites.csv', 0, 6000).then(t => setSites(t.lignes.map(l => ({ id: l.valeurs[0], nom: l.valeurs[1], type: l.valeurs[2] })))).catch(() => setSites([]))
  }, [open, s.dataset])
  const params = (extra: Record<string, string>) => {
    const p = new URLSearchParams(loc.search)
    Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    return '?' + p.toString()
  }
  const items: Item[] = useMemo(() => {
    const info = s.datasets.find(d => d.id === s.dataset)
    const all: Item[] = [
      ...PAGES.map(p => ({ label: `${p.n}. ${p.t}`, sub: `page · ${p.st}`, color: '#1F4E79', go: () => nav({ pathname: p.path, search: loc.search }) })),
      ...(info?.demandes ?? []).map(d => ({ label: d, sub: 'demande d’intervention → itinéraire', go: () => nav({ pathname: '/itineraires', search: params({ d }) }) })),
      ...sites.map(x => ({ label: x.id, sub: `site · ${x.nom}`, color: TYPE_COLOR[x.type], go: () => nav({ pathname: '/', search: params({ site: x.id }) }) })),
    ]
    const f = q.trim().toLowerCase()
    return (f ? all.filter(i => (i.label + ' ' + i.sub).toLowerCase().includes(f)) : all).slice(0, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sites, s.datasets, s.dataset, loc.search])
  useEffect(() => setIdx(0), [q])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center pt-[12vh]" style={{ background: 'rgba(19,26,34,.35)' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card w-[600px] max-w-[92vw] p-0 overflow-hidden" style={{ boxShadow: 'var(--shadow-lg)', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Search size={17} className="mu" />
          <input autoFocus className="flex-1 bg-transparent outline-none text-[16px]" placeholder="Aller à une page, un site, une demande…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { setIdx(i => Math.min(items.length - 1, i + 1)); e.preventDefault() }
              if (e.key === 'ArrowUp') { setIdx(i => Math.max(0, i - 1)); e.preventDefault() }
              if (e.key === 'Enter' && items[idx]) { items[idx].go(); onClose() }
              if (e.key === 'Escape') onClose()
            }} />
          <span className="kbd">Échap</span>
        </div>
        <div className="max-h-[440px] overflow-y-auto p-1.5">
          {items.map((it, k) => (
            <button key={k} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: k === idx ? 'var(--navy-soft)' : undefined }} onMouseEnter={() => setIdx(k)} onClick={() => { it.go(); onClose() }}>
              <i className="dot" style={{ background: it.color ?? '#8a919c' }} /><b className="text-[14px] whitespace-nowrap">{it.label}</b><span className="mu text-[13px] truncate">{it.sub}</span>
            </button>
          ))}
          {!items.length && <div className="mu p-4 text-center">Aucun résultat</div>}
        </div>
      </motion.div>
    </div>
  )
}

// Visite guidée (démonstration de 10 minutes) : 10 étapes, flèches ← / →.
export const DEMO_STEPS = [
  { path: '/', ds: 'novapolis', sc: 'normal', cap: 'Le problème : trois questions posées par la ville de Novapolis' },
  { path: '/donnees', ds: 'novapolis', sc: 'normal', cap: 'Les données : format CSV documenté, validateur, quatre familles de jeux' },
  { path: '/accessibilite', ds: 'novapolis', sc: 'normal', cap: 'M1 · Accessibilité depuis les casernes (BFS) et trois notions de connexité' },
  { path: '/itineraires', ds: 'novapolis', sc: 'normal', cap: 'M2 · Itinéraire d’une demande en situation normale', demande: true },
  { path: '/itineraires', ds: 'novapolis', sc: 'fermeture_axe', cap: 'M2 · La même demande après fermeture des ponts centraux', demande: true },
  { path: '/circuits', ds: 'novapolis', sc: 'normal', cap: 'M3 · Circuit absorbant accessible (A) ou non accessible (B) depuis S' },
  { path: '/fibre', ds: 'novapolis', sc: 'normal', cap: 'M4 · Kruskal et Prim : même coût, tronçons différents en cas d’égalité' },
  { path: '/fibre', ds: 'novapolis', sc: 'normal', cap: 'M4 · Panne d’un tronçon et raccordement le moins coûteux', panne: true },
  { path: '/scenarios', ds: 'novapolis', sc: 'normal', cap: 'M5 · Six scénarios comparés sur les cinq indicateurs de résilience' },
  { path: '/laboratoire', ds: 'mini', sc: 'normal', cap: 'Laboratoire · Dijkstra pas à pas sur un petit graphe', extra: { algo: 'dijkstra', dst: 'T1' } },
  { path: '/benchmarks', ds: 'novapolis', sc: 'normal', cap: 'Expériences : temps mesurés et complexités théoriques' },
  { path: '/bilan', ds: 'novapolis', sc: 'normal', cap: 'Bilan : conformité au sujet, limites et recommandations' },
]

export function exitFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen() } catch { /* ignoré */ }
}

export function DemoBar() {
  const s = useStore()
  const nav = useNavigate()
  const [demande, setDemande] = useState<string | null>(null)
  const step = s.demo
  useEffect(() => {
    if (step === null || demande) return
    api.routes({ dataset: 'novapolis', scenario: 'fermeture_axe' })
      .then(r => { const best = [...r.lignes].filter(l => l.retard !== null).sort((a, b) => (b.retard ?? 0) - (a.retard ?? 0))[0]; setDemande(best?.demande ?? r.lignes[0]?.demande ?? null) })
      .catch(() => setDemande(null))
  }, [step, demande])
  useEffect(() => {
    if (step === null) return
    const st = DEMO_STEPS[step]
    const p = new URLSearchParams()
    p.set('ds', st.ds)
    if (st.sc !== 'normal') p.set('sc', st.sc)
    if (st.demande && demande) p.set('d', demande)
    if (st.panne) p.set('panne', 'auto')
    if (st.extra) Object.entries(st.extra).forEach(([k, v]) => p.set(k, v))
    nav({ pathname: st.path, search: '?' + p.toString() })
  }, [step, demande, nav])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (s.demo === null || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); s.setDemo(Math.min(DEMO_STEPS.length - 1, (s.demo ?? 0) + 1)) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); s.setDemo(Math.max(0, (s.demo ?? 0) - 1)) }
      if (e.key === 'Escape') { s.setDemo(null); exitFullscreen() }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [s])
  if (step === null) return null
  // barre ancrée en bas de l'écran (à la place du pied de page) : elle ne masque jamais le contenu
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="no-print flex items-center gap-4 pl-5 pr-4 min-w-0"
      style={{ height: 60, background: 'var(--surface)', borderTop: '2px solid var(--navy)' }}>
      <span className="pill p-in shrink-0"><MonitorPlay size={13} />Présentation</span>
      <span className="text-[13px] mu font-semibold uppercase tracking-[.07em] shrink-0 num">Étape {step + 1} / {DEMO_STEPS.length}</span>
      <div className="serif text-[18px] font-semibold leading-snug truncate min-w-0 flex-1">{DEMO_STEPS[step].cap}</div>
      <div className="hidden lg:flex gap-1 shrink-0">{DEMO_STEPS.map((_, i) => (
        <button key={i} onClick={() => s.setDemo(i)} title={`Étape ${i + 1} : ${DEMO_STEPS[i].cap}`} className="block w-[16px] h-[6px] rounded-full" style={{ background: i <= step ? 'var(--navy)' : 'var(--rule)' }} />
      ))}</div>
      <button className="btn btn-gh btn-sm" disabled={step === 0} onClick={() => s.setDemo(Math.max(0, step - 1))} title="Étape précédente (←)">←</button>
      <button className="btn btn-pri btn-sm" disabled={step === DEMO_STEPS.length - 1} onClick={() => s.setDemo(Math.min(DEMO_STEPS.length - 1, step + 1))} title="Étape suivante (→)">→</button>
      <button className="btn btn-gh btn-sm" onClick={() => { s.setDemo(null); exitFullscreen() }} title="Quitter la présentation (Échap)"><X size={15} />Quitter</button>
    </motion.div>
  )
}

export function PageHeader({ children }: { children?: ReactNode }) {
  return <div className="flex items-center gap-2.5 mb-4 flex-wrap">{children}</div>
}
