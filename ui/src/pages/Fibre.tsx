// Page 6 — Réseau de fibre (M4) : Kruskal vs Prim, égalités de coût, pas à pas + Union–Find, étude de panne.
import { RotateCcw, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendLine, pairKey } from '../components/NetworkCanvas'
import { Card, ErrorBox, Pill, Seg, Skeleton } from '../components/ui'
import { LabGraph, StepPlayer } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtInt, fmtMs } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { PanneResult } from '../lib/types'
import { TYPE_COLOR } from '../theme/tokens'

export default function Fibre() {
  const s = useStore()
  const g = useGraph()
  const mst = useApi(() => api.mst(s.dataset, s.scenario, 'both', true), [s.dataset, s.scenario])
  const [algo, setAlgo] = useState<'kruskal' | 'prim'>('kruskal')
  const [step, setStep] = useState<number | null>(null)
  const [panne, setPanne] = useState<PanneResult | null>(null)
  useLastCalc(algo === 'kruskal' ? 'Kruskal' : 'Prim', mst.data?.[algo]?.temps_ms, [mst.data, algo])
  useEffect(() => { setStep(null); setPanne(null) }, [mst.data, algo])

  const couper = async (edge: string) => {
    try { setPanne(await api.panne(s.dataset, edge, algo, s.scenario)) } catch (e: any) { s.toast('error', e.message) }
  }
  // mode démo : panne automatique du tronçon déclaré dans le scénario « panne_fibre »
  useEffect(() => {
    if (s.param('panne') !== 'auto' || !mst.data) return
    api.table(s.dataset, 'scenarios.csv', 0, 1000).then(t => {
      const i = t.entete.indexOf('action')
      const row = t.lignes.find(l => l.valeurs[i] === 'panne')
      const arbre = mst.data!.kruskal!.aretes
      const cand = row ? `${row.valeurs[t.entete.indexOf('u')]}-${row.valeurs[t.entete.indexOf('v')]}` : arbre[Math.floor(arbre.length / 2)]?.label
      if (cand) couper(cand)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.param('panne'), mst.data])

  const m = mst.data
  const res = m?.[algo]
  const events = res?.trace?.events ?? []
  const ids = useMemo(() => g.data?.sites.map(x => x.id) ?? [], [g.data])
  const accepted = useMemo(() => {
    if (!res) return new Set<string>()
    if (step === null) return new Set(res.aretes.map(e => pairKey(e.u, e.v)))
    const set = new Set<string>()
    events.slice(0, step).forEach(e => { if (e.acceptee && e.label) { const [u, v] = splitLabel(e.label, ids); set.add(pairKey(u, v)) } })
    return set
  }, [res, step, events, ids])

  const compU = useMemo(() => new Set(panne?.composante_u ?? []), [panne])
  const nodeColor = panne ? (x: any) => (x.type !== 'quartier' ? TYPE_COLOR[x.type] : compU.has(x.id) ? '#2EE6D6' : '#A78BFA') : undefined
  const edges = panne ? [
    { u: panne.coupee.u, v: panne.coupee.v, color: '#FF4D4D', dashed: true, width: 3 },
    ...(panne.raccordement ? [{ u: panne.raccordement.u, v: panne.raccordement.v, color: '#3DDC97', dashed: true, glow: true, width: 3.4 }] : []),
  ] : []
  const mstMap = panne ? new Set([...accepted].filter(k => k !== pairKey(panne.coupee.u, panne.coupee.v))) : accepted
  const rings = (m?.non_raccordes ?? []).flat().slice(0, 300)
  const cur = step !== null && step > 0 ? events[step - 1] : null

  // forêt Union–Find à l'étape courante (arbre contenant l'arête examinée)
  const foret = useMemo(() => {
    if (algo !== 'kruskal' || !cur?.uf || cur.u === undefined) return null
    const uf = cur.uf
    const racine = (x: number) => { while (uf[x] !== x) x = uf[x]; return x }
    const r = new Set([racine(cur.u!), racine(cur.v!)])
    const membres = uf.map((_, i) => i).filter(i => r.has(racine(i))).slice(0, 70)
    const set = new Set(membres)
    return {
      nodes: membres.map(i => ({ id: ids[i], x: 0, y: 0, color: r.has(i) && uf[i] === i ? '#FFB547' : i === cur.u || i === cur.v ? '#FF5468' : '#2EE6D6' })),
      edges: membres.filter(i => uf[i] !== i && set.has(uf[i])).map(i => ({ id: `p${i}`, source: ids[uf[i]], target: ids[i], color: '#2A3A60' })),
    }
  }, [cur, algo, ids])

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const fenetre = step === null ? events.slice(0, 12) : events.slice(Math.max(0, step - 6), Math.max(0, step - 6) + 12)
  const base = step === null ? 0 : Math.max(0, step - 6)

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 370px' }}>
      <div className="grid gap-3.5 content-start">
        <Card title={<>Arbre couvrant minimal <Pill kind="cy">{algo === 'kruskal' ? 'Kruskal' : 'Prim'}</Pill>{(m?.non_raccordes.length ?? 0) > 0 && <Pill kind="am">forêt : {m!.composantes.length} composantes</Pill>}</>}
          right={<><span className="legend"><LegendLine color="#2EE6D6" label="ACM" /><LegendLine color="#16384a" label="candidat" /><LegendLine color="#FF4D4D" label="interdit / panne" dashed />{panne && <LegendLine color="#3DDC97" label="raccordement" dashed />}</span>
            <Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'kruskal', l: 'Kruskal' }, { v: 'prim', l: 'Prim' }]} /></>}>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre dimRoads mst={mstMap} height={500}
              nodeColor={nodeColor} edges={edges} rings={rings} labels={panne ? [panne.coupee.u, panne.coupee.v, ...(panne.raccordement ? [panne.raccordement.u, panne.raccordement.v] : [])] : []}
              onFibreClick={f => accepted.has(pairKey(f.u, f.v)) ? couper(`${f.u}-${f.v}`) : s.toast('info', `${f.u}–${f.v} n'est pas dans l'arbre : cliquez un tronçon cyan`)}
              overlay={res && <div className="mapover legend" style={{ left: 10, bottom: 10, gap: 16 }}>
                <span><b className="mono text-white text-[14px]">{fmtInt(res.cout)} k€</b> coût total</span><span><b className="mono text-white">{res.nb_aretes}</b> tronçons</span>
                <span><b className="mono text-white">{res.composantes}</b> composante(s)</span><span><b className="mono" style={{ color: '#FF7A88' }}>{m?.exclus.length}</b> exclus</span></div>} />
          ) : <Skeleton h={500} />}
          {res?.trace && <div className="mt-3"><StepPlayer total={events.length} step={step ?? events.length} onStep={setStep} label={`${step ?? events.length} / ${events.length} ${algo === 'kruskal' ? 'arêtes examinées' : 'arêtes ajoutées'}`} /></div>}
        </Card>
        {foret && (
          <Card title={<>Forêt Union–Find <span className="mu font-medium">· arbre(s) contenant {cur?.label}</span></>} right={<span className="legend"><span><i style={{ background: '#FFB547' }} />racine</span><span><i style={{ background: '#FF5468' }} />extrémités</span></span>}>
            <LabGraph nodes={foret.nodes} edges={foret.edges} layout="breadthfirst" height={220} />
            <div className="mu2 text-[11px] mt-1.5">Compression de chemin + union par rang : les arbres restent très plats (hauteur ≤ log n).</div>
          </Card>
        )}
      </div>

      <div className="grid gap-3.5 content-start">
        <Card title="Kruskal vs Prim" right={m?.cout_identique !== undefined && (m.cout_identique ? <Pill kind="ok">✓ coût identique</Pill> : <Pill kind="ko">✗ coûts différents</Pill>)}>
          {!m ? <Skeleton h={120} /> : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(['kruskal', 'prim'] as const).map(a => (
                  <button key={a} className="fileC text-left" style={algo === a ? { borderColor: '#17585a' } : undefined} onClick={() => setAlgo(a)}>
                    <b>{a === 'kruskal' ? 'Kruskal' : 'Prim'}</b><div className="mu2 text-[10.5px]">{a === 'kruskal' ? 'tri + Union–Find' : 'tas binaire'}</div>
                    <div className="big mt-1.5 text-[18px]">{fmtInt(m[a]?.cout)}<small className="mu text-[11px]"> k€</small></div>
                    <div className="mono mu text-[11px]">{m[a]?.nb_aretes} arêtes · <span style={{ color: '#2EE6D6' }}>{fmtMs(m[a]?.temps_ms)}</span></div>
                  </button>
                ))}
              </div>
              <div className="callout mt-2.5">
                {m.meme_ensemble ? <>Les deux algorithmes retiennent <b>exactement les mêmes tronçons</b>.</> : <><b>{m.diff_kruskal?.length} tronçon(s) différent(s)</b> à coût total égal : en cas d'égalité de coûts, Kruskal départage par l'ordre du fichier, Prim par l'ordre d'insertion dans le tas.</>}
                {m.egalites.echange && <> Plusieurs ACM existent : remplacer <span className="chip">{m.egalites.echange.retirer.label}</span> par <span className="chip">{m.egalites.echange.ajouter.label}</span> (même coût {fmt(m.egalites.echange.cout, 0)} k€) donne un autre arbre de même coût — l'arête ajoutée a le même poids que l'arête maximale du cycle qu'elle crée.</>}
                {m.egalites.unique && <> L'ACM est <b>unique</b> (aucun échange de même coût).</>}
              </div>
              {!m.meme_ensemble && (
                <div className="mt-2 text-[11.5px]">{m.diff_kruskal?.slice(0, 5).map((a, k) => (
                  <div key={k} className="flex items-center gap-2 py-0.5"><span className="chip">{a.label} · {fmt(a.cost, 0)}</span><span className="mu2">↔</span><span className="chip">{m.diff_prim?.[k]?.label} · {fmt(m.diff_prim?.[k]?.cost ?? null, 0)}</span></div>
                ))}</div>
              )}
            </>
          )}
        </Card>

        <Card title={<>Étapes {algo === 'kruskal' ? 'Kruskal' : 'Prim'} <span className="mu font-medium">· {algo === 'kruskal' ? 'arêtes triées' : 'tas / frontière'}</span></>}>
          {fenetre.map((e, k) => (
            <div key={k} className={`step ${step !== null && base + k === step - 1 ? 'cur' : ''}`}>
              <span className="mono mu2">{base + k + 1}</span>
              <span className="mono">{e.label} <span className="mu">{fmt(e.cout ?? null, 0)} k€</span>{algo === 'prim' && e.tas !== undefined && <span className="mu2"> · tas {e.tas}</span>}{e.type === 'racine' && <span className="mu"> nouvelle racine</span>}</span>
              {e.type === 'racine' ? <span className="mu2">—</span> : e.acceptee ? <span style={{ color: '#3DDC97' }}>✓ ajoutée</span> : <span style={{ color: '#FF7A88' }}>✗ cycle</span>}
            </div>
          ))}
          <div className="mu2 text-[11px] mt-1.5">{algo === 'kruskal' ? 'Union–Find : compression de chemin + union par rang' : 'Tas binaire (heapq), départage des égalités par ordre d’insertion'}</div>
        </Card>

        <Card title={<><Scissors size={14} /> Étude de panne</>} glow={panne ? '#1b5a45' : undefined}>
          {panne ? (
            <>
              <div className="ba">
                <div><div className="lbl">Tronçon coupé</div><div className="mono font-semibold" style={{ color: '#FF7A88' }}>{panne.coupee.label}</div><div className="mono mu text-[11px]">{fmt(panne.coupee.cost, 0)} k€</div></div>
                <div className="text-center mu2">→</div>
                <div><div className="lbl">Raccordement</div>{panne.raccordement ? <><div className="mono font-semibold" style={{ color: '#3DDC97' }}>{panne.raccordement.label}</div><div className="mono mu text-[11px]">{fmt(panne.raccordement.cost, 0)} k€</div></> : <div className="mono" style={{ color: '#FF7A88' }}>aucun disponible</div>}</div>
              </div>
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <Pill kind="am">Δ coût {panne.delta >= 0 ? '+' : ''}{fmt(panne.delta, 0)} k€</Pill><Pill kind="cy">nouveau total {fmtInt(panne.nouveau_cout)} k€</Pill>
                <Pill kind={panne.reconnecte ? 'ok' : 'ko'}>{panne.composante_u.length} + {panne.composante_v.length} sites {panne.reconnecte ? 'reconnectés' : 'séparés'}</Pill>
              </div>
            </>
          ) : <div className="mu mb-2.5">Cliquez sur un tronçon de l'ACM (cyan) pour simuler sa panne et calculer le raccordement disponible le moins coûteux (graphe initial, tronçon en panne exclu).</div>}
          <button className={`btn w-full justify-center mt-2.5 ${panne ? 'btn-gh' : 'btn-pri'}`} disabled={!res}
            onClick={() => (panne ? setPanne(null) : res && couper(res.aretes[Math.floor(res.aretes.length / 2)].label))}>
            {panne ? <><RotateCcw size={12} />Réinitialiser</> : <>Simuler une panne ({res?.aretes[Math.floor((res?.aretes.length ?? 0) / 2)]?.label})</>}
          </button>
        </Card>
      </div>
    </div>
  )
}

/** « C-01-Q-17 » → ["C-01", "Q-17"] en s'appuyant sur la liste des identifiants. */
function splitLabel(label: string, ids: string[]): [string, string] {
  const set = new Set(ids)
  for (let i = 1; i < label.length; i++) if (label[i] === '-' && set.has(label.slice(0, i)) && set.has(label.slice(i + 1))) return [label.slice(0, i), label.slice(i + 1)]
  const [a, b] = label.split('-')
  return [a, b]
}
