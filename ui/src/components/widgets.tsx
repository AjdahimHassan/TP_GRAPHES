// Lecteur pas à pas, graphiques ECharts, table de validation, graphe « labo » Cytoscape.
import cytoscape from 'cytoscape'
import ReactECharts from 'echarts-for-react'
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Issue } from '../lib/types'
import { Pill } from './ui'

/** Lecteur ⏮ ◀ ▶ ⏭ avec réglage de vitesse ; consomme les événements du traceur de l'API. */
export function StepPlayer({ total, step, onStep, label }: { total: number; step: number; onStep: (k: number) => void; label?: string }) {
  const [play, setPlay] = useState(false)
  const [vitesse, setVitesse] = useState(2)
  const ref = useRef(step)
  ref.current = step
  useEffect(() => {
    if (!play) return
    const t = setInterval(() => {
      if (ref.current >= total) { setPlay(false); return }
      onStep(ref.current + 1)
    }, 700 / vitesse)
    return () => clearInterval(t)
  }, [play, vitesse, total, onStep])
  const pct = total ? (step / total) * 100 : 0
  return (
    <div className="player">
      <button className="pb" onClick={() => onStep(0)} title="Début"><SkipBack size={13} /></button>
      <button className="pb" onClick={() => onStep(Math.max(0, step - 1))} title="Étape précédente"><StepBack size={13} /></button>
      <button className="pb play" onClick={() => { if (step >= total) onStep(0); setPlay(p => !p) }} title="Lecture">{play ? <Pause size={13} /> : <Play size={13} />}</button>
      <button className="pb" onClick={() => onStep(Math.min(total, step + 1))} title="Étape suivante"><StepForward size={13} /></button>
      <button className="pb" onClick={() => onStep(total)} title="Fin"><SkipForward size={13} /></button>
      <div className="flex-1 relative mx-1.5 h-[5px] rounded bg-[#18223e] cursor-pointer" onClick={e => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); onStep(Math.round(((e.clientX - r.left) / r.width) * total)) }}>
        <div className="absolute left-0 top-0 bottom-0 rounded" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#3DDC97,#2EE6D6)' }} />
        <i className="absolute -top-1 w-[13px] h-[13px] rounded-full bg-white" style={{ left: `calc(${pct}% - 6px)`, boxShadow: '0 0 0 3px #2EE6D655' }} />
      </div>
      <span className="mono mu text-[11px] whitespace-nowrap">{label ?? `étape ${step} / ${total}`}</span>
      <select className="inp" style={{ padding: '2px 18px 2px 6px', fontSize: 11 }} value={vitesse} onChange={e => setVitesse(Number(e.target.value))} title="Vitesse">
        {[0.5, 1, 2, 4, 8].map(v => <option key={v} value={v}>×{v}</option>)}
      </select>
    </div>
  )
}

const AXIS = { axisLine: { lineStyle: { color: '#2A3A60' } }, axisLabel: { color: '#8592AE', fontFamily: 'JetBrains Mono', fontSize: 10.5 }, splitLine: { lineStyle: { color: '#141d35' } }, nameTextStyle: { color: '#8592AE', fontFamily: 'Inter' } }
export const chartBase = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter, system-ui', color: '#B5C0D8' },
  tooltip: { trigger: 'axis', backgroundColor: '#0B1222', borderColor: '#2A3A60', textStyle: { color: '#E7ECF5', fontSize: 11.5 } },
  legend: { textStyle: { color: '#8592AE', fontSize: 11 }, icon: 'roundRect', itemWidth: 12, itemHeight: 6, top: 0 },
  grid: { left: 56, right: 18, top: 34, bottom: 42 },
}
export const axis = (extra: any = {}) => ({ ...AXIS, ...extra })

export function Chart({ option, height = 300 }: { option: any; height?: number }) {
  return <ReactECharts option={{ ...chartBase, ...option }} style={{ height }} notMerge lazyUpdate opts={{ renderer: 'canvas' }} />
}

