// Constructeur de scénario (partagé entre « Données » et « Scénarios ») : on choisit des arcs / tronçons
// sur la carte, une action, puis on évalue (sans enregistrer) ou on ajoute le scénario à scenarios.csv.
import { Plus, Save, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import NetworkCanvas, { pairKey } from './NetworkCanvas'
import { Card, Pill, Seg } from './ui'
import { api } from '../lib/api'
import { useStore } from '../lib/store'
import type { GraphPayload } from '../lib/types'

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

  const sel = actions.filter(a => a.cible === 'route').map(a => ({ u: a.u, v: a.v, color: '#FF4D4D', dashed: true, width: 3 }))
  const selF = actions.filter(a => a.cible === 'fibre').map(a => ({ u: a.u, v: a.v, color: '#FF4D4D', dots: true, width: 3.5 }))
  return (
    <Card title={<><Plus size={15} color="#FFB547" /> Nouveau scénario <Pill kind="am">ne modifie jamais la base</Pill></>} right={onClose && <button className="mu" onClick={onClose}><X size={15} /></button>} glow="#6a4c18">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1fr 320px' }}>
        <NetworkCanvas sites={graph.sites} routes={graph.routes} fibre={graph.fibre} decor={graph.decor} showFibre={cible === 'fibre'} dimRoads={cible === 'fibre'} height={420}
          edges={[...sel, ...selF]} selected={actions.filter(a => a.cible === 'site').map(a => a.u)}
          onRoadClick={surRoute} onFibreClick={surFibre} onSiteClick={surSite}
          overlay={<div className="mapover text-[11.5px]" style={{ left: 10, top: 10 }}>Cliquez {cible === 'route' ? 'sur des routes' : cible === 'fibre' ? 'sur des tronçons de fibre' : 'sur des sites'} pour les ajouter</div>} />
        <div className="flex flex-col gap-2.5">
          <div className="field">Nom du scénario<input className="inp" value={nom} onChange={e => setNom(e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
          <Seg value={cible} onChange={v => { setCible(v); setAction(v === 'fibre' ? 'panne' : 'fermer') }} options={[{ v: 'route', l: 'Routes' }, { v: 'fibre', l: 'Fibre' }, { v: 'site', l: 'Sites' }]} />
          <div className="grid grid-cols-2 gap-2">
            <div className="field">Action<select className="inp" value={action} onChange={e => setAction(e.target.value)}>{actionsPossibles.map(a => <option key={a}>{a}</option>)}</select></div>
            <div className="field">Période<select className="inp" value={periode} onChange={e => setPeriode(e.target.value)}><option>normal</option><option>pointe</option></select></div>
          </div>
          {action.endsWith('_temps') && <div className="field">{action === 'multiplier_temps' ? 'Facteur' : 'Nouveau temps (min)'}<input className="inp" value={valeur} onChange={e => setValeur(e.target.value)} /></div>}
          {cible === 'route' && <label className="flex items-center gap-2 text-[12px] mu"><input type="checkbox" checked={deuxSens} onChange={e => setDeuxSens(e.target.checked)} /> appliquer aux deux sens</label>}
          <div className="mu text-[11px] uppercase tracking-wider font-semibold mt-1">Lignes ajoutées à scenarios.csv ({actions.length})</div>
          <div className="overflow-auto" style={{ maxHeight: 170 }}>
            {actions.map((a, k) => (
              <div key={k} className="flex items-center gap-2 text-[11.5px] py-1 border-b border-[#141d35]">
                <span className="mono">{nom},{a.cible},{a.u},{a.v},{a.action},{a.valeur},{a.periode}</span>
                <button className="ml-auto mu" onClick={() => setActions(xs => xs.filter((_, j) => j !== k))}><Trash2 size={12} /></button>
              </div>
            ))}
            {!actions.length && <div className="mu2 text-[11.5px]">Aucune action : cliquez sur la carte.</div>}
          </div>
          <div className="flex gap-2 mt-auto">
            {onEvaluate && <button className="btn btn-gh flex-1 justify-center" disabled={!actions.length} onClick={() => onEvaluate(nom, actions)}>Évaluer</button>}
            <button className="btn btn-pri flex-1 justify-center" disabled={!actions.length} onClick={enregistrer}><Save size={13} />Ajouter au jeu</button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export { pairKey }
