// Page « Algorithmes en direct » : choisir un algorithme et ses paramètres, puis le voir s'exécuter pas à pas.
// L'algorithme tourne en Python (même code que la CLI) avec le traceur ; cette page ne fait que rejouer ses étapes.
import { Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import NetworkCanvas, { LegendLine, pairKey } from '../components/NetworkCanvas'
import { Callout, Card, PathChips, Pill, Seg, Skeleton } from '../components/ui'
import { LabGraph, StepPlayer, type LabEdge, type LabNode } from '../components/widgets'
import { api } from '../lib/api'
import { fmtMs } from '../lib/format'
import { useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { LabEvent, LabResult, Num } from '../lib/types'
import { ALGO_CPLX, ALGO_LABEL, SERIES, STATUS } from '../theme/tokens'

type AlgoId = 'bfs' | 'dfs' | 'dijkstra' | 'bellman_ford' | 'floyd_warshall' | 'kruskal' | 'prim'
const ALGOS: { id: AlgoId; struct: string; idee: string }[] = [
  { id: 'bfs', struct: 'file FIFO', idee: 'explore le graphe niveau par niveau' },
  { id: 'dfs', struct: 'pile LIFO', idee: 'va le plus loin possible, puis revient' },
  { id: 'dijkstra', struct: 'tas binaire', idee: 'fixe à chaque étape le sommet le plus proche' },
  { id: 'bellman_ford', struct: 'liste des arcs', idee: 'relâche tous les arcs, |V| − 1 passes au plus' },
  { id: 'floyd_warshall', struct: 'matrice |V|×|V|', idee: 'toutes les paires, un pivot k à la fois' },
  { id: 'kruskal', struct: 'Union–Find', idee: 'arêtes par coût croissant, sans cycle' },
  { id: 'prim', struct: 'tas binaire', idee: 'fait grandir un arbre depuis un sommet' },
]
const estFibre = (a: string) => a === 'kruskal' || a === 'prim'
const PETIT = 40 // jusqu'à 40 sommets : vue détaillée (étiquettes, poids) ; au-delà : la carte

type Etat = 'neuf' | 'attente' | 'courant' | 'fait' | 'alerte'
const COUL: Record<Etat, { fill: string; border: string; map: string; l: string }> = {
  neuf: { fill: '#FFFFFF', border: '#A8AFB8', map: '#CFCAC0', l: 'non atteint' },
  attente: { fill: '#FDF1DC', border: '#eda100', map: '#eda100', l: 'en attente' },
  courant: { fill: '#1F4E79', border: '#1F4E79', map: '#131A22', l: 'en cours' },
  fait: { fill: '#DCE9F8', border: '#2a78d6', map: '#2a78d6', l: 'traité' },
  alerte: { fill: '#FBEBE9', border: '#d03b3b', map: '#d03b3b', l: '−∞' },
}
const ARBRE = SERIES[0], EXAMEN = SERIES[1], REJET = STATUS.critical, CHEMIN = SERIES[5]

/** 7 → « 7 », 7.333 → « 7,33 », infinis → ∞. */
const nb = (x: Num | number | undefined | null) => {
  if (x === undefined || x === null) return '—'
  if (x === '+inf') return '∞'
  if (x === '-inf') return '−∞'
  return (x as number).toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace('-', '−')
}

interface Rejeu {
  etat: Map<string, Etat>; val: Map<string, Num | number>; parent: Map<string, string>
  arbre: [string, string][]; arc: { u: string; v: string; ok: boolean } | null
  phrase: string; titre: string; items: string[]; note?: string; total?: number
  matrice?: Num[][] | null; maj?: Set<string>; pivot?: string | null
}

/** Rejoue les k premières étapes de la trace Python. */
function rejouer(r: LabResult, steps: LabEvent[], kDemande: number): Rejeu {
  // une nouvelle trace peut arriver alors que le compteur d'étapes vaut encore celui de l'ancienne
  const k = Math.max(0, Math.min(kDemande, steps.length))
  const ids = r.noeuds.map(n => n.id)
  const etat = new Map<string, Etat>(ids.map(i => [i, 'neuf']))
  const val = new Map<string, Num | number>()
  const parent = new Map<string, string>()
  const arbre: [string, string][] = []
  let arc: Rejeu['arc'] = null
  let phrase = 'Appuyez sur ▶ pour lancer l’algorithme.'
  const src = r.source
  const fin = k >= steps.length
  const res = r.resultat
  const pasDe = (i: number) => steps[i]
  const calc = (e: LabEvent) => `${nb((e.dist as number) - (e.w ?? 0))} + ${nb(e.w)} = ${nb(e.dist)}`
  const out = (o: Partial<Rejeu>): Rejeu => ({ etat, val, parent, arbre, arc, phrase, titre: '', items: [], ...o })

  if (r.algo === 'bfs') {
    const q: string[] = []
    if (src) { q.push(src); etat.set(src, 'attente'); val.set(src, 0) }
    let cur: string | null = null
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type === 'init') { phrase = `File initiale : ${src}, niveau 0.`; arc = null }
      else if (e.type === 'visite') {
        if (cur) etat.set(cur, 'fait')
        cur = e.sommet!
        const j = q.indexOf(cur)
        if (j >= 0) q.splice(j, 1)
        etat.set(cur, 'courant'); arc = null
        phrase = `On retire ${cur} de la file (niveau ${e.niveau}) et on examine ses successeurs.`
      } else if (e.type === 'decouvre') {
        const v = e.sommet!
        etat.set(v, 'attente'); val.set(v, e.niveau!); parent.set(v, e.depuis!); arbre.push([e.depuis!, v]); q.push(v)
        arc = { u: e.depuis!, v, ok: true }
        phrase = `${e.depuis} → ${v} : sommet jamais vu → niveau ${e.niveau}, ajouté en fin de file.`
      }
    }
    if (fin && cur) etat.set(cur, 'fait')
    if (fin) phrase = `Parcours terminé : ${res.atteints} sommet(s) atteint(s) depuis ${src}.`
    return out({ titre: 'File (FIFO)', items: q, note: 'le premier à gauche sort en premier' })
  }

  if (r.algo === 'dfs') {
    let pile: string[] = []
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type === 'visite') {
        const v = e.sommet!
        val.set(v, e.niveau!)
        if (e.depuis) { parent.set(v, e.depuis); arbre.push([e.depuis, v]); arc = { u: e.depuis, v, ok: true } } else arc = null
        pile = e.pile ?? [...pile, v]
        phrase = e.depuis ? `${e.depuis} → ${v} : sommet non visité → on l’empile (profondeur ${e.niveau}).` : `Départ : on empile ${v}.`
      } else if (e.type === 'termine') {
        etat.set(e.sommet!, 'fait'); pile = e.pile ?? pile.slice(0, -1); arc = null
        phrase = `${e.sommet} n’a plus de successeur non visité → on le dépile.`
      }
    }
    pile.forEach(x => etat.set(x, 'attente'))
    if (pile.length) etat.set(pile[pile.length - 1], 'courant')
    if (fin) phrase = `Parcours terminé : ${res.atteints} sommet(s) atteint(s) depuis ${src}.`
    return out({ titre: 'Pile (LIFO)', items: [...pile].reverse(), note: 'le sommet de pile, à gauche, sort en premier' })
  }

  if (r.algo === 'dijkstra') {
    ids.forEach(i => val.set(i, '+inf'))
    const tas = new Map<string, number>()
    if (src) { val.set(src, 0); tas.set(src, 0); etat.set(src, 'attente') }
    let cur: string | null = null, fixes = 0
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type === 'fixe') {
        if (cur) etat.set(cur, 'fait')
        cur = e.sommet!; fixes++; tas.delete(cur); etat.set(cur, 'courant'); arc = null
        phrase = `On extrait du tas ${cur}, le plus proche (d = ${nb(e.dist)}) : sa distance est définitive.`
      } else if (e.type === 'relache') {
        const v = e.sommet!
        val.set(v, e.dist!); parent.set(v, e.depuis!); tas.set(v, e.dist as number)
        if (etat.get(v) !== 'fait') etat.set(v, 'attente')
        arc = { u: e.depuis!, v, ok: true }
        phrase = `${e.depuis} → ${v} : ${calc(e)} < ${nb(e.ancien)} → d(${v}) = ${nb(e.dist)}.`
      } else if (e.type === 'ignore') {
        arc = { u: e.depuis!, v: e.sommet!, ok: false }
        phrase = `${e.depuis} → ${e.sommet} : ${calc(e)} ≥ ${nb(e.ancien)} → pas d’amélioration.`
      }
    }
    if (fin && cur) etat.set(cur, 'fait')
    if (fin) phrase = `Terminé : ${fixes} sommet(s) fixé(s) ; chaque distance est minimale.`
    parent.forEach((u, v) => arbre.push([u, v]))
    return out({ titre: 'Tas binaire', items: [...tas].sort((a, b) => a[1] - b[1]).map(([x, d]) => `${x} · ${nb(d)}`), note: 'le minimum, à gauche, sort en premier' })
  }

  if (r.algo === 'bellman_ford') {
    ids.forEach(i => val.set(i, '+inf'))
    if (src) val.set(src, 0)
    let passe = 0, cur: string | null = null, maj = new Set<string>(), relax: string[] = []
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type === 'passe') { passe = e.passe!; maj = new Set(); cur = null; arc = null; phrase = `Passe ${passe} : on relâche, dans l’ordre, tous les arcs du graphe.` }
      else if (e.type === 'relache') {
        const v = e.sommet!
        val.set(v, e.dist!); parent.set(v, e.depuis!); maj.add(v); cur = v
        arc = { u: e.depuis!, v, ok: true }
        phrase = `Passe ${e.passe} · ${e.depuis} → ${v} : ${calc(e)} < ${nb(e.ancien)} → d(${v}) = ${nb(e.dist)}.`
      } else if (e.type === 'controle') {
        relax = e.relaxables ?? []; cur = null; arc = null
        phrase = relax.length ? `Contrôle : ${relax.join(', ')} encore améliorable(s) après |V| − 1 passes → circuit absorbant, distances −∞.` : `Passe ${e.passes} sans amélioration : arrêt anticipé, distances définitives.`
      }
    }
    ids.forEach(i => { if (val.get(i) !== '+inf') etat.set(i, 'fait') })
    maj.forEach(x => etat.set(x, 'attente'))
    if (cur) etat.set(cur, 'courant')
    if (fin) Object.entries(res.dist ?? {}).forEach(([x, d]) => { val.set(x, d); if (d === '-inf') etat.set(x, 'alerte') })
    relax.forEach(x => etat.set(x, 'alerte'))
    parent.forEach((u, v) => arbre.push([u, v]))
    return out({ titre: passe ? `Passe ${passe} (au plus ${ids.length - 1})` : 'Passes', items: [...maj].map(x => `${x} · ${nb(val.get(x))}`), note: 'sommets améliorés pendant cette passe' })
  }

  if (r.algo === 'floyd_warshall') {
    let matrice: Num[][] | null = null, maj = new Set<string>(), pivot: string | null = null, nPiv = 0
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type === 'init') { matrice = e.matrice ?? null; phrase = 'Matrice initiale : poids des arcs directs, 0 sur la diagonale, ∞ ailleurs.' }
      else if (e.type === 'pivot') {
        if (pivot) etat.set(pivot, 'fait')
        pivot = e.pivot!; nPiv++; etat.set(pivot, 'courant'); matrice = e.matrice ?? matrice
        maj = new Set((e.maj ?? []).map(([a, b]) => `${a},${b}`))
        phrase = `Pivot k = ${pivot} (${nPiv}/${ids.length}) : d[i][j] ← min(d[i][j], d[i][${pivot}] + d[${pivot}][j])${e.maj ? ` — ${e.maj.length} case(s) améliorée(s)` : ''}.`
      }
    }
    if (fin && pivot) etat.set(pivot, 'fait')
    const si = src ? ids.indexOf(src) : -1
    if (matrice && si >= 0) ids.forEach((x, j) => val.set(x, matrice![si][j]))
    if (fin) {
      Object.entries(res.dist ?? {}).forEach(([x, d]) => { val.set(x, d); if (d === '-inf') etat.set(x, 'alerte') })
      phrase = res.circuit_absorbant ? 'Terminé : d[k][k] < 0 pour un sommet k → circuit absorbant, distances −∞.' : 'Terminé : la matrice contient la plus courte distance de chaque paire.'
    }
    return out({ titre: `Pivots traités : ${nPiv} / ${ids.length}`, items: [], matrice, maj, pivot })
  }

  if (r.algo === 'kruskal') {
    const tri = [...r.aretes].sort((a, b) => a.w - b.w || a.id - b.id)
    let exam = 0, total = 0, comp: number | null = ids.length
    for (let i = 0; i < k; i++) {
      const e = pasDe(i)
      if (e.type !== 'arete') continue
      exam++
      arc = { u: e.u!, v: e.v!, ok: !!e.acceptee }
      if (e.acceptee) { arbre.push([e.u!, e.v!]); total += e.cout ?? 0 }
      comp = e.composantes ?? comp
      phrase = e.acceptee ? `${e.u}–${e.v} (${nb(e.cout)} k€) relie deux composantes différentes → acceptée.` : `${e.u}–${e.v} (${nb(e.cout)} k€) relierait deux sommets déjà connectés (cycle) → rejetée.`
    }
    arbre.forEach(([a, b]) => { etat.set(a, 'fait'); etat.set(b, 'fait') })
    if (arc && !fin) { etat.set(arc.u, 'courant'); etat.set(arc.v, 'courant') }
    if (fin) phrase = `Terminé : ${arbre.length} tronçons retenus, coût total ${nb(total)} k€.`
    return out({ titre: 'Prochaines arêtes (triées par coût)', items: tri.slice(exam, exam + 10).map(a => `${a.u}–${a.v} · ${nb(a.w)}`), note: comp !== null ? `${comp} composante(s) dans l’Union–Find` : undefined, total })
  }

  // Prim
  const dansArbre = new Set<string>()
  let total = 0, tas = 0, cur: string | null = null
  for (let i = 0; i < k; i++) {
    const e = pasDe(i)
    if (e.type === 'racine') { dansArbre.add(e.sommet!); cur = e.sommet!; arc = null; phrase = `Nouvel arbre à partir de ${e.sommet} : ses arêtes entrent dans le tas.` }
    else if (e.type === 'arete') {
      dansArbre.add(e.sommet!); cur = e.sommet!; arbre.push([e.u!, e.v!]); total += e.cout ?? 0; tas = e.tas ?? tas
      arc = { u: e.u!, v: e.v!, ok: true }
      phrase = `Arête la moins chère du tas : ${e.u}–${e.v} (${nb(e.cout)} k€) → ${e.sommet} rejoint l’arbre.`
    } else if (e.type === 'ignore') {
      tas = e.tas ?? tas; arc = { u: e.u!, v: e.v!, ok: false }
      phrase = `${e.u}–${e.v} (${nb(e.cout)} k€) sort du tas, mais ${e.sommet} est déjà dans l’arbre → ignorée.`
    }
  }
  const front = r.aretes.filter(a => dansArbre.has(a.u) !== dansArbre.has(a.v)).sort((a, b) => a.w - b.w || a.id - b.id)
  dansArbre.forEach(x => etat.set(x, 'fait'))
  front.forEach(a => { const x = dansArbre.has(a.u) ? a.v : a.u; if (etat.get(x) === 'neuf') etat.set(x, 'attente') })
  if (cur && !fin) etat.set(cur, 'courant')
  if (fin) phrase = `Terminé : ${arbre.length} tronçons retenus, coût total ${nb(total)} k€.`
  return out({ titre: 'Arêtes candidates (frontière)', items: front.slice(0, 10).map(a => `${a.u}–${a.v} · ${nb(a.w)}`), note: `${dansArbre.size} sommet(s) dans l’arbre · ${tas} entrée(s) dans le tas`, total })
}

