// Carte du réseau (deck.gl, vue orthographique, AUCUN fond de carte externe → fonctionne hors ligne).
// Coordonnées en km (x vers l'est, y vers le nord) fournies par l'API.
import { LinearInterpolator, OrthographicView, type PickingInfo } from '@deck.gl/core'
import { PathStyleExtension } from '@deck.gl/extensions'
import { TripsLayer } from '@deck.gl/geo-layers'
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FibreP, RouteP, SiteP } from '../lib/types'
import { hexToRgb, TYPE_COLOR, TYPE_LABEL, TYPE_LETTER } from '../theme/tokens'

export interface MapPath { ids: string[]; color: string; width?: number; animated?: boolean; dashed?: boolean; glow?: boolean }
export interface MapEdge { u: string; v: string; color: string; width?: number; dashed?: boolean; glow?: boolean; dots?: boolean }

interface Props {
  sites: SiteP[]
  routes?: RouteP[]
  fibre?: FibreP[]
  decor?: { riviere?: [number, number][] }
  height?: number | string
  showRoads?: boolean
  showFibre?: boolean
  dimRoads?: boolean
  nodeColor?: (s: SiteP) => string | null
  rings?: Set<string> | string[]
  labels?: string[]
  paths?: MapPath[]
  edges?: MapEdge[]
  cycle?: string[] | null
  mst?: Set<string>
  selected?: string[]
  onSiteClick?: (id: string) => void
  onFibreClick?: (f: FibreP, index: number) => void
  onRoadClick?: (u: string, v: string) => void
  focus?: string | null
  legend?: ReactNode
  overlay?: ReactNode
  plain?: boolean
}

const ext = [new PathStyleExtension({ dash: true })]
export const pairKey = (u: string, v: string) => (u < v ? `${u}|${v}` : `${v}|${u}`)

