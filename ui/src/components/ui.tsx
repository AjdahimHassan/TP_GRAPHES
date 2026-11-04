// Composants partagés (style de la maquette) : cartes, pastilles, KPI, chemins, encadrés, squelettes…
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Info, Inbox, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { copy, fmt } from '../lib/format'
import { useStore } from '../lib/store'
import { scenLabel, TYPE_COLOR } from '../theme/tokens'

export function Card({ title, right, children, className = '', style, glow }: { title?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; style?: React.CSSProperties; glow?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`card ${className}`}
      style={{ ...(glow ? { borderColor: glow, boxShadow: `0 0 24px -12px ${glow}` } : {}), ...style }}
    >
      {(title || right) && (
        <div className="card-title">
          {title}
          {right && <span className="ml-auto flex items-center gap-2 flex-wrap">{right}</span>}
        </div>
      )}
      {children}
    </motion.div>
  )
}

export const Pill = ({ kind = 'mu', children, title }: { kind?: 'ok' | 'ko' | 'am' | 'cy' | 'in' | 'mu'; children: ReactNode; title?: string }) => (
  <span className={`pill p-${kind}`} title={title}>{children}</span>
)

export function KpiCard({ label, value, unit, sub, color, icon }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; color: string; icon: ReactNode }) {
  return (
    <Card>
      <div className="kpi-l">
        {label}
        <span className="ml-auto grid place-items-center rounded-lg" style={{ width: 26, height: 26, background: color + '1f', color }}>{icon}</span>
      </div>
      <div className="kpi-v">{value}{unit && <small className="text-[13px] mu ml-1 tracking-normal">{unit}</small>}</div>
      <div className="text-[11.5px] mu">{sub}</div>
    </Card>
  )
}

export function Seg<T extends string>({ value, options, onChange, size }: { value: T | null; options: { v: T; l: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.title} style={size === 'sm' ? { padding: '3px 8px', fontSize: 11.5 } : undefined}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

export function PathChips({ path, max = 0, types }: { path: string[] | null | undefined; max?: number; types?: Record<string, string> }) {
  if (!path || path.length === 0) return <span className="mu2">aucun chemin</span>
  let items: (string | null)[] = path
  if (max && path.length > max) items = [...path.slice(0, 3), null, ...path.slice(-2)]
  const cls = (id: string) => {
    const t = types?.[id] ?? (id.startsWith('C') ? 'caserne' : id.startsWith('H') ? 'hopital' : '')
    return t === 'caserne' ? 'chip chip-c' : t === 'hopital' ? 'chip chip-h' : 'chip'
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {items.map((id, k) => (
        <span key={k} className="flex items-center gap-1">
          {k > 0 && <span className="mu2 text-[10px]">▸</span>}
          {id === null ? <span className="mu2 text-[11px]">… {path.length - 5} …</span> : <span className={cls(id)}>{id}</span>}
        </span>
      ))}
    </div>
  )
}

export function DeltaBadge({ value, better = 'lower', unit = '', d = 1 }: { value: number; better?: 'lower' | 'higher'; unit?: string; d?: number }) {
  if (Math.abs(value) < 1e-9) return <span className="mu2 text-[10.5px]">=</span>
  const bad = better === 'lower' ? value > 0 : value < 0
  return <span className={`pill ${bad ? 'p-ko' : 'p-ok'}`} style={{ fontSize: 10, padding: '0 6px' }}>{value > 0 ? '▲' : '▼'} {fmt(Math.abs(value), d)}{unit}</span>
}

export const ScenarioChip = ({ name, color }: { name: string; color?: string }) => (
  <span className="pill p-mu"><span style={{ color: color ?? '#8592AE' }}>●</span>{scenLabel(name)}</span>
)

export const Prio = ({ p }: { p: number }) => <span className={`prio P${p}`}>P{p}</span>

export function TypeDot({ type }: { type: string }) {
  return <span style={{ color: TYPE_COLOR[type] ?? '#8592AE' }}>●</span>
}

export function InfoCallout({ children, title, icon }: { children: ReactNode; title?: string; icon?: ReactNode }) {
  return (
    <div className="callout">
      {title && <div className="flex items-center gap-2 mb-1 font-semibold text-white">{icon ?? <Info size={14} />}{title}</div>}
      {children}
    </div>
  )
}

export function CodeLine({ cmd }: { cmd: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="code">
      <span className="pr">$</span>
      <span className="overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'thin' }}>{cmd}</span>
      <button className="ml-auto mu text-[10.5px] border border-bd2 rounded px-2 flex items-center gap-1 shrink-0" onClick={() => { copy(cmd); setOk(true); setTimeout(() => setOk(false), 1200) }}>
        {ok ? <Check size={11} /> : <Copy size={11} />} {ok ? 'copié' : 'copier'}
      </button>
    </div>
  )
}

export const Skeleton = ({ h = 120, className = '' }: { h?: number; className?: string }) => <div className={`skeleton ${className}`} style={{ height: h }} />

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
      <div className="mu">{icon ?? <Inbox size={26} />}</div>
      <b>{title}</b>
      {children && <div className="mu text-[12px] max-w-md">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="banner ko">
      <AlertTriangle size={16} />
      <div className="flex-1"><b>Erreur de l'API</b><div className="text-[11.5px]">{error}</div></div>
      {onRetry && <button className="btn btn-gh btn-sm" onClick={onRetry}>Réessayer</button>}
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="fixed right-4 bottom-12 z-50 flex flex-col gap-2 w-[360px]">
      {toasts.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className={`banner ${t.kind === 'error' ? 'ko' : t.kind === 'ok' ? 'ok' : 'am'}`} style={{ boxShadow: '0 10px 30px -10px #000' }}>
          {t.kind === 'error' ? <X size={15} /> : t.kind === 'ok' ? <Check size={15} /> : <Info size={15} />}
          <span className="text-[12px]">{t.text}</span>
        </motion.div>
      ))}
    </div>
  )
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return <div className="bar"><div style={{ width: `${Math.max(3, Math.min(100, (value / (max || 1)) * 100))}%`, background: color }} /></div>
}

