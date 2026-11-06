// Lecteur pas à pas, graphiques ECharts (thème clair), table de validation, graphe « labo » Cytoscape.
import cytoscape from 'cytoscape'
import ReactECharts from 'echarts-for-react'
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Issue } from '../lib/types'
import { Pill } from './ui'

/** Lecteur ⏮ ◀ ▶ ⏭ avec réglage de vitesse ; consomme les événements du traceur de l'API. */
export function StepPlayer({ total, step, onStep, label, speeds = [0.5, 1, 2, 4, 8], vitesseInit = 2, autoplay = 0 }: { total: number; step: number; onStep: (k: number) => void; label?: string; speeds?: number[]; vitesseInit?: number; autoplay?: number }) {
  const [play, setPlay] = useState(false)
  const [vitesse, setVitesse] = useState(vitesseInit)
  const ref = useRef(step)
  ref.current = step
  useEffect(() => setVitesse(vitesseInit), [vitesseInit])
  useEffect(() => { if (autoplay > 0) setPlay(true) }, [autoplay])
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
      <button className="pb" onClick={() => onStep(0)} title="Début"><SkipBack size={15} /></button>
      <button className="pb" onClick={() => onStep(Math.max(0, step - 1))} title="Étape précédente"><StepBack size={15} /></button>
      <button className="pb play" onClick={() => { if (step >= total) onStep(0); setPlay(p => !p) }} title={play ? 'Pause' : 'Lecture'}>{play ? <Pause size={15} /> : <Play size={15} />}</button>
      <button className="pb" onClick={() => onStep(Math.min(total, step + 1))} title="Étape suivante"><StepForward size={15} /></button>
      <button className="pb" onClick={() => onStep(total)} title="Fin"><SkipForward size={15} /></button>
      <div className="flex-1 relative mx-2 h-[6px] rounded-full cursor-pointer" style={{ background: 'var(--rule)' }} onClick={e => { const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); onStep(Math.round(((e.clientX - r.left) / r.width) * total)) }}>
        <div className="absolute left-0 top-0 bottom-0 rounded-full" style={{ width: `${pct}%`, background: 'var(--navy)' }} />
        <i className="absolute -top-[5px] w-[16px] h-[16px] rounded-full" style={{ left: `calc(${pct}% - 8px)`, background: '#fff', border: '2px solid var(--navy)', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      <span className="mono text-[13px] text-ink2 whitespace-nowrap">{label ?? `étape ${step} / ${total}`}</span>
      <select className="inp" style={{ padding: '4px 26px 4px 8px', fontSize: 13 }} value={vitesse} onChange={e => setVitesse(Number(e.target.value))} title="Vitesse de lecture">
        {speeds.map(v => <option key={v} value={v}>× {v}</option>)}
      </select>
    </div>
  )
}

const AXIS = {
  axisLine: { lineStyle: { color: '#C3C2B7' } },
  axisTick: { lineStyle: { color: '#C3C2B7' } },
  axisLabel: { color: '#5F6773', fontFamily: 'Inter', fontSize: 13 },
  splitLine: { lineStyle: { color: '#ECE9E2' } },
  nameTextStyle: { color: '#3A434F', fontFamily: 'Inter', fontSize: 13, fontWeight: 500 },
}
export const chartBase = {
  backgroundColor: 'transparent',
  textStyle: { fontFamily: 'Inter, system-ui', color: '#3A434F', fontSize: 13 },
  tooltip: {
    trigger: 'axis', backgroundColor: '#FFFFFF', borderColor: '#CBC5B8', borderWidth: 1, padding: [8, 11],
    textStyle: { color: '#131A22', fontSize: 13.5, fontFamily: 'Inter' },
    extraCssText: 'box-shadow: 0 8px 24px -10px rgba(19,26,34,.35); border-radius: 9px;',
    axisPointer: { type: 'line', lineStyle: { color: '#8A9099', width: 1 } },
  },
  legend: { textStyle: { color: '#3A434F', fontSize: 13, fontFamily: 'Inter' }, icon: 'roundRect', itemWidth: 16, itemHeight: 4, itemGap: 18, top: 0 },
  grid: { left: 66, right: 24, top: 46, bottom: 54 },
}
export const axis = (extra: any = {}) => ({ ...AXIS, ...extra })

export function Chart({ option, height = 300 }: { option: any; height?: number }) {
  return <ReactECharts option={{ ...chartBase, ...option }} style={{ height }} notMerge lazyUpdate opts={{ renderer: 'canvas' }} />
}