export default function NetworkCanvas(p: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 480 })
  const [viewState, setViewState] = useState<any>(null)
  const [t, setT] = useState(0)

  const pos = useMemo(() => {
    const m = new Map<string, [number, number]>()
    p.sites.forEach(s => m.set(s.id, [s.x, s.y]))
    return m
  }, [p.sites])
  const typeOf = useMemo(() => new Map(p.sites.map(s => [s.id, s.type])), [p.sites])

  // cadrage initial sur l'emprise des sites
  const fit = useMemo(() => {
    if (!p.sites.length) return { target: [0, 0, 0], zoom: 0 }
    const xs = p.sites.map(s => s.x), ys = p.sites.map(s => s.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const dx = Math.max(x1 - x0, 0.01), dy = Math.max(y1 - y0, 0.01)
    const zoom = Math.log2(Math.min(size.w / dx, size.h / dy) * 0.88)
    return { target: [(x0 + x1) / 2, (y0 + y1) / 2, 0], zoom }
  }, [p.sites, size])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(e => {
      const r = e[0].contentRect
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { setViewState({ ...fit, minZoom: fit.zoom - 3, maxZoom: fit.zoom + 6 }) }, [fit])

  // vol vers un site (clic sur une alerte, palette Ctrl+K)
  useEffect(() => {
    if (!p.focus || !pos.get(p.focus)) return
    const [x, y] = pos.get(p.focus)!
    setViewState((v: any) => ({ ...v, target: [x, y, 0], zoom: fit.zoom + 2, transitionDuration: 700, transitionInterpolator: new LinearInterpolator(['target', 'zoom']) }))
  }, [p.focus, pos, fit.zoom])

  const ringSet = useMemo(() => (p.rings instanceof Set ? p.rings : new Set(p.rings ?? [])), [p.rings])
  const animated = (p.paths ?? []).some(x => x.animated) || ringSet.size > 0
  useEffect(() => {
    if (!animated) return
    let raf = 0, last = 0
    const loop = (now: number) => {
      if (now - last > 33) { setT(now / 1000); last = now }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [animated])

  // routes : une ligne par paire (double sens) ; sens unique et statuts distingués
  const roads = useMemo(() => {
    if (!p.routes || p.showRoads === false) return { lines: [] as any[], closed: [] as any[], works: [] as any[] }
    const m = new Map<string, { u: string; v: string; dirs: number; ferme: boolean; travaux: boolean; voie: string; t?: number }>()
    for (const r of p.routes) {
      if (!pos.has(r.u) || !pos.has(r.v)) continue
      const k = pairKey(r.u, r.v)
      const e = m.get(k) ?? { u: r.u, v: r.v, dirs: 0, ferme: false, travaux: false, voie: r.type_voie ?? '', t: r.temps_normal }
      e.dirs++
      if (r.statut === 'ferme') e.ferme = true
      if (r.statut === 'travaux') e.travaux = true
      m.set(k, e)
    }
    const lines: any[] = [], closed: any[] = [], works: any[] = []
    m.forEach(e => {
      const o = { ...e, a: pos.get(e.u)!, b: pos.get(e.v)! }
      if (e.ferme) closed.push(o)
      else { lines.push(o); if (e.travaux) works.push(o) }
    })
    return { lines, closed, works }
  }, [p.routes, pos, p.showRoads])

  const fibreData = useMemo(() => (p.fibre ?? []).map((f, i) => ({ ...f, i, a: pos.get(f.u), b: pos.get(f.v) })).filter(f => f.a && f.b), [p.fibre, pos])

  const pathData = (ids: string[]) => ids.map(id => pos.get(id)).filter(Boolean) as [number, number][]

  const layers: any[] = []
  if (p.decor?.riviere) {
    layers.push(new PathLayer({ id: 'riviere', data: [{ path: p.decor.riviere }], getPath: (d: any) => d.path, getColor: [12, 32, 51, 230], getWidth: 26, widthUnits: 'pixels', capRounded: true, jointRounded: true }))
  }
  if (p.showRoads !== false && p.routes) {
    const op = p.dimRoads || p.showFibre ? 110 : 255
    layers.push(new LineLayer({
      id: 'routes', data: roads.lines, pickable: !!p.onRoadClick || true,
      getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b,
      getColor: (d: any) => (d.voie === 'pont' ? [59, 79, 128, op] : d.voie === 'periph' ? [42, 58, 98, op] : d.dirs === 1 ? [64, 84, 135, op] : [32, 45, 76, op]),
      getWidth: (d: any) => (d.voie === 'pont' ? 4.5 : d.voie === 'periph' ? 2.4 : d.voie === 'avenue' ? 2 : 1.3), widthUnits: 'pixels',
      onClick: p.onRoadClick ? (i: PickingInfo) => i.object && p.onRoadClick!((i.object as any).u, (i.object as any).v) : undefined,
      updateTriggers: { getColor: [op] },
    }))
    layers.push(new PathLayer({ id: 'travaux', data: roads.works, getPath: (d: any) => [d.a, d.b], getColor: [255, 181, 71, 150], getWidth: 2, widthUnits: 'pixels', getDashArray: [2, 3], extensions: ext } as any))
    layers.push(new PathLayer({ id: 'fermees', data: roads.closed, pickable: true, getPath: (d: any) => [d.a, d.b], getColor: [255, 77, 77, 245], getWidth: 2.8, widthUnits: 'pixels', getDashArray: [3, 2.5], dashJustified: true, extensions: ext, onClick: p.onRoadClick ? (i: PickingInfo) => i.object && p.onRoadClick!((i.object as any).u, (i.object as any).v) : undefined } as any))
  }
  if (p.showFibre && fibreData.length) {
    const cand = fibreData.filter(f => f.statut === 'disponible' && !p.mst?.has(pairKey(f.u, f.v)))
    const ko = fibreData.filter(f => f.statut !== 'disponible')
    const arbre = fibreData.filter(f => f.statut === 'disponible' && p.mst?.has(pairKey(f.u, f.v)))
    layers.push(new LineLayer({ id: 'fibre-cand', data: cand, pickable: true, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: [22, 56, 74, 255], getWidth: 1.2, widthUnits: 'pixels', onClick: p.onFibreClick ? (i: PickingInfo) => i.object && p.onFibreClick!(i.object as any, (i.object as any).i) : undefined }))
    layers.push(new PathLayer({ id: 'fibre-ko', data: ko, pickable: true, getPath: (d: any) => [d.a, d.b], getColor: [255, 77, 77, 230], getWidth: 2.2, widthUnits: 'pixels', getDashArray: [0.6, 3], capRounded: true, extensions: ext } as any))
    if (arbre.length) {
      layers.push(new LineLayer({ id: 'mst-glow', data: arbre, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: [46, 230, 214, 55], getWidth: 8, widthUnits: 'pixels' }))
      layers.push(new LineLayer({ id: 'mst', data: arbre, pickable: true, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: [46, 230, 214, 255], getWidth: 2.4, widthUnits: 'pixels', onClick: p.onFibreClick ? (i: PickingInfo) => i.object && p.onFibreClick!(i.object as any, (i.object as any).i) : undefined }))
    }
  }
  ;(p.edges ?? []).forEach((e, k) => {
    const a = pos.get(e.u), b = pos.get(e.v)
    if (!a || !b) return
    if (e.glow) layers.push(new LineLayer({ id: `edge-glow-${k}`, data: [{ a, b }], getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: hexToRgb(e.color, 70), getWidth: (e.width ?? 3) * 3, widthUnits: 'pixels' }))
    layers.push(new PathLayer({ id: `edge-${k}`, data: [{ path: [a, b] }], getPath: (d: any) => d.path, getColor: hexToRgb(e.color), getWidth: e.width ?? 3, widthUnits: 'pixels', capRounded: true, getDashArray: e.dashed ? [2.5, 2] : e.dots ? [0.5, 2.5] : [0, 0], extensions: ext } as any))
  })
  ;(p.paths ?? []).forEach((pa, k) => {
    const path = pathData(pa.ids)
    if (path.length < 2) return
    if (pa.glow !== false && !pa.dashed) layers.push(new PathLayer({ id: `path-glow-${k}`, data: [{ path }], getPath: (d: any) => d.path, getColor: hexToRgb(pa.color, 60), getWidth: (pa.width ?? 3.6) * 3, widthUnits: 'pixels', jointRounded: true, capRounded: true }))
    layers.push(new PathLayer({ id: `path-${k}`, data: [{ path }], getPath: (d: any) => d.path, getColor: hexToRgb(pa.color, pa.dashed ? 190 : 255), getWidth: pa.width ?? 3.6, widthUnits: 'pixels', jointRounded: true, capRounded: true, getDashArray: pa.dashed ? [1.2, 2.2] : [0, 0], extensions: ext } as any))
    if (pa.animated) {
      const ts: number[] = [0]
      for (let i = 1; i < path.length; i++) ts.push(ts[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
      const total = ts[ts.length - 1] || 1
      const cur = ((t * total) / 3.2) % (total * 1.25)
      layers.push(new TripsLayer({ id: `trip-${k}`, data: [{ path, ts }], getPath: (d: any) => d.path, getTimestamps: (d: any) => d.ts, getColor: [255, 243, 214], getWidth: 3.2, widthUnits: 'pixels', trailLength: total * 0.35, currentTime: cur, capRounded: true, jointRounded: true } as any))
    }
  })
  if (p.cycle && p.cycle.length > 1) {
    layers.push(new PathLayer({ id: 'cycle', data: [{ path: pathData(p.cycle) }], getPath: (d: any) => d.path, getColor: [255, 84, 104, 255], getWidth: 3, widthUnits: 'pixels', jointRounded: true }))
  }
  // sommets
  const col = (s: SiteP) => hexToRgb(p.nodeColor?.(s) ?? TYPE_COLOR[s.type] ?? '#5B6B8F')
  const speciaux = p.sites.filter(s => s.type !== 'quartier')
  const many = p.sites.length > 1500
  layers.push(new ScatterplotLayer({ id: 'halo', data: p.plain ? [] : speciaux, getPosition: (d: any) => [d.x, d.y], getFillColor: (d: any) => [...col(d).slice(0, 3), 40] as any, getRadius: many ? 6 : 12, radiusUnits: 'pixels', updateTriggers: { getFillColor: [p.nodeColor] } }))
  if (ringSet.size) {
    const pulse = (t % 1.6) / 1.6
    const ringData = p.sites.filter(s => ringSet.has(s.id))
    layers.push(new ScatterplotLayer({ id: 'rings', data: ringData, getPosition: (d: any) => [d.x, d.y], stroked: true, filled: false, getLineColor: [255, 77, 77, Math.round(230 * (1 - pulse))], lineWidthUnits: 'pixels', getLineWidth: 2, getRadius: 7 + pulse * 12, radiusUnits: 'pixels', updateTriggers: { getLineColor: [t], getRadius: [t] } }))
    layers.push(new ScatterplotLayer({ id: 'rings-fixe', data: ringData, getPosition: (d: any) => [d.x, d.y], stroked: true, filled: false, getLineColor: [255, 77, 77, 255], lineWidthUnits: 'pixels', getLineWidth: 1.5, getRadius: 8, radiusUnits: 'pixels' }))
  }
  const sel = new Set(p.selected ?? [])
  layers.push(new ScatterplotLayer({
    id: 'sites', data: p.sites, pickable: true,
    getPosition: (d: any) => [d.x, d.y], getFillColor: (d: any) => col(d),
    getRadius: (d: any) => (sel.has(d.id) ? 9 : d.type === 'quartier' ? (many ? 1.8 : 3.8) : many ? 4 : 7.6), radiusUnits: 'pixels',
    stroked: true, getLineColor: (d: any) => (sel.has(d.id) ? [255, 255, 255, 255] : [6, 10, 20, 255]), getLineWidth: (d: any) => (sel.has(d.id) ? 2.5 : 1.6), lineWidthUnits: 'pixels',
    onClick: p.onSiteClick ? (i: PickingInfo) => i.object && p.onSiteClick!((i.object as any).id) : undefined,
    updateTriggers: { getFillColor: [p.nodeColor], getRadius: [p.selected], getLineColor: [p.selected], getLineWidth: [p.selected] },
  }))
  if (!many && !p.plain) {
    layers.push(new TextLayer({ id: 'lettres', data: speciaux, getPosition: (d: any) => [d.x, d.y], getText: (d: any) => TYPE_LETTER[d.type], getColor: [10, 15, 29, 255], getSize: 9, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif', characterSet: 'auto' }))
  }
  if (p.labels?.length) {
    const lab = p.labels.map(id => p.sites.find(s => s.id === id)).filter(Boolean)
    layers.push(new TextLayer({
      id: 'labels', data: lab, getPosition: (d: any) => [d.x, d.y], getText: (d: any) => d.id, getColor: [231, 236, 245, 255], getSize: 11,
      getPixelOffset: [12, -16], getTextAnchor: 'start', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 600,
      background: true, getBackgroundColor: [11, 18, 34, 235], backgroundPadding: [5, 2, 5, 2], getBorderColor: [42, 58, 96, 255], getBorderWidth: 1, characterSet: 'auto',
    } as any))
  }

  const tooltip = (info: PickingInfo) => {
    const o: any = info.object
    if (!o) return null
    const style = { background: '#0B1222', border: '1px solid #2A3A60', borderRadius: '8px', color: '#E7ECF5', fontSize: '11.5px', padding: '6px 9px', fontFamily: 'Inter, system-ui' }
    if (info.layer?.id === 'sites') return { html: `<b style="font-family:JetBrains Mono">${o.id}</b> · ${TYPE_LABEL[o.type] ?? o.type}<br/><span style="color:#8592AE">${o.nom ?? ''}</span>`, style }
    if (info.layer?.id === 'routes' || info.layer?.id === 'fermees') return { html: `Route <b>${o.u} ${o.dirs === 2 ? '↔' : '→'} ${o.v}</b>${o.voie ? ` · ${o.voie}` : ''}${o.t !== undefined ? `<br/>${String(o.t).replace('.', ',')} min (normal)` : ''}${o.ferme ? '<br/><span style="color:#FF7A88">fermée</span>' : o.travaux ? '<br/><span style="color:#FFB547">travaux</span>' : ''}`, style }
    if (info.layer?.id?.startsWith('fibre') || info.layer?.id === 'mst') return { html: `Fibre <b>${o.u} – ${o.v}</b><br/>${o.cost ?? '?'} k€ · ${o.statut}`, style }
    return null
  }

  const zoomBy = (dz: number) => setViewState((v: any) => ({ ...v, zoom: v.zoom + dz, transitionDuration: 200, transitionInterpolator: new LinearInterpolator(['zoom']) }))

  return (
    <div className="mapwrap" ref={box} style={{ height: p.height ?? 480 }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <defs><pattern id="grille" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#0f1830" strokeWidth="1" /></pattern>
          <radialGradient id="ville" cx="50%" cy="50%" r="60%"><stop offset="0" stopColor="#0f1a33" /><stop offset="1" stopColor="#060A14" /></radialGradient></defs>
        <rect width="100%" height="100%" fill="url(#ville)" /><rect width="100%" height="100%" fill="url(#grille)" />
      </svg>
      {viewState && (
        <DeckGL
          views={new OrthographicView({ id: 'carte', flipY: false } as any)}
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
          controller={{ dragRotate: false, doubleClickZoom: true } as any}
          layers={layers}
          getTooltip={tooltip as any}
          getCursor={({ isHovering }: any) => (isHovering ? 'pointer' : 'grab')}
          style={{ position: 'absolute', inset: '0' }}
        />
      )}
      <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
        {[[<Plus size={14} key="p" />, () => zoomBy(0.5)], [<Minus size={14} key="m" />, () => zoomBy(-0.5)], [<Maximize2 size={13} key="f" />, () => setViewState({ ...fit, minZoom: fit.zoom - 3, maxZoom: fit.zoom + 6, transitionDuration: 400, transitionInterpolator: new LinearInterpolator(['target', 'zoom']) })]].map(([ic, f], k) => (
          <button key={k} onClick={f as any} className="w-[30px] h-[30px] rounded-lg grid place-items-center border border-bd2 text-[#C9D2E6]" style={{ background: '#0E1527E6' }}>{ic as any}</button>
        ))}
      </div>
      {p.legend && <div className="mapover legend z-10" style={{ left: 10, bottom: 10, flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>{p.legend}</div>}
      {p.overlay}
    </div>
  )
}

export function TypeLegend() {
  return (
    <div className="legend">
      {Object.keys(TYPE_COLOR).map(t => <span key={t}><i style={{ background: TYPE_COLOR[t] }} />{TYPE_LABEL[t]}</span>)}
    </div>
  )
}

export const LegendLine = ({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) => (
  <span><i className="ln" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} />{label}</span>
)
