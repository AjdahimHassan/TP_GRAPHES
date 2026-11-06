// Constructeur de scénario (partagé entre « Données » et « Scénarios ») : on choisit des arcs / tronçons
// sur la carte, une action, puis on évalue (sans enregistrer) ou on ajoute le scénario à scenarios.csv.
import { Plus, Save, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import NetworkCanvas, { pairKey } from './NetworkCanvas'
import { Card, Pill, Seg } from './ui'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { GraphPayload } from '../lib/types'
import { MAP } from '../theme/tokens'

export interface BuilderAction { cible: string; u: string; v: string; action: string; valeur: string; periode: string }

export default function ScenarioBuilder({ graph, onEvaluate, onClose }: { graph: GraphPayload; onEvaluate?: (nom: string, actions: BuilderAction[]) => void; onClose?: () => void }) {
  const s = useStore()
  const [nom, setNom] = useState('mon_scenario')
  const [cible, setCible] = useState<'route' | 'fibre' | 'site'>('route')
  const [action, setAction] = useState('fermer')
  const [valeur, setValeur] = useState('2')
  const [periode, setPeriode] = useState('normal')
  const [deuxSens, setDeuxSens] = useState(true)
  const [actions, setActions] = useState<BuilderAction[]>([])
  const actionsPossibles = cible === 'route' ? ['fermer', 'travaux', 'multiplier_temps', 'modifier_temps'] : cible === 'fibre' ? ['panne', 'interdire'] : ['fermer', 'panne']
  const ajouter = (a: BuilderAction) => setActions(xs => (xs.some(x => x.cible === a.cible && x.u === a.u && x.v === a.v && x.action === a.action) ? xs : [...xs, a]))
  const base = { action, valeur: action.endsWith('_temps') ? valeur : '', periode }

  const surRoute = (u: string, v: string) => {
    if (cible !== 'route') return
    const existe = (a: string, b: string) => graph.routes.some(r => r.u === a && r.v === b)
    if (existe(u, v)) ajouter({ cible: 'route', u, v, ...base })
    if (deuxSens && existe(v, u)) ajouter({ cible: 'route', u: v, v: u, ...base })
  }
  const surFibre = (f: { u: string; v: string }) => { if (cible === 'fibre') ajouter({ cible: 'fibre', u: f.u, v: f.v, ...base }) }
  const surSite = (id: string) => { if (cible === 'site') ajouter({ cible: 'site', u: id, v: '', ...base }) }

  const enregistrer = async () => {
    try {
      const r = await api.appendScenario(s.dataset, nom, actions)
      if (r.enregistre) {
        s.toast('ok', `Scénario « ${nom} » ajouté à scenarios.csv (base inchangée : ${r.hash_avant === r.hash_apres ? 'oui' : 'NON'})`)
        s.refreshDatasets()
        s.setScenario(nom)
      } else s.toast('error', r.validation?.errors?.[0]?.message ?? 'Validation refusée')
    } catch (e: any) { s.toast('error', e.message) }
  }

  const sel = actions.filter(a => a.cible === 'route').map(a => ({ u: a.u, v: a.v, color: a.action === 'fermer' ? MAP.closed : MAP.works, dashed: true, width: 3.4 }))
  const selF = actions.filter(a => a.cible === 'fibre').map(a => ({ u: a.u, v: a.v, color: MAP.closed, dots: true, width: 3.8 }))
  return (
    <Card title={<><Plus size={18} color="var(--navy)" /> Nouveau scénario <Pill kind="in">ne modifie jamais la base</Pill></>} sub="Choisissez une cible et une action, puis cliquez sur la carte : chaque clic ajoute une ligne à scenarios.csv."
      right={onClose && <button className="btn btn-gh btn-sm" onClick={onClose}><X size={14} />Fermer</button>} glow="var(--navy-line)">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <NetworkCanvas sites={graph.sites} routes={graph.routes} fibre={graph.fibre} decor={graph.decor} showFibre={cible === 'fibre'} dimRoads={cible === 'fibre'} height={460}
          edges={[...sel, ...selF]} selected={actions.filter(a => a.cible === 'site').map(a => a.u)}
          onRoadClick={surRoute} onFibreClick={surFibre} onSiteClick={surSite}
          overlay={<div className="mapover text-[14px] font-medium" style={{ left: 12, top: 12 }}>Cliquez {cible === 'route' ? 'sur des routes' : cible === 'fibre' ? 'sur des tronçons de fibre' : 'sur des sites'} pour les ajouter</div>} />
        <div className="flex flex-col gap-3">
          <div className="field">Nom du scénario<input className="inp mono" value={nom} onChange={e => setNom(e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
          <Seg value={cible} onChange={v => { setCible(v); setAction(v === 'fibre' ? 'panne' : 'fermer') }} options={[{ v: 'route', l: 'Routes' }, { v: 'fibre', l: 'Fibre' }, { v: 'site', l: 'Sites' }]} />
          <div className="grid grid-cols-2 gap-3">
            <div className="field">Action<select className="inp" value={action} onChange={e => setAction(e.target.value)}>{actionsPossibles.map(a => <option key={a}>{a}</option>)}</select></div>
            <div className="field">Période<select className="inp" value={periode} onChange={e => setPeriode(e.target.value)}><option>normal</option><option>pointe</option></select></div>
          </div>
          {action.endsWith('_temps') && <div className="field">{action === 'multiplier_temps' ? 'Facteur multiplicatif' : 'Nouveau temps (min)'}<input className="inp mono" value={valeur} onChange={e => setValeur(e.target.value)} /></div>}
          {cible === 'route' && <label className="flex items-center gap-2 text-[14px] text-ink2"><input type="checkbox" checked={deuxSens} onChange={e => setDeuxSens(e.target.checked)} /> appliquer aux deux sens de circulation</label>}
          <div className="lbl mt-1">Lignes ajoutées à scenarios.csv ({actions.length})</div>
          <div className="overflow-auto rounded-lg" style={{ maxHeight: 190, border: '1px solid var(--rule)' }}>
            {actions.map((a, k) => (
              <div key={k} className="flex items-center gap-2 text-[12.5px] px-2.5 py-1.5" style={{ borderBottom: '1px solid var(--hair)' }}>
                <span className="mono truncate">{nom},{a.cible},{a.u},{a.v},{a.action},{a.valeur},{a.periode}</span>
                <button className="ml-auto mu hover:text-ink shrink-0" onClick={() => setActions(xs => xs.filter((_, j) => j !== k))} title="Retirer"><Trash2 size={14} /></button>
              </div>
            ))}
            {!actions.length && <div className="mu text-[13.5px] p-3">Aucune action : cliquez sur la carte.</div>}
          </div>
          <div className="flex gap-2 mt-auto">
            {onEvaluate && <button className="btn btn-gh flex-1 justify-center" disabled={!actions.length} onClick={() => onEvaluate(nom, actions)}>Évaluer sans enregistrer</button>}
            <button className="btn btn-pri flex-1 justify-center" disabled={!actions.length} onClick={enregistrer}><Save size={15} />Ajouter au jeu</button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export { pairKey }