export function ValidationTable({ issues, max = 200, maxHeight = 300 }: { issues: Issue[]; max?: number; maxHeight?: number }) {
  if (!issues.length) return <div className="banner ok"><span>✓ Aucune erreur ni avertissement : le jeu est conforme au format documenté.</span></div>
  return (
    <div className="tbl-wrap" style={{ maxHeight }}>
      <table className="tbl compact">
        <thead><tr><th>Gravité</th><th>Fichier</th><th className="r">Ligne</th><th>Colonne</th><th>Message</th></tr></thead>
        <tbody>
          {issues.slice(0, max).map((e, k) => (
            <tr key={k}>
              <td>{e.gravite === 'erreur' ? <Pill kind="ko">Erreur</Pill> : <Pill kind="am">Avertissement</Pill>}</td>
              <td className="mono">{e.fichier}</td>
              <td className="r mono">{e.ligne ?? '—'}</td>
              <td className="mono">{e.colonne}</td>
              <td style={{ whiteSpace: 'normal', minWidth: 260 }}>{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface LabNode { id: string; x: number; y: number; state?: 'minf' | 'inf' | 'fin'; label?: string; source?: boolean; color?: string; fill?: string; dark?: boolean }
export interface LabEdge { id: string; source: string; target: string; label?: string; red?: boolean; neg?: boolean; color?: string; dashed?: boolean; width?: number }

const HACHURE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#FBEBE9"/><path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke="#E8A49C" stroke-width="1.6"/></svg>')

/** Petit graphe nœuds-liens (Cytoscape) pour les jeux de test M3, la forêt Union–Find, etc. */
export function LabGraph({ nodes, edges, height = 290, directed = true, onNode, layout = 'preset' }: { nodes: LabNode[]; edges: LabEdge[]; height?: number; directed?: boolean; onNode?: (id: string) => void; layout?: 'preset' | 'breadthfirst' | 'cose' }) {
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
        { selector: 'node', style: { width: 46, height: 46, 'background-color': '#FFFFFF', 'border-width': 2.5, 'border-color': 'data(border)', label: 'data(name)', color: '#131A22', 'font-family': 'Inter', 'font-weight': 700, 'font-size': 15, 'text-valign': 'center', 'text-halign': 'center' } as any },
        { selector: 'node[state = "minf"]', style: { 'background-image': HACHURE, 'background-fit': 'cover', 'border-color': '#d03b3b', color: '#7A1B14' } as any },
        { selector: 'node[state = "inf"]', style: { 'background-color': '#F1EEE8', 'border-color': '#A8AFB8', 'border-style': 'dashed', color: '#5F6773' } as any },
        { selector: 'node[fill]', style: { 'background-color': 'data(fill)', 'border-style': 'solid' } as any },
        { selector: 'node[?dark]', style: { color: '#FFFFFF' } },
        { selector: 'node[?source]', style: { 'border-color': '#1F4E79', 'border-width': 4.5 } },
        { selector: 'node[sub]', style: { 'text-wrap': 'wrap', label: 'data(full)', 'text-valign': 'center', 'line-height': 1.25, 'font-size': 13.5 } as any },
        { selector: 'edge', style: { width: 'data(width)', 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': directed ? 'triangle' : 'none', 'arrow-scale': 1.2, 'curve-style': 'bezier', 'control-point-step-size': 34, label: 'data(label)', 'font-family': 'JetBrains Mono', 'font-size': 13, 'font-weight': 600, color: 'data(lcolor)', 'text-background-color': '#FFFFFF', 'text-background-opacity': 1, 'text-background-padding': '3px', 'text-background-shape': 'roundrectangle', 'text-border-color': 'data(lborder)', 'text-border-width': 1, 'text-border-opacity': 1, 'line-style': 'data(style)' } as any },
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
    const nData = (n: LabNode) => ({ id: n.id, name: n.id, full: n.label ? `${n.id}\n${n.label}` : n.id, sub: n.label ? 1 : undefined, state: n.state ?? 'fin', source: n.source || undefined, fill: n.fill, dark: n.dark || undefined, border: n.color ?? (n.state === 'minf' ? '#d03b3b' : n.state === 'inf' ? '#A8AFB8' : '#3F9A63') })
    const eStyle = (e: LabEdge) => ({ label: e.label ?? '', width: e.width ?? (e.red ? 3.4 : 1.8), color: e.color ?? (e.red ? '#d03b3b' : '#9AA3B2'), lcolor: e.neg ? '#A4261D' : '#131A22', lborder: e.neg ? '#EFC1BC' : '#E2DED5', style: e.dashed ? 'dashed' : 'solid' })
    // même structure (animation pas à pas) : on met seulement à jour les styles, sans relancer la mise en page
    const meme = c.nodes().length === nodes.length && c.edges().length === edges.length && nodes.every(n => c.getElementById(n.id).nonempty()) && edges.every(e => c.getElementById(e.id).nonempty())
    if (meme && layout === 'preset') {
      let deplace = false
      c.batch(() => {
        nodes.forEach(n => {
          const el = c.getElementById(n.id)
          el.data(nData(n))
          const p = el.position()
          if (Math.abs(p.x - n.x) > 1e-6 || Math.abs(p.y - n.y) > 1e-6) { el.position({ x: n.x, y: n.y }); deplace = true }
        })
        edges.forEach(e => c.getElementById(e.id).data(eStyle(e)))
      })
      if (deplace) c.fit(undefined, 38)
      return
    }
    c.elements().remove()
    c.add([
      ...nodes.map(n => ({ data: nData(n), position: { x: n.x, y: n.y } })),
      ...edges.map(e => ({ data: { id: e.id, source: e.source, target: e.target, ...eStyle(e) } })),
    ] as any)
    c.layout(layout === 'preset' ? { name: 'preset', fit: true, padding: 38 } as any : layout === 'breadthfirst' ? { name: 'breadthfirst', directed: true, padding: 14, spacingFactor: 0.95, fit: true } as any : { name: 'cose', animate: false, fit: true, padding: 24 } as any).run()
  }, [nodes, edges, layout])
  return <div ref={ref} style={{ height, background: '#FBFAF7', borderRadius: 10, border: '1px solid var(--rule)' }} />
}
