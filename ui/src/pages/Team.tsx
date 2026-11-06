// Page 10 — Équipe & contributions : lu directement dans CONTRIBUTIONS.md (une seule source à compléter).
import { Users } from 'lucide-react'
import { Callout, Card, Markdown, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/store'
import { SERIES } from '../theme/tokens'

interface Membre { nom: string; modules: string; fichiers: string; livrables: string }

/** Premier tableau Markdown dont l'en-tête commence par « Membre ». */
function membres(md: string): Membre[] {
  const lignes = md.split('\n')
  const i = lignes.findIndex(l => /^\|\s*Membre\s*\|/i.test(l))
  if (i < 0) return []
  const out: Membre[] = []
  for (let k = i + 1; k < lignes.length && lignes[k].startsWith('|'); k++) {
    const c = lignes[k].split('|').slice(1, -1).map(x => x.trim())
    if (c.every(x => /^:?-+:?$/.test(x)) || !c[0]) continue
    out.push({ nom: c[0], modules: c[1] ?? '', fichiers: c[2] ?? '', livrables: c[3] ?? '' })
  }
  return out
}

const sansMd = (s: string) => s.replace(/`/g, '').replace(/\*\*/g, '')
const initiales = (nom: string) => (/^membre\s*\d+$/i.test(nom) ? nom.replace(/\D/g, '') ? `M${nom.replace(/\D/g, '')}` : 'M' : nom.split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase())

export default function Team() {
  const doc = useApi(() => api.doc('CONTRIBUTIONS.md'), [], { silent: true })
  const ms = doc.data ? membres(doc.data) : []
  const aCompleter = ms.some(m => /^membre\s*\d+$/i.test(m.nom))
  return (
    <div className="grid gap-5">
      {aCompleter && (
        <Callout kind="warn">Noms à compléter dans <span className="mono">CONTRIBUTIONS.md</span> (cette page se met à jour toute seule).</Callout>
      )}
      {!doc.data && !doc.error && <Skeleton h={160} />}
      <div className="grid gap-5 lg:grid-cols-3">
        {ms.map((m, k) => (
          <Card key={k}>
            <div className="flex gap-3.5 items-center">
              <div className="grid place-items-center font-semibold text-[16px] shrink-0" style={{ width: 48, height: 48, borderRadius: 99, background: SERIES[k % 3] + '1f', color: '#131A22', border: `2px solid ${SERIES[k % 3]}` }}>{initiales(m.nom)}</div>
              <div className="min-w-0"><div className="serif text-[19px] font-semibold">{m.nom}</div><div className="text-[14px] text-ink2">{sansMd(m.modules)}</div></div>
            </div>
            <div className="divider" />
            <div className="lbl mb-1">Fichiers</div>
            <div className="mono text-[12.5px] text-ink2 leading-relaxed">{sansMd(m.fichiers)}</div>
            <div className="lbl mt-3 mb-1">Tests et livrables</div>
            <div className="text-[13.5px] text-ink2">{sansMd(m.livrables)}</div>
          </Card>
        ))}
      </div>
      <Card fig="Livrable 7" title={<><Users size={18} /> CONTRIBUTIONS.md</>}>
        {doc.data ? <div className="max-w-[1100px]"><Markdown text={doc.data} /></div> : doc.error ? <div className="mu">CONTRIBUTIONS.md introuvable.</div> : <Skeleton h={200} />}
      </Card>
    </div>
  )
}