export function Stat({ v, l, color }: { v: ReactNode; l: string; color?: string }) {
  return (
    <div className="fileC text-center" style={{ padding: 8 }}>
      <div className="mono text-[16px] font-semibold" style={{ color }}>{v}</div>
      <div className="mu2 text-[10.5px]">{l}</div>
    </div>
  )
}

/** Mini-rendu Markdown (titres, listes, tableaux, code, gras) pour SCHEMA.md / CONTRIBUTIONS.md. */
export function Markdown({ text }: { text: string }) {
  const lignes = text.split('\n')
  const blocs: ReactNode[] = []
  let i = 0
  const inline = (s: string) => {
    const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    return parts.map((p, k) => (p.startsWith('`') ? <code key={k}>{p.slice(1, -1)}</code> : p.startsWith('**') ? <b key={k}>{p.slice(2, -2)}</b> : p))
  }
  while (i < lignes.length) {
    const l = lignes[i]
    if (l.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lignes.length && !lignes[i].startsWith('```')) buf.push(lignes[i++])
      blocs.push(<pre key={i}>{buf.join('\n')}</pre>)
      i++
      continue
    }
    if (l.startsWith('|')) {
      const rows: string[][] = []
      while (i < lignes.length && lignes[i].startsWith('|')) {
        const cells = lignes[i].split('|').slice(1, -1).map(c => c.trim())
        if (!cells.every(c => /^:?-+:?$/.test(c))) rows.push(cells)
        i++
      }
      blocs.push(
        <table key={i}><thead><tr>{rows[0]?.map((c, k) => <th key={k}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table>,
      )
      continue
    }
    if (/^\s*[-*] /.test(l)) {
      const items: string[] = []
      while (i < lignes.length && /^\s*[-*] /.test(lignes[i])) items.push(lignes[i++].replace(/^\s*[-*] /, ''))
      blocs.push(<ul key={i}>{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>)
      continue
    }
    if (l.startsWith('### ')) blocs.push(<h3 key={i}>{inline(l.slice(4))}</h3>)
    else if (l.startsWith('## ')) blocs.push(<h2 key={i}>{inline(l.slice(3))}</h2>)
    else if (l.startsWith('# ')) blocs.push(<h1 key={i}>{inline(l.slice(2))}</h1>)
    else if (l.startsWith('>')) blocs.push(<div key={i} className="callout my-2">{inline(l.replace(/^>\s?/, ''))}</div>)
    else if (l.trim()) blocs.push(<p key={i}>{inline(l)}</p>)
    i++
  }
  return <div className="md">{blocs}</div>
}
