// Page 9 — Reproductibilité : chaque résultat du rapport → sa commande, graines, empreintes, versions.
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Callout, Card, CodeLine, ErrorBox, Pill, Skeleton } from '../components/ui'
import { api, figureUrl } from '../lib/api'
import { fmtMs, shortHash } from '../lib/format'
import { useApi, useStore } from '../lib/store'

export default function Repro() {
  const s = useStore()
  const r = useApi(() => api.repro(), [])
  const [regen, setRegen] = useState<{ produits: string[]; temps_ms: number } | null>(null)
  const [enCours, setEnCours] = useState(false)
  const lancer = async () => {
    setEnCours(true)
    try { const x = await api.regenerate(); setRegen(x); s.toast('ok', `${x.produits.length} fichiers régénérés`); r.reload() } catch (e: any) { s.toast('error', e.message) } finally { setEnCours(false) }
  }
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />
  if (!r.data) return <Skeleton h={400} />
  const jeu = (id: string) => r.data.jeux.find((j: any) => j.id === id)
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="grid gap-5 content-start min-w-0">
        <Callout kind="def">Chaque tableau et chaque figure du rapport → la commande exacte qui le régénère.</Callout>
        <Card fig="Annexe A" title="Chaque résultat du rapport → sa commande">
          {r.data.commandes.map((c: any) => {
            const j = jeu(c.dataset)
            return (
              <div key={c.label} className="mb-3.5">
                <div className="flex items-center gap-2 text-[14px] mb-1.5 flex-wrap"><b className="text-ink2">{c.label}</b><span className="ml-auto mono text-[12.5px] mu">{c.dataset}{j?.graine !== undefined && j?.graine !== null ? ` · graine ${j.graine}` : ''}{j?.hash ? ` · ${shortHash(j.hash)}` : ''}</span></div>
                <CodeLine cmd={c.commande} />
              </div>
            )
          })}
          <div className="caption">Toutes les commandes s’exécutent depuis la racine du dépôt après <span className="mono">pip install -e .</span> ; <span className="mono">python tasks.py demo</span> lance tout.</div>
        </Card>
        {r.data.figures.length > 0 && (
          <Card fig="Annexe B" title="Figures du rapport (reports/figures)">
            <div className="grid gap-4 md:grid-cols-2">{r.data.figures.map((f: string) => <a key={f} href={figureUrl(f)} target="_blank" rel="noreferrer" className="fileC hover:border-[var(--navy-line)]"><img src={figureUrl(f) + `?t=${regen?.temps_ms ?? 0}`} alt={f} className="w-full rounded" /><div className="mono text-[12.5px] mt-1.5 mu">{f}</div></a>)}</div>
          </Card>
        )}
      </div>
      <div className="grid gap-5 content-start">
        <Card title="Empreintes SHA-256 des jeux">
          <table className="tbl compact"><thead><tr><th>Jeu</th><th className="r">sha256</th><th className="r">Graine</th></tr></thead><tbody>{r.data.jeux.map((j: any) => <tr key={j.id}><td className="mono">{j.id}</td><td className="r mono mu" title={j.hash}>{shortHash(j.hash)}</td><td className="r mono">{j.graine ?? '—'}</td></tr>)}</tbody></table>
        </Card>
        <Card title="Environnement d’exécution">
          <table className="tbl kv"><tbody>{Object.entries(r.data.environnement).map(([k, v]) => <tr key={k}><td>{k}</td><td className="r mono">{String(v)}</td></tr>)}</tbody></table>
        </Card>
        <button className="btn btn-pri justify-center" disabled={enCours} onClick={lancer}><RefreshCw size={15} className={enCours ? 'animate-spin' : ''} />{enCours ? 'Régénération…' : 'Régénérer tous les résultats'}</button>
        {regen && <Card title={<>Fichiers produits <Pill kind="ok">{fmtMs(regen.temps_ms)}</Pill></>}>{regen.produits.map(p => <div key={p} className="mono text-[13px] py-0.5">{p}</div>)}</Card>}
      </div>
    </div>
  )
}
