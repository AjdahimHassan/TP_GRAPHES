// Page 6 — Module 4 : Kruskal vs Prim, égalités de coût, pas à pas + Union–Find, étude de panne.
import { RotateCcw, Scissors } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import NetworkCanvas, { LegendDot, LegendLine, pairKey } from '../components/NetworkCanvas'
import { Callout, Card, ErrorBox, Pill, Seg, Skeleton } from '../components/ui'
import { LabGraph, StepPlayer } from '../components/widgets'
import { api } from '../lib/api'
import { fmt, fmtInt, fmtMs } from '../lib/format'
import { useGraph, useLastCalc } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { PanneResult } from '../lib/types'
import { MAP, STATUS, TYPE_COLOR } from '../theme/tokens'

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
  // mode présentation : panne automatique du tronçon déclaré dans le scénario « panne_fibre »
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
  const nodeColor = panne ? (x: any) => (x.type !== 'quartier' ? TYPE_COLOR[x.type] : compU.has(x.id) ? MAP.compA : MAP.compB) : undefined
  const edges = panne ? [
    { u: panne.coupee.u, v: panne.coupee.v, color: MAP.cut, dashed: true, width: 3.4 },
    ...(panne.raccordement ? [{ u: panne.raccordement.u, v: panne.raccordement.v, color: MAP.repair, dashed: true, glow: true, width: 3.6 }] : []),
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
      nodes: membres.map(i => ({ id: ids[i], x: 0, y: 0, color: r.has(i) && uf[i] === i ? '#1F4E79' : i === cur.u || i === cur.v ? STATUS.critical : '#9AA3B2' })),
      edges: membres.filter(i => uf[i] !== i && set.has(uf[i])).map(i => ({ id: `p${i}`, source: ids[uf[i]], target: ids[i], color: '#9AA3B2' })),
    }
  }, [cur, algo, ids])

  if (g.error) return <ErrorBox error={g.error} onRetry={g.reload} />
  const fenetre = step === null ? events.slice(0, 12) : events.slice(Math.max(0, step - 6), Math.max(0, step - 6) + 12)
  const base = step === null ? 0 : Math.max(0, step - 6)
  const milieu = res?.aretes[Math.floor((res?.aretes.length ?? 0) / 2)]?.label

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="grid gap-5 content-start min-w-0">
        <Card fig="Figure 5" title={<>{(m?.non_raccordes.length ?? 0) > 0 ? 'Forêt couvrante de poids minimal' : 'Arbre couvrant de poids minimal'} <Pill kind="in">{algo === 'kruskal' ? 'Kruskal' : 'Prim'}</Pill>{(m?.non_raccordes.length ?? 0) > 0 && <Pill kind="am">graphe non connexe : {m!.composantes.length} composantes</Pill>}</>}
          right={<Seg value={algo} onChange={setAlgo} size="sm" options={[{ v: 'kruskal', l: 'Kruskal' }, { v: 'prim', l: 'Prim' }]} />}>
          <div className="legend mb-3">
            <LegendLine color={MAP.mst} label="tronçon retenu" />
            <LegendLine color="#A4C6EE" label="tronçon candidat" width={2} />
            <LegendLine color={MAP.closed} label="interdit ou en panne" dotted />
            {rings.length > 0 && <LegendDot color={STATUS.critical} ring label="site non raccordé" />}
            {panne && <><LegendLine color={MAP.cut} label="tronçon coupé" dashed /><LegendLine color={MAP.repair} label="raccordement" dashed /><LegendDot color={MAP.compA} label="morceau 1" /><LegendDot color={MAP.compB} label="morceau 2" /></>}
          </div>
          {g.data ? (
            <NetworkCanvas sites={g.data.sites} routes={g.data.routes} fibre={g.data.fibre} decor={g.data.decor} showFibre dimRoads mst={mstMap} height="clamp(380px, calc(100vh - 400px), 640px)"
              nodeColor={nodeColor} edges={edges} rings={rings} labels={panne ? [panne.coupee.u, panne.coupee.v, ...(panne.raccordement ? [panne.raccordement.u, panne.raccordement.v] : [])] : []}
              onFibreClick={f => accepted.has(pairKey(f.u, f.v)) ? couper(`${f.u}-${f.v}`) : s.toast('info', `${f.u}–${f.v} n’est pas dans l’arbre : cliquez un tronçon bleu`)}
              overlay={res && <div className="mapover flex gap-5 text-[14px]" style={{ left: 12, bottom: 12 }}>
                <span><b className="text-[18px] num">{fmtInt(res.cout)}</b> <span className="mu">k€ au total</span></span><span><b className="num">{res.nb_aretes}</b> <span className="mu">tronçons</span></span>
                <span><b className="num">{res.composantes}</b> <span className="mu">composante(s)</span></span><span><b className="num" style={{ color: 'var(--ko)' }}>{m?.exclus.length}</b> <span className="mu">exclus</span></span></div>} />
          ) : <Skeleton h={520} />}
          {res?.trace && <div className="mt-3"><StepPlayer total={events.length} step={step ?? events.length} onStep={setStep} label={`${step ?? events.length} / ${events.length} ${algo === 'kruskal' ? 'arêtes examinées' : 'arêtes ajoutées'}`} /></div>}
        </Card>
        {foret && (
          <Card title={<>Forêt Union–Find <span className="mu font-normal text-[15px]">· arbre(s) contenant {cur?.label}</span></>} right={<div className="legend"><span><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 2.5px #1F4E79' }} />racine</span><span><i style={{ background: '#fff', boxShadow: `inset 0 0 0 2.5px ${STATUS.critical}` }} />extrémités de l’arête</span></div>}>
            <LabGraph nodes={foret.nodes} edges={foret.edges} layout="breadthfirst" height={240} />
            <div className="caption mt-2">Compression de chemin + union par rang : <span className="math">O(α(n))</span> amorti.</div>
          </Card>
        )}
      </div>

      <div className="grid gap-5 content-start">
        <Card fig="Tableau 5" title="Kruskal et Prim" right={m?.cout_identique !== undefined && (m.cout_identique ? <Pill kind="ok">✓ coût identique</Pill> : <Pill kind="ko">✗ coûts différents</Pill>)}>
          {!m ? <Skeleton h={140} /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(['kruskal', 'prim'] as const).map(a => (
                  <button key={a} className={`fileC text-left ${algo === a ? 'on' : ''}`} onClick={() => setAlgo(a)}>
                    <b className="text-[15px]">{a === 'kruskal' ? 'Kruskal' : 'Prim'}</b><div className="caption">{a === 'kruskal' ? <>tri + Union–Find · <span className="math">O(|E| log |E|)</span></> : <>tas binaire · <span className="math">O(|E| log |V|)</span></>}</div>
                    <div className="big mt-2">{fmtInt(m[a]?.cout)}<small>k€</small></div>
                    <div className="mu text-[13px] mt-0.5">{m[a]?.nb_aretes} tronçons · <span className="mono">{fmtMs(m[a]?.temps_ms)}</span></div>
                  </button>
                ))}
              </div>
              <Callout kind={m.meme_ensemble ? 'ok' : 'rem'} title="Égalités de coût" className="mt-3">
                {m.meme_ensemble ? <>Mêmes tronçons pour les deux algorithmes.</> : <><b>{m.diff_kruskal?.length} tronçon(s) différent(s)</b>, même coût total.</>}
                {m.egalites.echange && <> Échange possible : <span className="chip">{m.egalites.echange.retirer.label}</span> ↔ <span className="chip">{m.egalites.echange.ajouter.label}</span> ({fmt(m.egalites.echange.cout, 0)} k€) ⇒ plusieurs arbres minimaux.</>}
                {m.egalites.unique && <> Arbre minimal <b>unique</b>.</>}
              </Callout>
              {!m.meme_ensemble && (
                <table className="tbl compact mt-3"><thead><tr><th>Kruskal</th><th className="r">k€</th><th>Prim</th><th className="r">k€</th></tr></thead>
                  <tbody>{m.diff_kruskal?.slice(0, 5).map((a, k) => (
                    <tr key={k}><td className="mono">{a.label}</td><td className="r">{fmt(a.cost, 0)}</td><td className="mono">{m.diff_prim?.[k]?.label}</td><td className="r">{fmt(m.diff_prim?.[k]?.cost ?? null, 0)}</td></tr>
                  ))}</tbody></table>
              )}
            </>
          )}
        </Card>

        <Card title={<><Scissors size={18} /> Étude de panne</>} glow={panne ? 'var(--ok-line)' : undefined} style={{ order: panne ? -1 : 0 }}>
          {panne ? (
            <>
              <div className="ba">
                <div><div className="lbl">Tronçon coupé</div><div className="mono font-semibold mt-1" style={{ color: 'var(--ko)' }}>{panne.coupee.label}</div><div className="mu text-[13px]">{fmt(panne.coupee.cost, 0)} k€</div></div>
                <div className="text-center mu2 text-[20px]">→</div>
                <div><div className="lbl">Raccordement</div>{panne.raccordement ? <><div className="mono font-semibold mt-1" style={{ color: 'var(--ok)' }}>{panne.raccordement.label}</div><div className="mu text-[13px]">{fmt(panne.raccordement.cost, 0)} k€</div></> : <div className="mono mt-1" style={{ color: 'var(--ko)' }}>aucun disponible</div>}</div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Pill kind="am">Δ coût {panne.delta >= 0 ? '+' : ''}{fmt(panne.delta, 0)} k€</Pill><Pill kind="in">nouveau total {fmtInt(panne.nouveau_cout)} k€</Pill>
                <Pill kind={panne.reconnecte ? 'ok' : 'ko'}>{panne.composante_u.length} + {panne.composante_v.length} sites {panne.reconnecte ? 'reconnectés' : 'séparés'}</Pill>
              </div>
            </>
          ) : <div className="text-[14px] text-ink2">Cliquez un tronçon bleu de la carte.</div>}
          <button className={`btn w-full justify-center mt-3 ${panne ? 'btn-gh' : 'btn-pri'}`} disabled={!res}
            onClick={() => (panne ? setPanne(null) : milieu && couper(milieu))}>
            {panne ? <><RotateCcw size={14} />Réinitialiser</> : <><Scissors size={14} />Simuler une panne ({milieu})</>}
          </button>
        </Card>

        <Card title={<>Étapes de {algo === 'kruskal' ? 'Kruskal' : 'Prim'}</>}>
          {fenetre.map((e, k) => (
            <div key={k} className={`step ${step !== null && base + k === step - 1 ? 'cur' : ''}`}>
              <span className="mono mu text-right">{base + k + 1}</span>
              <span className="mono text-[13.5px]">{e.label} <span className="mu">{fmt(e.cout ?? null, 0)} k€</span>{algo === 'prim' && e.tas !== undefined && <span className="mu2"> · tas {e.tas}</span>}{e.type === 'racine' && <span className="mu"> nouvelle racine</span>}</span>
              {e.type === 'racine' ? <span className="mu2">—</span> : e.acceptee ? <span className="font-semibold" style={{ color: 'var(--ok)' }}>✓ ajoutée</span> : <span className="font-semibold" style={{ color: 'var(--ko)' }}>✗ cycle</span>}
            </div>
          ))}
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