export function ValidationTable({ issues, max = 200 }: { issues: Issue[]; max?: number }) {
  if (!issues.length) return <div className="banner ok"><span>✓ Aucune erreur ni avertissement</span></div>
  return (
    <div className="overflow-auto" style={{ maxHeight: 300 }}>
      <table className="tbl">
        <thead><tr><th>Gravité</th><th>Fichier</th><th className="r">Ligne</th><th>Colonne</th><th>Message</th></tr></thead>
        <tbody>
          {issues.slice(0, max).map((e, k) => (
            <tr key={k}>
              <td>{e.gravite === 'erreur' ? <Pill kind="ko">Erreur</Pill> : <Pill kind="am">Avert.</Pill>}</td>
              <td className="mono">{e.fichier}</td>
              <td className="r mono">{e.ligne ?? '—'}</td>
              <td className="mono">{e.colonne}</td>
              <td style={{ whiteSpace: 'normal' }}>{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface LabNode { id: string; x: number; y: number; state?: 'minf' | 'inf' | 'fin'; label?: string; source?: boolean; color?: string }
export interface LabEdge { id: string; source: string; target: string; label?: string; red?: boolean; neg?: boolean; color?: string; dashed?: boolean; width?: number }

const HACHURE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#3a1019"/><path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke="#FF5468" stroke-width="2.2"/></svg>')

/** Petit graphe nœuds-liens (Cytoscape) pour les jeux de test M3, la forêt Union–Find, etc. */
export function LabGraph({ nodes, edges, height = 270, directed = true, onNode, layout = 'preset' }: { nodes: LabNode[]; edges: LabEdge[]; height?: number; directed?: boolean; onNode?: (id: string) => void; layout?: 'preset' | 'breadthfirst' | 'cose' }) {
  const ref = useRef<HTMLDivElement>(null)
  const cy = useRef<cytoscape.Core | null>(null)
  const cb = useRef(onNode)
  cb.current = onNode
  useEffect(() => {
    if (!ref.current) return
    const c = cytoscape({
      container: ref.current,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      style: [
        { selector: 'node', style: { width: 34, height: 34, 'background-color': '#131C33', 'border-width': 2, 'border-color': 'data(border)', label: 'data(name)', color: '#fff', 'font-family': 'Inter', 'font-weight': 800, 'font-size': 13, 'text-valign': 'center', 'text-halign': 'center' } as any },
        { selector: 'node[state = "minf"]', style: { 'background-image': HACHURE, 'background-fit': 'cover', 'border-color': '#FF5468' } as any },
        { selector: 'node[state = "inf"]', style: { 'background-color': '#101828', 'border-color': '#2a3658', color: '#8592AE' } },
        { selector: 'node[?source]', style: { 'border-color': '#FFB547', 'border-width': 3 } },
        { selector: 'node[sub]', style: { 'text-wrap': 'wrap', label: 'data(full)', 'text-valign': 'center', 'line-height': 1.3 } as any },
        { selector: 'edge', style: { width: 'data(width)', 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': directed ? 'triangle' : 'none', 'curve-style': 'bezier', 'control-point-step-size': 30, label: 'data(label)', 'font-family': 'JetBrains Mono', 'font-size': 10.5, 'font-weight': 600, color: 'data(lcolor)', 'text-background-color': '#0B1222', 'text-background-opacity': 1, 'text-background-padding': '3px', 'text-background-shape': 'roundrectangle', 'text-border-color': 'data(lborder)', 'text-border-width': 1, 'text-border-opacity': 1, 'line-style': 'data(style)' } as any },
      ],
    })
    c.on('tap', 'node', e => cb.current?.(e.target.id()))
    c.minZoom(0.3)
    c.maxZoom(2.2)
    cy.current = c
    return () => c.destroy()
  }, [directed])
  useEffect(() => {
    const c = cy.current
    if (!c) return
    c.elements().remove()
    c.add([
      ...nodes.map(n => ({ data: { id: n.id, name: n.id, full: n.label ? `${n.id}\n${n.label}` : n.id, sub: n.label ? 1 : undefined, state: n.state ?? 'fin', source: n.source || undefined, border: n.color ?? (n.state === 'minf' ? '#FF5468' : n.state === 'inf' ? '#2a3658' : '#3DDC97') }, position: { x: n.x, y: n.y } })),
      ...edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target, label: e.label ?? '', width: e.width ?? (e.red ? 3 : 1.6), color: e.color ?? (e.red ? '#FF5468' : '#3b4c78'), lcolor: e.neg ? '#FF8a98' : '#C9D2E6', lborder: e.neg ? '#FF5468' : '#2A3A60', style: e.dashed ? 'dashed' : 'solid' } })),
    ] as any)
    c.layout(layout === 'preset' ? { name: 'preset', fit: true, padding: 34 } as any : layout === 'breadthfirst' ? { name: 'breadthfirst', directed: true, padding: 12, spacingFactor: 0.9, fit: true } as any : { name: 'cose', animate: false, fit: true, padding: 20 } as any).run()
  }, [nodes, edges, layout])
  return <div ref={ref} style={{ height, background: '#060A14', borderRadius: 10, border: '1px solid #17213b' }} />
}
