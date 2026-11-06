// Page 11 — Bilan & conformité : grille d'évaluation du sujet (§7), preuves calculées en direct, limites, recommandations.
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Callout, Card, Pill, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { fmt, fmtInt } from '../lib/format'
import { useApi, useStore } from '../lib/store'
import { scenLabel } from '../theme/tokens'

const GRILLE: { c: string; pts: number; livre: ReactNode; ou: [string, string][] }[] = [
  { c: 'Modélisation, validation des données et architecture', pts: 2, livre: <>2 graphes (orienté / non orienté), 5 CSV documentés, validateur, architecture en couches</>, ou: [['/donnees', 'Données']] },
  { c: 'DFS / BFS et diagnostic d’accessibilité', pts: 1, livre: <>parcours multi-source, 3 notions de connexité, circuits, sites isolés</>, ou: [['/accessibilite', 'Module 1']] },
  { c: 'Dijkstra, Bellman–Ford, Floyd–Warshall et chemins', pts: 4, livre: <>3 algorithmes comparés, avant / après, retards, circuits absorbants (<b>−∞</b>)</>, ou: [['/itineraires', 'Module 2'], ['/circuits', 'Module 3'], ['/laboratoire', 'Laboratoire']] },
  { c: 'Kruskal, Prim, Union–Find et analyse des pannes', pts: 3, livre: <>arbre / forêt minimale, égalités de coût, panne et raccordement</>, ou: [['/fibre', 'Module 4']] },
  { c: 'Scénarios et indicateurs de résilience', pts: 3, livre: <>6 scénarios × 5 indicateurs, base inchangée (SHA-256)</>, ou: [['/scenarios', 'Module 5']] },
  { c: 'Tests, robustesse et reproductibilité', pts: 2, livre: <>151 tests pytest, graines et empreintes documentées</>, ou: [['/reproductibilite', 'Reproductibilité']] },
  { c: 'Benchmarks et analyse critique', pts: 2, livre: <>5 tailles × 3 densités × 5 répétitions, pentes vs théorie</>, ou: [['/benchmarks', 'Expériences']] },
  { c: 'Rapport, démonstration et contribution individuelle', pts: 3, livre: <>présentation guidée (12 étapes), contributions</>, ou: [['/equipe', 'Équipe']] },
]

function Preuve({ ok, label, detail }: { ok: boolean | null; label: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex gap-3 items-start py-2.5" style={{ borderBottom: '1px solid var(--hair)' }}>
      {ok === null ? <Loader2 size={20} className="animate-spin mu shrink-0" /> : ok ? <CheckCircle2 size={20} color="var(--ok)" className="shrink-0" /> : <XCircle size={20} color="var(--ko)" className="shrink-0" />}
      <div className="min-w-0"><div className="text-[14.5px] font-medium">{label}</div>{detail && <div className="caption">{detail}</div>}</div>
    </div>
  )
}

