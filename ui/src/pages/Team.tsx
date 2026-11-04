// Page 10 — Équipe & contributions (le détail est dans CONTRIBUTIONS.md, à compléter par l'équipe).
import { Card, Markdown } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/store'

const MEMBRES = [
  { a: 'M1', n: 'Membre 1', c: '#FF5468', r: 'M2 Itinéraires · M5 Scénarios · interface graphique' },
  { a: 'M2', n: 'Membre 2', c: '#2EE6D6', r: 'M4 Fibre · Union–Find · benchmarks & figures' },
  { a: 'M3', n: 'Membre 3', c: '#A78BFA', r: 'M1 Parcours · M3 Circuits absorbants · données, validateur & tests' },
]

export default function Team() {
  const doc = useApi(() => api.doc('CONTRIBUTIONS.md'), [], { silent: true })
  return (
    <div>
      <div className="grid grid-cols-3 gap-3.5">
        {MEMBRES.map(m => (
          <Card key={m.a}>
            <div className="flex gap-3 items-center">
              <div className="grid place-items-center font-extrabold text-[15px]" style={{ width: 42, height: 42, borderRadius: 12, background: m.c + '22', color: m.c, border: `1px solid ${m.c}55` }}>{m.a}</div>
              <div><b className="text-[14px]">{m.n}</b><div className="mu text-[12px]">{m.r}</div></div>
            </div>
            <div className="callout mt-3">Peut expliquer : tous les algorithmes, les choix de structures de données et les résultats (note individuelle).</div>
          </Card>
        ))}
      </div>
      <Card className="mt-3.5" title="CONTRIBUTIONS.md">
        {doc.data ? <Markdown text={doc.data} /> : <div className="mu">CONTRIBUTIONS.md introuvable.</div>}
      </Card>
    </div>
  )
}
