// Coque de l'application : barre latérale, barre du haut (contexte global), pied de page, palette Ctrl+K, mode démo.
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Command, Play, RotateCcw, Search, SkipForward, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { fmtMs, shortHash } from '../lib/format'
import { useStore } from '../lib/store'
import { PAGES, pageByPath } from '../pages'
import { scenLabel, TYPE_COLOR } from '../theme/tokens'

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { apiOk } = useStore()
  const loc = useLocation()
  let groupe = ''
  return (
    <aside className="flex flex-col border-r border-bd" style={{ background: 'linear-gradient(180deg,#0A1022 0%,#070B16 100%)', padding: '16px 12px 12px', width: collapsed ? 64 : 236, transition: 'width .2s' }}>
      <div className="flex gap-[11px] items-center px-2 pb-5">
        <div className="grid place-items-center shrink-0" style={{ width: 36, height: 36, borderRadius: 11, background: 'radial-gradient(circle at 30% 25%,#ff7a8a,#FF5468 45%,#8a1f3a)', boxShadow: '0 0 0 1px #ff546855,0 8px 28px -6px #ff5468aa' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><circle cx="5" cy="6" r="2" /><circle cx="19" cy="7" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6.3l10 .6M6 8l5 8.3M18 9l-5 7.3" /></svg>
        </div>
        {!collapsed && <div><b className="block text-[14px] font-extrabold tracking-[.2px]">Novapolis</b><span className="mu text-[11px]">Résilience · ING1 BDML</span></div>}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        {PAGES.map(p => {
          const entete = p.g !== groupe ? ((groupe = p.g), true) : false
          const Icon = p.icon
          return (
            <div key={p.id}>
              {entete && !collapsed && <div className="mu2 text-[10.5px] tracking-[1.2px] uppercase font-semibold px-2.5 pt-3 pb-1.5">{p.g}</div>}
              <NavLink to={{ pathname: p.path, search: loc.search }} end className={({ isActive }) => `navlink ${isActive ? 'on' : ''}`} title={p.t}>
                <Icon size={16} />{!collapsed && p.t}{!collapsed && p.tag && <span className="tag">{p.tag}</span>}
              </NavLink>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-bd pt-3 px-2 text-[11.5px] mu">
        <div className="flex items-center"><span className="dot" style={{ background: apiOk ? '#3DDC97' : apiOk === false ? '#FF4D4D' : '#FFB547', boxShadow: `0 0 10px ${apiOk ? '#3DDC97' : '#FF4D4D'}` }} />{!collapsed && (apiOk ? <>API connectée · <span className="mono ml-1">:8000</span></> : apiOk === false ? 'API hors ligne' : 'connexion…')}</div>
        <button className="mt-2 mu2 flex items-center gap-1 text-[11px]" onClick={onToggle}>{collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /> réduire</>}</button>
      </div>
    </aside>
  )
}

export function TopBar({ onPalette }: { onPalette: () => void }) {
  const s = useStore()
  const loc = useLocation()
  const page = pageByPath(loc.pathname)
  const info = s.datasets.find(d => d.id === s.dataset)
  const scenarios = info?.scenarios ?? ['normal']
  const groupes: Record<string, string> = { mini: 'Vérifiable à la main', test: 'Tests M3 (poids négatifs)', realiste: 'Réaliste', generes: 'Générés (benchmarks)', benchmark: 'Générés (benchmarks)' }
  const parGroupe = useMemo(() => {
    const m = new Map<string, typeof s.datasets>()
    s.datasets.forEach(d => { const g = groupes[d.groupe ?? ''] ?? 'Autres'; m.set(g, [...(m.get(g) ?? []), d]) })
    return [...m.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.datasets])
  const per = s.periode ?? s.effectivePeriode
  return (
    <header className="flex items-center gap-3 px-5 border-b border-bd min-w-0 overflow-hidden" style={{ background: '#090E1CEE', backdropFilter: 'blur(10px)', height: 58 }}>
      <h1 className="text-[15px] font-bold whitespace-nowrap overflow-hidden text-ellipsis min-w-[90px] shrink">{page.t}<small className="mu font-medium ml-2 text-[12px] hidden 2xl:inline">{page.st}</small></h1>
      <div className="flex-1" />
      <div className="flex items-center gap-2 rounded-[9px] border border-bd px-2.5 py-1 text-[12px]" style={{ background: '#0E1527' }}>
        <span className="mu">Jeu</span>
        <select className="bg-transparent font-semibold text-white outline-none mono" value={s.dataset} onChange={e => s.setDataset(e.target.value)}>
          {!info && <option value={s.dataset}>{s.dataset}</option>}
          {parGroupe.map(([g, ds]) => <optgroup key={g} label={g}>{ds.map(d => <option key={d.id} value={d.id} style={{ background: '#0E1527' }}>{d.id}</option>)}</optgroup>)}
        </select>
        {info?.synthetique && <span className="badge-syn">synthétique</span>}
      </div>
      <div className="seg min-w-[120px] max-w-[440px] overflow-x-auto shrink" style={{ scrollbarWidth: 'none' }}>
        {scenarios.map(sc => <button key={sc} className={s.scenario === sc ? 'on' : ''} onClick={() => s.setScenario(sc)}>{scenLabel(sc)}</button>)}
      </div>
      <div className="seg" title={s.periode ? 'Période imposée' : 'Période du scénario'}>
        {['normal', 'pointe'].map(p => (
          <button key={p} className={per === p ? 'on' : ''} style={per === p && !s.periode ? { boxShadow: 'inset 0 0 0 1px #2A3A60', borderStyle: 'dashed' } : undefined} onClick={() => s.setPeriode(p)}>{p === 'normal' ? 'Normal' : 'Pointe'}</button>
        ))}
        {s.periode && <button onClick={() => s.setPeriode(null)} title="Revenir à la période du scénario"><RotateCcw size={12} /></button>}
      </div>
      <button className="btn btn-gh shrink-0" onClick={() => s.setDemo(0)}><SkipForward size={14} />Mode démo</button>
      <button className="btn btn-pri shrink-0" onClick={() => { s.run(); s.toast('info', 'Recalcul demandé à l’API') }}><Play size={12} fill="currentColor" />Exécuter</button>
      <button className="kbd flex items-center gap-1" onClick={onPalette}><Command size={10} />K</button>
    </header>
  )
}

export function Footer() {
  const s = useStore()
  const info = s.datasets.find(d => d.id === s.dataset)
  const ok = s.hash ? s.hash.ok : true
  return (
    <footer className="flex items-center gap-4 px-5 border-t border-bd text-[11px] mu" style={{ background: '#080C18', height: 30 }}>
      <span>Dernier calcul : <b className="mono text-white">{s.lastCalc?.label ?? '—'}</b> · <span className="mono">{fmtMs(s.lastCalc?.ms ?? null)}</span></span>
      <span>Base <span className="mono">sha256 {shortHash(s.hash?.avant ?? info?.hash)}</span></span>
      <span style={{ color: ok ? '#3DDC97' : '#FF4D4D' }}>● {ok ? 'Base de référence inchangée' : 'Base modifiée !'}</span>
      <span className="flex-1" />
      {info?.fichiers && <span className="mono">{info.fichiers['sites.csv']} sites · {info.fichiers['routes.csv']} arcs · {info.fichiers['fibre.csv']} tronçons · {info.fichiers['demandes.csv']} demandes</span>}
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
      ...PAGES.map(p => ({ label: p.t, sub: `page · ${p.st}`, go: () => nav({ pathname: p.path, search: loc.search }) })),
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
    <div className="fixed inset-0 z-50 grid place-items-start justify-center pt-[12vh]" style={{ background: '#0008' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="card w-[560px] p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-bd">
          <Search size={15} className="mu" />
          <input autoFocus className="flex-1 bg-transparent outline-none text-[14px]" placeholder="Aller à une page, un site, une demande…" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { setIdx(i => Math.min(items.length - 1, i + 1)); e.preventDefault() }
              if (e.key === 'ArrowUp') { setIdx(i => Math.max(0, i - 1)); e.preventDefault() }
              if (e.key === 'Enter' && items[idx]) { items[idx].go(); onClose() }
              if (e.key === 'Escape') onClose()
            }} />
          <span className="kbd">Échap</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {items.map((it, k) => (
            <button key={k} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: k === idx ? '#141f3a' : undefined }} onMouseEnter={() => setIdx(k)} onClick={() => { it.go(); onClose() }}>
              <span style={{ color: it.color ?? '#8592AE' }}>●</span><b className="mono text-[12.5px]">{it.label}</b><span className="mu text-[11.5px] truncate">{it.sub}</span>
            </button>
          ))}
          {!items.length && <div className="mu p-4 text-center">Aucun résultat</div>}
        </div>
      </motion.div>
    </div>
  )
}

// Visite guidée (présentation de 10 minutes) : 8 étapes, flèches ← / →.
export const DEMO_STEPS = [
  { path: '/donnees', ds: 'novapolis', sc: 'normal', cap: 'Données synthétiques, validateur et studio de génération' },
  { path: '/accessibilite', ds: 'novapolis', sc: 'normal', cap: 'Accessibilité depuis les casernes (BFS) et trois notions de connexité' },
  { path: '/itineraires', ds: 'novapolis', sc: 'normal', cap: 'Itinéraire d’une demande en situation normale', demande: true },
  { path: '/itineraires', ds: 'novapolis', sc: 'fermeture_axe', cap: 'La même demande après fermeture des ponts centraux', demande: true },
  { path: '/circuits', ds: 'novapolis', sc: 'normal', cap: 'Circuits absorbants : accessible (A) vs non accessible (B)' },
  { path: '/fibre', ds: 'novapolis', sc: 'normal', cap: 'Kruskal vs Prim : même coût, arêtes différentes en cas d’égalité' },
  { path: '/fibre', ds: 'novapolis', sc: 'normal', cap: 'Panne d’un tronçon et raccordement le moins cher', panne: true },
  { path: '/scenarios', ds: 'novapolis', sc: 'normal', cap: 'Comparaison des scénarios (5 indicateurs) — puis benchmarks' },
]

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
    nav({ pathname: st.path, search: '?' + p.toString() })
  }, [step, demande, nav])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (s.demo === null || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') s.setDemo(Math.min(DEMO_STEPS.length - 1, (s.demo ?? 0) + 1))
      if (e.key === 'ArrowLeft') s.setDemo(Math.max(0, (s.demo ?? 0) - 1))
      if (e.key === 'Escape') s.setDemo(null)
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [s])
  return (
    <AnimatePresence>
      {step !== null && (
        <div className="fixed inset-x-0 bottom-11 z-40 flex justify-center pointer-events-none">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] border"
          style={{ background: '#111a31F2', borderColor: '#3a4a75', boxShadow: '0 20px 60px -10px #000', backdropFilter: 'blur(10px)' }}>
          <span className="pill p-ko">● DÉMO</span>
          <span><b>Étape {step + 1}/{DEMO_STEPS.length}</b> · <span className="mu">{DEMO_STEPS[step].cap}</span></span>
          <div className="flex gap-1">{DEMO_STEPS.map((_, i) => <i key={i} className="block w-[18px] h-1 rounded" style={{ background: i <= step ? '#FF5468' : '#2a3658' }} />)}</div>
          <button className="btn btn-gh btn-sm" onClick={() => s.setDemo(Math.max(0, step - 1))}>←</button>
          <button className="btn btn-gh btn-sm" onClick={() => s.setDemo(Math.min(DEMO_STEPS.length - 1, step + 1))}>→</button>
          <button className="mu" onClick={() => s.setDemo(null)}><X size={15} /></button>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function PageHeader({ children }: { children?: ReactNode }) {
  return <div className="flex items-center gap-2.5 mb-3 flex-wrap">{children}</div>
}
