// Composants partagés (thème « papier académique ») : cartes à légende, pastilles, chiffres clés, encadrés…
import { motion } from 'framer-motion'
import { AlertTriangle, BookOpen, Check, Copy, Info, Inbox, Lightbulb, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { copy, fmt } from '../lib/format'
import { useStore } from '../lib/store'
import { scenLabel, TYPE_COLOR } from '../theme/tokens'

/** Carte avec, au choix, une étiquette de figure (« Figure 2 »), un titre en serif et un sous-titre. */
export function Card({ fig, title, sub, right, children, className = '', style, glow, bodyClass = '' }: {
  fig?: ReactNode; title?: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; style?: React.CSSProperties; glow?: string; bodyClass?: string
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`card ${className}`}
      style={{ ...(glow ? { borderColor: glow, boxShadow: `0 0 0 1px ${glow}, var(--shadow)` } : {}), ...style }}
    >
      {(title || right || fig) && (
        <div className="card-head">
          <div className="min-w-0">
            {fig && <div className="card-fig">{fig}</div>}
            {title && <h3 className="card-title">{title}</h3>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {right && <div className="card-right">{right}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </motion.section>
  )
}

export const Pill = ({ kind = 'mu', children, title }: { kind?: 'ok' | 'ko' | 'am' | 'cy' | 'in' | 'vi' | 'mu'; children: ReactNode; title?: string }) => (
  <span className={`pill p-${kind}`} title={title}>{children}</span>
)

/** Chiffre clé (tuile) : libellé, valeur en grand, précision dessous. */
export function KpiCard({ label, value, unit, sub, color, icon, onClick }: { label: ReactNode; value: ReactNode; unit?: string; sub?: ReactNode; color?: string; icon?: ReactNode; onClick?: () => void }) {
  return (
    <div className={`card ${onClick ? 'cursor-pointer hover:border-[var(--navy-line)]' : ''}`} onClick={onClick} style={{ padding: '16px 18px' }}>
      <div className="kpi-l">
        {icon && <span className="grid place-items-center rounded-md shrink-0" style={{ width: 24, height: 24, background: (color ?? '#1F4E79') + '18', color: color ?? '#1F4E79' }}>{icon}</span>}
        <span className="min-w-0">{label}</span>
      </div>
      <div className="kpi-v">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="text-[13.5px] mu leading-snug">{sub}</div>}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange, size }: { value: T | null; options: { v: T; l: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' }) {
  return (
    <div className={`seg ${size === 'sm' ? 'sm' : ''}`} role="tablist">
      {options.map(o => (
        <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.title} role="tab" aria-selected={value === o.v}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

const typeGuess = (id: string, types?: Record<string, string>) => types?.[id] ?? (id.startsWith('C-') ? 'caserne' : id.startsWith('H-') ? 'hopital' : id.startsWith('E-') ? 'ecole' : id.startsWith('T-') ? 'telecom' : '')

/** Identifiant de site : texte en encre, pastille de la couleur du type. */
export function IdChip({ id, type, types, title }: { id: string; type?: string; types?: Record<string, string>; title?: string }) {
  const t = type ?? typeGuess(id, types)
  return <span className="chip" title={title}>{t && t !== 'quartier' && <i className="chip-dot" style={{ background: TYPE_COLOR[t] }} />}{id}</span>
}

export function PathChips({ path, max = 0, types }: { path: string[] | null | undefined; max?: number; types?: Record<string, string> }) {
  if (!path || path.length === 0) return <span className="mu">aucun chemin</span>
  let items: (string | null)[] = path
  if (max && path.length > max) items = [...path.slice(0, 3), null, ...path.slice(-2)]
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {items.map((id, k) => (
        <span key={k} className="flex items-center gap-1.5">
          {k > 0 && <span className="mu2 text-[12px]">→</span>}
          {id === null ? <span className="mu text-[13px]">… {path.length - 5} sites …</span> : <IdChip id={id} types={types} />}
        </span>
      ))}
    </div>
  )
}

export function DeltaBadge({ value, better = 'lower', unit = '', d = 1 }: { value: number; better?: 'lower' | 'higher'; unit?: string; d?: number }) {
  if (Math.abs(value) < 1e-9) return <span className="mu2 text-[12.5px] ml-1">=</span>
  const bad = better === 'lower' ? value > 0 : value < 0
  return <span className={`pill ${bad ? 'p-ko' : 'p-ok'} ml-1.5`} style={{ fontSize: 11.5, padding: '1px 7px' }}>{value > 0 ? '▲' : '▼'} {fmt(Math.abs(value), d)}{unit}</span>
}

export const ScenarioChip = ({ name, color }: { name: string; color?: string }) => (
  <span className="pill p-mu"><i className="dot" style={{ background: color ?? '#898781' }} />{scenLabel(name)}</span>
)

export const Prio = ({ p }: { p: number }) => <span className={`prio P${p}`} title={`Priorité ${p} (1 = la plus urgente)`}>P{p}</span>

export function TypeDot({ type }: { type: string }) {
  return <i className="dot" style={{ background: TYPE_COLOR[type] ?? '#8a919c' }} />
}

type CalloutKind = 'def' | 'rem' | 'warn' | 'ok' | 'ko'
const CALLOUT_ICON: Record<CalloutKind, ReactNode> = { def: <BookOpen size={14} />, rem: <Lightbulb size={14} />, warn: <AlertTriangle size={14} />, ok: <Check size={14} />, ko: <X size={14} /> }

/** Encadré façon LaTeX : Définition, Remarque, Limites, Résultat… */
export function Callout({ kind = 'def', title, children, className = '' }: { kind?: CalloutKind; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`callout ${kind === 'def' ? '' : kind} ${className}`}>
      {title && <div className="callout-t">{CALLOUT_ICON[kind]}{title}</div>}
      <div>{children}</div>
    </div>
  )
}

/** Compatibilité avec l'ancien nom. */
export function InfoCallout({ children, title }: { children: ReactNode; title?: string; icon?: ReactNode }) {
  return <Callout kind="rem" title={title}>{children}</Callout>
}

export function SectionTitle({ n, children, right }: { n?: string; children: ReactNode; right?: ReactNode }) {
  return <h2 className="section-h">{n && <span className="n">{n}</span>}<span>{children}</span>{right && <span className="ml-auto font-sans text-[14px] font-normal">{right}</span>}</h2>
}

export function CodeLine({ cmd }: { cmd: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="code">
      <span className="pr">$</span>
      <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{cmd}</span>
      <button className="ml-auto btn btn-gh btn-sm shrink-0" onClick={() => { copy(cmd); setOk(true); setTimeout(() => setOk(false), 1200) }}>
        {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? 'copié' : 'copier'}
      </button>
    </div>
  )
}

export const Skeleton = ({ h = 120, className = '' }: { h?: number | string; className?: string }) => <div className={`skeleton ${className}`} style={{ height: h }} />

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4 gap-2">
      <div className="mu">{icon ?? <Inbox size={28} />}</div>
      <b className="text-[15px]">{title}</b>
      {children && <div className="mu text-[14px] max-w-md">{children}</div>}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="banner ko">
      <AlertTriangle size={18} />
      <div className="flex-1"><b>Erreur de l'API</b><div className="text-[13.5px]">{error}</div></div>
      {onRetry && <button className="btn btn-gh btn-sm" onClick={onRetry}>Réessayer</button>}
    </div>
  )
}

export function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="fixed right-5 bottom-[78px] z-50 flex flex-col gap-2 w-[380px] no-print">
      {toasts.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className={`banner ${t.kind === 'error' ? 'ko' : t.kind === 'ok' ? 'ok' : 'in'}`} style={{ boxShadow: 'var(--shadow-lg)' }}>
          {t.kind === 'error' ? <X size={16} /> : t.kind === 'ok' ? <Check size={16} /> : <Info size={16} />}
          <span className="text-[14px]">{t.text}</span>
        </motion.div>
      ))}
    </div>
  )
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return <div className="bar"><div style={{ width: `${Math.max(value > 0 ? 2 : 0, Math.min(100, (value / (max || 1)) * 100))}%`, background: color }} /></div>
}

export function Stat({ v, l, color }: { v: ReactNode; l: string; color?: string }) {
  return (
    <div className="stat">
      <b style={color ? { color } : undefined}>{v}</b>
      <span>{l}</span>
    </div>
  )
}

/** Mini-rendu Markdown (titres, listes, tableaux, code, gras) pour SCHEMA.md / CONTRIBUTIONS.md. */
export function Markdown({ text }: { text: string }) {
  const lignes = text.split('\n')
  const blocs: ReactNode[] = []
  let i = 0
  const inline = (s: string) => {
    const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    return parts.map((p, k) => {
      if (p.startsWith('`')) return <code key={k}>{p.slice(1, -1)}</code>
      if (p.startsWith('**')) return <b key={k}>{p.slice(2, -2)}</b>
      const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (m) return <span key={k} className="link">{m[1]}</span>
      return p
    })
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
        <div key={i} className="overflow-x-auto"><table><thead><tr>{rows[0]?.map((c, k) => <th key={k}>{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody></table></div>,
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
    else if (l.startsWith('>')) blocs.push(<div key={i} className="callout rem my-2">{inline(l.replace(/^>\s?/, ''))}</div>)
    else if (l.trim()) blocs.push(<p key={i}>{inline(l)}</p>)
    i++
  }
  return <div className="md">{blocs}</div>
}