export default function Bilan() {
  const s = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const ds = s.dataset
  const val = useApi(() => api.validate(ds), [ds], { silent: true })
  const mst = useApi(() => api.mst(ds, 'normal', 'both'), [ds], { silent: true })
  const scen = useApi(() => api.scenarios(ds, null, null), [ds], { silent: true })
  const acc = useApi(() => api.access({ dataset: ds, scenario: 'normal', seuil: 10 }), [ds], { silent: true })
  const negA = useApi(() => api.negcycle('negatif_accessible', 'S'), [], { silent: true })
  const negB = useApi(() => api.negcycle('negatif_inaccessible', 'S'), [], { silent: true })
  const scens = scen.data?.scenarios ?? []
  const fermeture = scens.find(x => x.scenario === 'fermeture_axe') ?? [...scens].sort((a, b) => b.hausse_max - a.hausse_max)[0]
  const rts = useApi(() => api.routes({ dataset: ds, scenario: fermeture?.scenario ?? 'normal' }), [ds, fermeture?.scenario], { silent: true, enabled: !!fermeture })
  const pire = [...(rts.data?.lignes ?? [])].filter(l => l.retard !== null).sort((a, b) => (b.retard ?? 0) - (a.retard ?? 0))[0]
  const route = useApi(() => api.route({ dataset: ds, scenario: fermeture?.scenario ?? 'normal', demande: pire!.demande, algo: 'all' }), [ds, pire?.demande, fermeture?.scenario], { silent: true, enabled: !!pire })
  const go = (p: string) => nav({ pathname: p, search: loc.search })
  const fibre = [...scens].sort((a, b) => b.cout_reparation - a.cout_reparation)[0]
  const coupures = scens.filter(x => x.demandes_devenues_inaccessibles > 0)
  const total = GRILLE.reduce((t, g) => t + g.pts, 0)

  return (
    <div className="grid gap-5">
      <Card fig="Sujet §7" title={`Grille d’évaluation (${total} points)`}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Critère</th><th className="r">Points</th><th>Réalisation</th><th>Démonstration</th></tr></thead>
            <tbody>{GRILLE.map(g => (
              <tr key={g.c}>
                <td className="font-semibold" style={{ whiteSpace: 'normal', minWidth: 220 }}>{g.c}</td>
                <td className="r font-semibold">{g.pts}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 280 }} className="text-ink2 text-[14px]">{g.livre}</td>
                <td><div className="flex flex-wrap gap-1.5">{g.ou.map(([p, l]) => <button key={p} className="btn btn-gh btn-sm" onClick={() => go(p)}>{l}<ArrowRight size={13} /></button>)}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Preuves calculées en direct" sub={<>jeu <span className="mono">{ds}</span></>}>
          <Preuve ok={val.data ? val.data.ok : null} label="Validateur : aucune erreur dans les cinq fichiers" detail={val.data && `${val.data.errors.length} erreur(s) · ${val.data.warnings.length} avertissement(s)`} />
          <Preuve ok={route.data ? route.data.identiques : null} label={<>Dijkstra = Bellman–Ford = Floyd–Warshall{pire && <> sur la demande la plus retardée, <span className="mono">{pire.demande}</span></>}</>}
            detail={route.data ? route.data.algos.map(a => `${a.algo === 'dijkstra' ? 'Dijkstra' : a.algo === 'bellman_ford' ? 'BF' : 'FW'} ${a.ignore ? 'non lancé (n > 400)' : `${fmt(a.dist, 2)} min`}`).join(' · ') : rts.data && !pire ? 'aucune demande dans ce jeu' : undefined} />
          <Preuve ok={mst.data ? !!mst.data.cout_identique : null} label="Kruskal et Prim : même coût total" detail={mst.data && `${fmtInt(mst.data.kruskal?.cout)} k€ = ${fmtInt(mst.data.prim?.cout)} k€ · ${mst.data.meme_ensemble ? 'mêmes tronçons' : `${mst.data.diff_kruskal?.length} tronçon(s) différent(s) à coût égal`}`} />
          <Preuve ok={negA.data && negB.data ? negA.data.resultats.every(r => r.existe && r.accessible) && negB.data.resultats.every(r => r.existe && !r.accessible) : null} label="Circuits absorbants : accessible dans A, non accessible dans B" detail="Bellman–Ford et Floyd–Warshall concordent ; distances −∞ uniquement dans A" />
          <Preuve ok={scen.data ? scen.data.base_inchangee : null} label={`Base de référence inchangée après ${scens.length} scénarios`} detail={scen.data && `sha256 ${scen.data.hash_fichiers_avant.slice(0, 12)}… avant = après`} />
        </Card>

        <Card title="Recommandations à la ville">
          {!scen.data || !acc.data ? <Skeleton h={200} /> : (
            <ol className="list-decimal ml-5 space-y-2.5 text-[14.5px] text-ink2 leading-relaxed">
              {pire && (pire.retard ?? 0) > 0 && <li><b className="text-ink">Sécuriser les axes critiques.</b> « {scenLabel(fermeture!.scenario)} » retarde jusqu’à <b>+{fmt(pire.retard, 2)} min</b> la demande <span className="mono">{pire.demande}</span> (+{fmt(pire.retard_pct, 0)} %) : prévoir un itinéraire de délestage ou une caserne relais.</li>}
              {acc.data.hors_delai.length > 0 && <li><b className="text-ink">Réduire les délais d’intervention.</b> {acc.data.hors_delai.length} quartier(s) sont à plus de {acc.data.seuil} min de tout secours ({acc.data.hors_delai.slice(0, 4).map(h => h.id).join(', ')}…).</li>}
              {acc.data.isoles.length > 0 && <li><b className="text-ink">Désenclaver les sites isolés</b> ({acc.data.isoles.join(', ')}) : aucun arc ne les relie au réseau routier.</li>}
              {fibre && fibre.cout_reparation > 0 && <li><b className="text-ink">Doubler les tronçons de fibre critiques.</b> La perte de {fibre.troncons_perdus.join(', ') || 'tronçons'} (« {scenLabel(fibre.scenario)} ») coûte <b>{fmtInt(fibre.cout_reparation)} k€</b> de raccordement.</li>}
              {coupures.map(c => <li key={c.scenario}><b className="text-ink">Anticiper « {scenLabel(c.scenario)} ».</b> {c.demandes_devenues_inaccessibles} demande(s) deviennent inaccessibles ; {fmt(c.part_sensibles_accessibles, 1)} % des sites sensibles restent atteignables.</li>)}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Callout kind="warn" title="Limites">Temps statiques, capacités et incidents simultanés ignorés, données synthétiques.</Callout>
        <Callout kind="rem" title="Perspectives">Temps dépendant de l’heure, capacités des casernes, fibre 2-connexe (résiste à toute panne).</Callout>
      </div>
      <div className="flex justify-center gap-2 mt-1"><Pill kind="in">Merci de votre attention — questions ?</Pill></div>
    </div>
  )
}
