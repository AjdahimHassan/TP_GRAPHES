// Carte du réseau (deck.gl, vue orthographique, AUCUN fond de carte externe → fonctionne hors ligne).
// Coordonnées en km (x vers l'est, y vers le nord) fournies par l'API. Thème clair « papier ».
import { LinearInterpolator, OrthographicView, type PickingInfo } from '@deck.gl/core'
import { PathStyleExtension } from '@deck.gl/extensions'
import { TripsLayer } from '@deck.gl/geo-layers'
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import DeckGL from '@deck.gl/react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FibreP, RouteP, SiteP } from '../lib/types'
import { hexToRgb, MAP, TYPE_COLOR, TYPE_LABEL, TYPE_LETTER, TYPE_ON } from '../theme/tokens'

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
  /** nombreux segments à surligner en une seule couche (arbre de parcours, arêtes retenues…) */
  lines?: { u: string; v: string; color: string; width?: number }[]
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

const INK: [number, number, number, number] = [19, 26, 34, 255]

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

  // molette seule = défilement de la page ; Ctrl + molette = zoom de la carte
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const dz = -Math.sign(e.deltaY) * 0.25
      setViewState((v: any) => (v ? { ...v, zoom: Math.min(v.maxZoom ?? 99, Math.max(v.minZoom ?? -99, v.zoom + dz)) } : v))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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
    layers.push(new PathLayer({ id: 'riviere', data: [{ path: p.decor.riviere }], getPath: (d: any) => d.path, getColor: [200, 224, 245, 255], getWidth: 24, widthUnits: 'pixels', capRounded: true, jointRounded: true }))
  }
  if (p.showRoads !== false && p.routes) {
    const op = p.dimRoads || p.showFibre ? 120 : 255
    layers.push(new LineLayer({
      id: 'routes', data: roads.lines, pickable: true,
      getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b,
      getColor: (d: any) => (d.voie === 'pont' ? [96, 108, 130, op] : d.voie === 'periph' ? [150, 158, 174, op] : d.dirs === 1 ? [112, 126, 152, op] : [174, 181, 193, op]),
      getWidth: (d: any) => (d.voie === 'pont' ? 4.5 : d.voie === 'periph' ? 2.6 : d.voie === 'avenue' ? 2.1 : 1.5), widthUnits: 'pixels',
      onClick: p.onRoadClick ? (i: PickingInfo) => i.object && p.onRoadClick!((i.object as any).u, (i.object as any).v) : undefined,
      updateTriggers: { getColor: [op] },
    }))
    layers.push(new PathLayer({ id: 'travaux', data: roads.works, getPath: (d: any) => [d.a, d.b], getColor: hexToRgb(MAP.works, 235), getWidth: 2.6, widthUnits: 'pixels', getDashArray: [2, 2.5], extensions: ext } as any))
    layers.push(new PathLayer({ id: 'fermees', data: roads.closed, pickable: true, getPath: (d: any) => [d.a, d.b], getColor: hexToRgb(MAP.closed, 250), getWidth: 3.2, widthUnits: 'pixels', getDashArray: [3, 2.2], dashJustified: true, extensions: ext, onClick: p.onRoadClick ? (i: PickingInfo) => i.object && p.onRoadClick!((i.object as any).u, (i.object as any).v) : undefined } as any))
  }
  if (p.showFibre && fibreData.length) {
    const cand = fibreData.filter(f => f.statut === 'disponible' && !p.mst?.has(pairKey(f.u, f.v)))
    const ko = fibreData.filter(f => f.statut !== 'disponible')
    const arbre = fibreData.filter(f => f.statut === 'disponible' && p.mst?.has(pairKey(f.u, f.v)))
    const onF = p.onFibreClick ? (i: PickingInfo) => i.object && p.onFibreClick!(i.object as any, (i.object as any).i) : undefined
    layers.push(new LineLayer({ id: 'fibre-cand', data: cand, pickable: true, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: [164, 198, 238, 255], getWidth: 1.4, widthUnits: 'pixels', onClick: onF }))
    layers.push(new PathLayer({ id: 'fibre-ko', data: ko, pickable: true, getPath: (d: any) => [d.a, d.b], getColor: hexToRgb(MAP.closed, 235), getWidth: 2.4, widthUnits: 'pixels', getDashArray: [0.6, 2.6], capRounded: true, extensions: ext } as any))
    if (arbre.length) {
      layers.push(new LineLayer({ id: 'mst-glow', data: arbre, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: hexToRgb(MAP.mst, 45), getWidth: 9, widthUnits: 'pixels' }))
      layers.push(new LineLayer({ id: 'mst', data: arbre, pickable: true, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: hexToRgb(MAP.mst), getWidth: 2.8, widthUnits: 'pixels', onClick: onF }))
    }
  }
  if (p.lines?.length) {
    const data = p.lines.map(l => ({ a: pos.get(l.u), b: pos.get(l.v), c: hexToRgb(l.color), w: l.width ?? 3 })).filter(l => l.a && l.b)
    layers.push(new LineLayer({ id: 'lines', data, getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: (d: any) => d.c, getWidth: (d: any) => d.w, widthUnits: 'pixels', updateTriggers: { getColor: [p.lines], getWidth: [p.lines] } }))
  }
  ;(p.edges ?? []).forEach((e, k) => {
    const a = pos.get(e.u), b = pos.get(e.v)
    if (!a || !b) return
    if (e.glow) layers.push(new LineLayer({ id: `edge-glow-${k}`, data: [{ a, b }], getSourcePosition: (d: any) => d.a, getTargetPosition: (d: any) => d.b, getColor: hexToRgb(e.color, 60), getWidth: (e.width ?? 3) * 3.2, widthUnits: 'pixels' }))
    layers.push(new PathLayer({ id: `edge-${k}`, data: [{ path: [a, b] }], getPath: (d: any) => d.path, getColor: hexToRgb(e.color), getWidth: e.width ?? 3, widthUnits: 'pixels', capRounded: true, getDashArray: e.dashed ? [2.5, 2] : e.dots ? [0.5, 2.5] : [0, 0], extensions: ext } as any))
  })
  ;(p.paths ?? []).forEach((pa, k) => {
    const path = pathData(pa.ids)
    if (path.length < 2) return
    if (pa.glow !== false && !pa.dashed) layers.push(new PathLayer({ id: `path-glow-${k}`, data: [{ path }], getPath: (d: any) => d.path, getColor: hexToRgb(pa.color, 55), getWidth: (pa.width ?? 4) * 3, widthUnits: 'pixels', jointRounded: true, capRounded: true }))
    layers.push(new PathLayer({ id: `path-${k}`, data: [{ path }], getPath: (d: any) => d.path, getColor: hexToRgb(pa.color, pa.dashed ? 220 : 255), getWidth: pa.width ?? 4, widthUnits: 'pixels', jointRounded: true, capRounded: true, getDashArray: pa.dashed ? [1.4, 1.8] : [0, 0], extensions: ext } as any))
    if (pa.animated) {
      const ts: number[] = [0]
      for (let i = 1; i < path.length; i++) ts.push(ts[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
      const total = ts[ts.length - 1] || 1
      const cur = ((t * total) / 3.2) % (total * 1.25)
      layers.push(new TripsLayer({ id: `trip-${k}`, data: [{ path, ts }], getPath: (d: any) => d.path, getTimestamps: (d: any) => d.ts, getColor: [255, 255, 255], getWidth: 2.6, widthUnits: 'pixels', trailLength: total * 0.35, currentTime: cur, capRounded: true, jointRounded: true } as any))
    }
  })
  if (p.cycle && p.cycle.length > 1) {
    layers.push(new PathLayer({ id: 'cycle-glow', data: [{ path: pathData(p.cycle) }], getPath: (d: any) => d.path, getColor: hexToRgb(MAP.cycle, 60), getWidth: 10, widthUnits: 'pixels', jointRounded: true }))
    layers.push(new PathLayer({ id: 'cycle', data: [{ path: pathData(p.cycle) }], getPath: (d: any) => d.path, getColor: hexToRgb(MAP.cycle), getWidth: 3.4, widthUnits: 'pixels', jointRounded: true }))
  }
  // sommets
  const col = (s: SiteP) => hexToRgb(p.nodeColor?.(s) ?? TYPE_COLOR[s.type] ?? '#8a919c')
  const speciaux = p.sites.filter(s => s.type !== 'quartier')
  const many = p.sites.length > 1500
  layers.push(new ScatterplotLayer({ id: 'halo', data: p.plain ? [] : speciaux, getPosition: (d: any) => [d.x, d.y], getFillColor: (d: any) => [...col(d).slice(0, 3), 46] as any, getRadius: many ? 6 : 13, radiusUnits: 'pixels', updateTriggers: { getFillColor: [p.nodeColor] } }))
  if (ringSet.size) {
    const pulse = (t % 1.6) / 1.6
    const ringData = p.sites.filter(s => ringSet.has(s.id))
    layers.push(new ScatterplotLayer({ id: 'rings', data: ringData, getPosition: (d: any) => [d.x, d.y], stroked: true, filled: false, getLineColor: [208, 59, 59, Math.round(230 * (1 - pulse))], lineWidthUnits: 'pixels', getLineWidth: 2, getRadius: 8 + pulse * 13, radiusUnits: 'pixels', updateTriggers: { getLineColor: [t], getRadius: [t] } }))
    layers.push(new ScatterplotLayer({ id: 'rings-fixe', data: ringData, getPosition: (d: any) => [d.x, d.y], stroked: true, filled: false, getLineColor: [208, 59, 59, 255], lineWidthUnits: 'pixels', getLineWidth: 2, getRadius: 9, radiusUnits: 'pixels' }))
  }
  const sel = new Set(p.selected ?? [])
  layers.push(new ScatterplotLayer({
    id: 'sites', data: p.sites, pickable: true,
    getPosition: (d: any) => [d.x, d.y], getFillColor: (d: any) => col(d),
    getRadius: (d: any) => (sel.has(d.id) ? 10 : d.type === 'quartier' ? (many ? 2 : 4.2) : many ? 4.5 : 8.4), radiusUnits: 'pixels',
    stroked: true, getLineColor: (d: any) => (sel.has(d.id) ? INK : [255, 255, 255, 255]), getLineWidth: (d: any) => (sel.has(d.id) ? 2.6 : 1.6), lineWidthUnits: 'pixels',
    onClick: p.onSiteClick ? (i: PickingInfo) => i.object && p.onSiteClick!((i.object as any).id) : undefined,
    updateTriggers: { getFillColor: [p.nodeColor], getRadius: [p.selected], getLineColor: [p.selected], getLineWidth: [p.selected] },
  }))
  if (!many && !p.plain) {
    layers.push(new TextLayer({ id: 'lettres', data: speciaux, getPosition: (d: any) => [d.x, d.y], getText: (d: any) => TYPE_LETTER[d.type], getColor: (d: any) => (p.nodeColor ? [255, 255, 255, 255] : hexToRgb(TYPE_ON[d.type] ?? '#ffffff')), getSize: 10, fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif', characterSet: 'auto', updateTriggers: { getColor: [p.nodeColor] } }))
  }
  if (p.labels?.length) {
    const lab = p.labels.map(id => p.sites.find(s => s.id === id)).filter(Boolean)
    layers.push(new TextLayer({
      id: 'labels', data: lab, getPosition: (d: any) => [d.x, d.y], getText: (d: any) => d.id, getColor: INK, getSize: 13,
      getPixelOffset: [13, -17], getTextAnchor: 'start', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 600,
      background: true, getBackgroundColor: [255, 255, 255, 245], backgroundPadding: [6, 3, 6, 3], getBorderColor: [203, 197, 184, 255], getBorderWidth: 1, characterSet: 'auto',
    } as any))
  }

  const tooltip = (info: PickingInfo) => {
    const o: any = info.object
    if (!o) return null
    const style = { background: '#FFFFFF', border: '1px solid #CBC5B8', borderRadius: '9px', color: '#131A22', fontSize: '13.5px', padding: '8px 11px', fontFamily: 'Inter, system-ui', boxShadow: '0 8px 24px -10px rgba(19,26,34,.35)', lineHeight: '1.45' }
    if (info.layer?.id === 'sites') return { html: `<b style="font-family:JetBrains Mono">${o.id}</b> · ${TYPE_LABEL[o.type] ?? o.type}<br/><span style="color:#5F6773">${o.nom ?? ''}</span>`, style }
    if (info.layer?.id === 'routes' || info.layer?.id === 'fermees') return { html: `Route <b style="font-family:JetBrains Mono">${o.u} ${o.dirs === 2 ? '↔' : '→'} ${o.v}</b>${o.voie ? ` · ${o.voie}` : ''}${o.t !== undefined ? `<br/>${String(o.t).replace('.', ',')} min (période normale)` : ''}${o.ferme ? '<br/><b style="color:#A4261D">fermée</b>' : o.travaux ? '<br/><b style="color:#855000">en travaux (× 1,5)</b>' : ''}`, style }
    if (info.layer?.id?.startsWith('fibre') || info.layer?.id === 'mst') return { html: `Fibre <b style="font-family:JetBrains Mono">${o.u} – ${o.v}</b><br/>${o.cost ?? '?'} k€ · ${o.statut}`, style }
    return null
  }

  const zoomBy = (dz: number) => setViewState((v: any) => ({ ...v, zoom: v.zoom + dz, transitionDuration: 200, transitionInterpolator: new LinearInterpolator(['zoom']) }))

  return (
    <div className="mapwrap" ref={box} style={{ height: p.height ?? 480 }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <defs><pattern id="grille" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#EDEAE3" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="#FBFAF7" /><rect width="100%" height="100%" fill="url(#grille)" />
      </svg>
      {viewState && (
        <DeckGL
          views={new OrthographicView({ id: 'carte', flipY: false } as any)}
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
          controller={{ dragRotate: false, doubleClickZoom: true, scrollZoom: false, touchZoom: true } as any}
          layers={layers}
          getTooltip={tooltip as any}
          getCursor={({ isHovering }: any) => (isHovering ? 'pointer' : 'grab')}
          style={{ position: 'absolute', inset: '0' }}
        />
      )}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button className="mapbtn" onClick={() => zoomBy(0.5)} title="Zoom avant"><Plus size={16} /></button>
        <button className="mapbtn" onClick={() => zoomBy(-0.5)} title="Zoom arrière"><Minus size={16} /></button>
        <button className="mapbtn" onClick={() => setViewState({ ...fit, minZoom: fit.zoom - 3, maxZoom: fit.zoom + 6, transitionDuration: 400, transitionInterpolator: new LinearInterpolator(['target', 'zoom']) })} title="Recadrer"><Maximize2 size={15} /></button>
      </div>
      <div className="absolute right-3 bottom-3 z-10 text-[12px] mu pointer-events-none rounded-md px-2 py-0.5" style={{ background: 'rgba(255,255,255,.85)' }}>glisser : déplacer · Ctrl + molette : zoom</div>
      {p.legend && <div className="mapover legend z-10" style={{ left: 12, bottom: 12, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>{p.legend}</div>}
      {p.overlay}
    </div>
  )
}

/** Marqueur de type tel qu'il apparaît sur la carte (pastille + lettre). */
export function TypeMark({ type, size = 16 }: { type: string; size?: number }) {
  return (
    <span className="inline-grid place-items-center rounded-full shrink-0" style={{ width: size, height: size, background: TYPE_COLOR[type], color: TYPE_ON[type], font: `700 ${Math.round(size * 0.6)}px/1 Inter, system-ui`, boxShadow: '0 0 0 1.5px #fff' }}>
      {type === 'quartier' ? '' : TYPE_LETTER[type]}
    </span>
  )
}

export function TypeLegend() {
  return (
    <div className="legend">
      {Object.keys(TYPE_COLOR).map(t => <span key={t}><TypeMark type={t} size={t === 'quartier' ? 10 : 16} />{TYPE_LABEL[t]}</span>)}
    </div>
  )
}

export const LegendLine = ({ color, label, dashed, dotted, width = 3.5 }: { color: string; label: ReactNode; dashed?: boolean; dotted?: boolean; width?: number }) => (
  <span><i className="ln" style={{ height: width, background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)` : dotted ? `repeating-linear-gradient(90deg, ${color} 0 2.5px, transparent 2.5px 6px)` : color }} />{label}</span>
)

export const LegendDot = ({ color, label, ring }: { color: string; label: ReactNode; ring?: boolean }) => (
  <span><i style={ring ? { background: 'transparent', boxShadow: `inset 0 0 0 2px ${color}` } : { background: color }} />{label}</span>
)