export default function Lab() {
  const s = useStore()
  const algo = (s.param('algo') ?? 'dijkstra') as AlgoId
  const src = s.param('src'), dst = s.param('dst')
  const fibre = estFibre(algo)
  const run = useApi(() => api.lab({ dataset: s.dataset, scenario: s.scenario, periode: s.periode, algo, source: src, cible: fibre ? null : dst }), [s.dataset, s.scenario, s.periode, algo, src, dst], { silent: true })
  const [step, setStep] = useState(0)
  const [auto, setAuto] = useState(0)
  const premier = useRef(true)
  // nouveau jeu : la source et la cible choisies n'y existent pas forcément
  useEffect(() => {
    if (premier.current) { premier.current = false; return }
    s.setParam('src', null); s.setParam('dst', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.dataset])

  const r = run.data
  useLastCalc(ALGO_LABEL[algo] ?? algo, r?.temps_ms, [r])
  const steps = useMemo(() => (r ? r.events.filter(e => !(r.algo === 'bfs' && e.type === 'file')) : []), [r])
  useEffect(() => { if (r) { setStep(0); setAuto(a => a + 1) } }, [r])
  const rej = useMemo(() => (r ? rejouer(r, steps, step) : null), [r, steps, step])
  const petit = (r?.noeuds.length ?? 0) <= PETIT
  const fin = !!r && step >= steps.length && steps.length > 0
  const def = ALGOS.find(a => a.id === algo) ?? ALGOS[2]
  const noeuds = r?.noeuds ?? []

  const pos = useMemo(() => {
    if (!r) return new Map<string, [number, number]>()
    const xs = r.noeuds.map(n => n.x), ys = r.noeuds.map(n => n.y)
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    return new Map(r.noeuds.map(n => [n.id, [((n.x - x0) / (x1 - x0 || 1)) * 560, ((y1 - n.y) / (y1 - y0 || 1)) * 320] as [number, number]]))
  }, [r])

  const vue = useMemo(() => {
    if (!r || !rej) return null
    const cle = (u: string, v: string) => (r.oriente ? `${u}>${v}` : pairKey(u, v))
    const arbreSet = new Set(rej.arbre.map(([u, v]) => cle(u, v)))
    const chemin = new Set<string>()
    const c = fin ? r.chemin ?? [] : []
    for (let i = 0; i + 1 < c.length; i++) chemin.add(`${c[i]}>${c[i + 1]}`)
    const arcCle = rej.arc ? cle(rej.arc.u, rej.arc.v) : null
    const nodes: LabNode[] = r.noeuds.map(n => {
      const e = rej.etat.get(n.id) ?? 'neuf'
      const v = rej.val.get(n.id)
      const p = pos.get(n.id) ?? [0, 0]
      return { id: n.id, x: p[0], y: p[1], label: fibre || v === undefined ? undefined : nb(v), fill: COUL[e].fill, color: COUL[e].border, dark: e === 'courant', source: n.id === r.source }
    })
    const edges: LabEdge[] = r.aretes.map(a => {
      const k = cle(a.u, a.v)
      const cur = arcCle === k
      const surChemin = chemin.has(`${a.u}>${a.v}`)
      const dansArbre = arbreSet.has(k)
      return {
        id: `a${a.id}`, source: a.u, target: a.v, label: nb(a.w), neg: a.w < 0,
        color: surChemin ? CHEMIN : cur ? (rej.arc!.ok ? EXAMEN : REJET) : dansArbre ? ARBRE : undefined,
        width: surChemin ? 5 : cur ? 4.6 : dansArbre ? 3.4 : undefined,
        dashed: cur && !rej.arc!.ok,
      }
    })
    const courant = [...rej.etat].filter(([, e]) => e === 'courant').map(([x]) => x)
    return { nodes, edges, courant }
  }, [r, rej, pos, fin, fibre])

  const majCle = (x: string | null | undefined) => x ?? ''
  const graine = (d: string, l: string) => <button key={d} className={s.dataset === d ? 'on' : ''} onClick={() => s.setDataset(d)}>{l}</button>
  // pendant l'exécution ce sont des estimations (elles peuvent encore baisser, voire valoir −∞ à la fin)
  const etiquetteVal = algo === 'bfs' ? 'niveau' : algo === 'dfs' ? 'profondeur' : fin ? 'distance' : 'estimation'

  return (
    <div className="grid gap-5">
      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="field">Algorithme
            <Seg value={algo} onChange={a => s.setParam('algo', a)} options={ALGOS.map(a => ({ v: a.id, l: ALGO_LABEL[a.id] }))} />
          </div>
          <div className="field">Graphe
            <div className="seg">{graine('mini', 'Petit · 8 sites')}{graine('novapolis', 'Novapolis · 150')}{graine('negatif_accessible', 'Poids négatifs')}</div>
          </div>
          {(!fibre || algo === 'prim') && !run.error && (
            <div className="field">{algo === 'prim' ? 'Départ' : 'Source'}
              <select className="inp mono" value={majCle(r?.source)} onChange={e => s.setParam('src', e.target.value)}>{noeuds.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}</select>
            </div>
          )}
          {!fibre && !run.error && (
            <div className="field">Cible (chemin)
              <select className="inp mono" value={majCle(dst)} onChange={e => s.setParam('dst', e.target.value || null)}><option value="">— aucune —</option>{noeuds.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}</select>
            </div>
          )}
          <button className="btn btn-pri ml-auto" disabled={!r} onClick={() => { setStep(0); setAuto(a => a + 1) }}><Play size={14} fill="currentColor" />Relancer</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[14.5px] text-ink2">
          <b className="text-ink">{ALGO_LABEL[algo]}</b>— {def.idee}
          <Pill kind="in"><span className="math">{ALGO_CPLX[algo]}</span></Pill><Pill>{def.struct}</Pill>
          <Pill kind={fibre ? 'cy' : 'mu'}>{fibre ? 'réseau de fibre · non orienté' : 'réseau routier · orienté'}</Pill>
        </div>
      </Card>

      {run.error && (
        <Callout kind="warn" title="Impossible de lancer cet algorithme sur ce graphe">
          {run.error}
          <div className="flex gap-2 mt-2.5">{s.dataset !== 'mini' && <button className="btn btn-gh btn-sm" onClick={() => s.setDataset('mini')}>Petit graphe</button>}{algo === 'dijkstra' && <button className="btn btn-gh btn-sm" onClick={() => s.setParam('algo', 'bellman_ford')}>Essayer Bellman–Ford</button>}</div>
        </Callout>
      )}

      {!run.error && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Card className="min-w-0">
            {!r || !rej || !vue ? <Skeleton h={420} /> : (
              <>
                {petit ? (
                  <LabGraph nodes={vue.nodes} edges={vue.edges} directed={r.oriente} height={Math.max(360, Math.min(560, window.innerHeight - 430))} />
                ) : (
                  <NetworkCanvas sites={r.noeuds} height="clamp(360px, calc(100vh - 430px), 600px)"
                    routes={fibre ? undefined : r.aretes.map(a => ({ u: a.u, v: a.v, statut: 'ouvert' }))}
                    fibre={fibre ? r.aretes.map(a => ({ u: a.u, v: a.v, cost: a.w, statut: 'disponible' })) : undefined} showFibre={fibre}
                    mst={fibre ? new Set(rej.arbre.map(([u, v]) => pairKey(u, v))) : undefined}
                    nodeColor={x => COUL[rej.etat.get(x.id) ?? 'neuf'].map}
                    lines={[...(fibre ? [] : rej.arbre.map(([u, v]) => ({ u, v, color: ARBRE, width: 2.6 }))), ...(rej.arc ? [{ u: rej.arc.u, v: rej.arc.v, color: rej.arc.ok ? EXAMEN : REJET, width: 5 }] : [])]}
                    paths={fin && r.chemin ? [{ ids: r.chemin, color: CHEMIN, animated: true }] : []}
                    labels={[r.source, r.cible, ...vue.courant].filter((x): x is string => !!x)}
                    rings={[...rej.etat].filter(([, e]) => e === 'alerte').map(([x]) => x)} />
                )}
                <div className="legend mt-3">
                  {(['neuf', 'attente', 'courant', 'fait'] as Etat[]).map(e => <span key={e}><i style={{ background: COUL[e].fill, boxShadow: `inset 0 0 0 2px ${COUL[e].border}` }} />{COUL[e].l}</span>)}
                  <LegendLine color={ARBRE} label={fibre ? 'arête retenue' : 'arbre (parents)'} />
                  <LegendLine color={EXAMEN} label="arête examinée" />
                  <LegendLine color={REJET} label="rejetée" dashed />
                  {!fibre && <LegendLine color={CHEMIN} label="chemin final" />}
                </div>
                <div className="mt-3 rounded-[10px] px-4 py-3 text-[16px] leading-snug flex gap-3 items-baseline" style={{ background: 'var(--navy-soft)', borderLeft: '3px solid var(--navy)', minHeight: 52 }}>
                  <span className="lbl shrink-0">{fin ? 'fin' : `étape ${step}`}</span><span>{rej.phrase}</span>
                </div>
                <div className="mt-3">
                  <StepPlayer total={steps.length} step={step} onStep={setStep} label={`${step} / ${steps.length}`} speeds={[0.5, 1, 2, 4, 8, 16, 32]} vitesseInit={petit ? 1 : 16} autoplay={auto} />
                </div>
              </>
            )}
          </Card>

          <div className="grid gap-5 content-start">
            {r && rej && (
              <Card title={rej.titre} sub={rej.note}>
                {rej.items.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {rej.items.slice(0, 24).map((x, i) => <span key={i} className="chip" style={i === 0 ? { borderColor: 'var(--navy)', boxShadow: 'inset 0 0 0 1px var(--navy)' } : undefined}>{x}</span>)}
                    {rej.items.length > 24 && <span className="mu text-[13px]">… +{rej.items.length - 24}</span>}
                  </div>
                ) : <span className="mu">{algo === 'floyd_warshall' ? (rej.matrice ? 'voir la matrice ci-dessous' : 'matrice affichée jusqu’à 15 sommets') : 'vide'}</span>}
                {rej.total !== undefined && <div className="mt-3 text-[14.5px]">Coût cumulé : <b>{nb(rej.total)} k€</b></div>}
              </Card>
            )}

            {r && rej && algo === 'floyd_warshall' && rej.matrice && (
              <Card title="Matrice d[i][j]" sub="pivot : ligne et colonne bleues · cases améliorées en orange">
                <div className="tbl-wrap">
                  <table className="tbl compact" style={{ fontSize: 13 }}>
                    <thead><tr><th style={{ padding: '6px' }} />{noeuds.map(n => <th key={n.id} className="c" style={{ padding: '6px', color: n.id === rej.pivot ? 'var(--navy)' : undefined }}>{n.id}</th>)}</tr></thead>
                    <tbody>{noeuds.map((n, a) => (
                      <tr key={n.id}><td className="mono font-semibold" style={{ padding: '5px 6px', color: n.id === rej.pivot ? 'var(--navy)' : undefined }}>{n.id}</td>
                        {noeuds.map((m, b) => {
                          const maj = rej.maj?.has(`${a},${b}`)
                          return <td key={m.id} className="c" style={{ padding: '5px 6px', background: maj ? '#FDF1DC' : n.id === rej.pivot || m.id === rej.pivot ? 'var(--navy-soft)' : undefined, fontWeight: maj ? 700 : 400 }}>{nb(rej.matrice![a][b])}</td>
                        })}</tr>
                    ))}</tbody>
                  </table>
                </div>
              </Card>
            )}

            {r && rej && !fibre && petit && algo !== 'floyd_warshall' && (
              <Card title={algo === 'bfs' || algo === 'dfs' ? 'Sommets' : `Distances depuis ${r.source}`}>
                <table className="tbl compact">
                  <thead><tr><th>Sommet</th><th>État</th><th className="r">{etiquetteVal}</th><th>Parent</th></tr></thead>
                  <tbody>{noeuds.map(n => {
                    const e = rej.etat.get(n.id) ?? 'neuf'
                    return (
                      <tr key={n.id} className={e === 'courant' ? 'sel' : ''}>
                        <td className="mono font-semibold">{n.id}</td>
                        <td><span className="inline-flex items-center gap-2"><i className="dot" style={{ background: COUL[e].fill, boxShadow: `inset 0 0 0 2px ${COUL[e].border}` }} />{COUL[e].l}</span></td>
                        <td className="r font-semibold" style={{ color: rej.val.get(n.id) === '-inf' ? 'var(--ko)' : undefined }}>{nb(rej.val.get(n.id))}</td>
                        <td className="mono">{rej.parent.get(n.id) ?? '—'}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </Card>
            )}

            {r && (
              <Card title="Résultat">
                <table className="tbl kv"><tbody>
                  <tr><td>Temps d’exécution (sans traçage)</td><td className="r mono">{fmtMs(r.temps_ms)}</td></tr>
                  <tr><td>Étapes enregistrées</td><td className="r">{steps.length}{r.tronque ? ' (tronqué)' : ''}</td></tr>
                  {fibre && <tr><td>Coût total</td><td className="r font-semibold">{nb(r.resultat.cout)} k€</td></tr>}
                  {fibre && <tr><td>Tronçons · composantes</td><td className="r">{r.resultat.aretes?.length} · {r.resultat.composantes}</td></tr>}
                  {!fibre && r.cible && <tr><td>{algo === 'bfs' || algo === 'dfs' ? `Arcs jusqu’à ${r.cible}` : `Distance jusqu’à ${r.cible}`}</td><td className="r font-semibold">{r.chemin ? nb(r.cout_chemin) : r.resultat.circuit_absorbant ? '−∞' : '∞'}</td></tr>}
                </tbody></table>
                {!fibre && r.cible && r.chemin && <div className="mt-3"><PathChips path={r.chemin} max={10} /></div>}
                {r.resultat.circuit_absorbant && <div className="banner ko mt-3 text-[14px]">Circuit absorbant atteignable : distances −∞, aucun chemin fini.</div>}
                {!fibre && !r.cible && <div className="caption mt-2">Choisissez une cible pour reconstruire le chemin.</div>}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
