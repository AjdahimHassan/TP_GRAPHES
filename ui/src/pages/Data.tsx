// Page 2 — Données & validation : jeux fournis (§2.4), fichiers et validateur (§2.3), générateur reproductible,
// import, éditeur de tables (nouvelle version, original intact), constructeur de scénario, format SCHEMA.md.
import { Check, Dice5, Download, FileText, Pencil, Plus, Save, Trash2, Upload, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import NetworkCanvas from '../components/NetworkCanvas'
import ScenarioBuilder from '../components/ScenarioBuilder'
import { Callout, Card, CodeLine, ErrorBox, Markdown, Pill, Seg, Skeleton, Stat } from '../components/ui'
import { ValidationTable } from '../components/widgets'
import { api, downloadGenerated, fileUrl, zipUrl } from '../lib/api'
import { bytes, fmt } from '../lib/format'
import { useGraph } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { GenResult, Preset, TablePage } from '../lib/types'
import { TYPE_COLOR } from '../theme/tokens'

const FICHIERS = ['sites.csv', 'routes.csv', 'fibre.csv', 'demandes.csv', 'scenarios.csv']
const COLS: Record<string, string> = {
  'sites.csv': 'id, nom, type, longitude, latitude',
  'routes.csv': 'u, v, temps_normal, temps_pointe, statut (+ type_voie, capacite)',
  'fibre.csv': 'u, v, cost, statut',
  'demandes.csv': 'id, origine, type, priorite',
  'scenarios.csv': 'scenario, cible, u, v, action, valeur, periode',
}
const SCEN_GEN = [['fermeture_axe', 'Fermeture des ponts centraux'], ['panne_fibre', 'Panne fibre'], ['heure_pointe', 'Heure de pointe'], ['zone_travaux', 'Zone de travaux'], ['crue_nova', 'Crue de la Nova']]
const FAMILLE: Record<string, [string, 'ok' | 'am' | 'in' | 'mu']> = {
  mini: ['Petit graphe vérifiable à la main', 'ok'],
  test: ['Test M3 · poids négatifs artificiels', 'am'],
  realiste: ['Réaliste documenté (≥ 100 sites)', 'in'],
  generes: ['Généré pour les benchmarks (≥ 1 000)', 'mu'],
  benchmark: ['Généré pour les benchmarks (≥ 1 000)', 'mu'],
}

function Num({ label, value, onChange, step = 1, disabled, color }: { label: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean; color?: string }) {
  return (
    <div className="field">
      <span className="flex items-center gap-1.5">{color && <i className="dot" style={{ background: color }} />}{label}</span>
      <input className="inp mono" type="number" step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}
function Slider({ label, value, min, max, step = 1, unit = '', onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="field">{label}
      <div className="flex items-center gap-3"><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} className="flex-1" />
        <span className="mono text-ink text-right text-[13.5px]" style={{ minWidth: 58 }}>{fmt(value, step < 1 ? 2 : 0)}{unit}</span></div>
    </div>
  )
}

function Studio() {
  const s = useStore()
  const presets = useApi(() => api.presets(), [])
  const [preset, setPreset] = useState('realiste')
  const [params, setParams] = useState<Record<string, any> | null>(null)
  const [res, setRes] = useState<GenResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [apercu, setApercu] = useState('routes.csv')
  const fixe = ['mini', 'test_m3_a', 'test_m3_b'].includes(preset)

  useEffect(() => {
    const p = presets.data?.find((x: Preset) => x.id === preset)
    if (p) setParams({ ...p.params })
  }, [preset, presets.data])

  // aperçu en direct (génération côté Python, jamais en JavaScript)
  useEffect(() => {
    if (!params) return
    const t = setTimeout(() => {
      setLoading(true)
      api.generate(preset, params, true).then(r => { setRes(r); setErr(null) }).catch(e => setErr(e.message)).finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(t)
  }, [params, preset])

  const set = (k: string, v: any) => setParams(p => ({ ...p!, [k]: v }))
  const enregistrer = async (ecraser = false) => {
    try {
      const r = await api.generate(preset, params, false, ecraser)
      s.toast('ok', `Jeu enregistré dans data/${r.nom}`)
      s.refreshDatasets()
      s.setDataset(r.nom)
    } catch (e: any) {
      if (e.status === 409 && confirm(`${e.message}\n\nÉcraser le jeu existant ?`)) return enregistrer(true)
      s.toast('error', e.message)
    }
  }
  const fichier = res?.fichiers.find(f => f.nom === apercu)

  return (
    <Card fig="Générateur reproductible" title={<>Studio de génération de jeux de données <span className="badge-syn">synthétique</span></>}
      sub="Même graine + mêmes paramètres ⇒ mêmes fichiers."
      right={<Seg value={preset} onChange={setPreset} options={(presets.data ?? []).map((p: Preset) => ({ v: p.id, l: p.label }))} />}>
      {!params ? <Skeleton h={320} /> : (
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <div>
            {fixe && <Callout kind="rem" className="mb-3">Jeu de test à structure fixe : paramètres verrouillés.</Callout>}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="field">Nom du jeu<input className="inp mono" value={params.nom} onChange={e => set('nom', e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
              <div className="field">Graine
                <div className="flex gap-1.5"><input className="inp mono flex-1" type="number" value={params.graine ?? 0} disabled={fixe} onChange={e => set('graine', Number(e.target.value))} />
                  <button className="btn btn-gh btn-sm" disabled={fixe} onClick={() => set('graine', Math.floor(Math.random() * 100000))} title="Graine aléatoire"><Dice5 size={15} /></button></div>
              </div>
              <Num label="Sites (total)" value={params.n_sites} disabled={fixe} onChange={v => set('n_sites', v)} />
              <Num label="Demandes" value={params.demandes} disabled={fixe} onChange={v => set('demandes', v)} />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <Num label="Casernes" value={params.casernes} color={TYPE_COLOR.caserne} disabled={fixe} onChange={v => set('casernes', v)} />
              <Num label="Hôpitaux" value={params.hopitaux} color={TYPE_COLOR.hopital} disabled={fixe} onChange={v => set('hopitaux', v)} />
              <Num label="Écoles" value={params.ecoles} color={TYPE_COLOR.ecole} disabled={fixe} onChange={v => set('ecoles', v)} />
              <Num label="Télécom" value={params.telecom} color={TYPE_COLOR.telecom} disabled={fixe} onChange={v => set('telecom', v)} />
            </div>
            <div className="grid gap-2.5">
              <Slider label="Degré moyen visé (densité)" value={params.degre_moyen} min={2} max={14} step={0.5} disabled={fixe} onChange={v => set('degre_moyen', v)} />
              <Slider label="Routes à sens unique" value={params.sens_unique_pct} min={0} max={40} unit=" %" disabled={fixe} onChange={v => set('sens_unique_pct', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Pointe min ×" value={params.pointe_min} min={1} max={2} step={0.05} disabled={fixe} onChange={v => set('pointe_min', v)} />
                <Slider label="Pointe max ×" value={params.pointe_max} min={1} max={3} step={0.05} disabled={fixe} onChange={v => set('pointe_max', v)} />
              </div>
              <Slider label="Arcs en travaux" value={params.travaux_pct} min={0} max={20} unit=" %" disabled={fixe} onChange={v => set('travaux_pct', v)} />
              <Slider label="Fibre interdite (zones inondables)" value={params.fibre_interdite_pct} min={0} max={30} unit=" %" disabled={fixe} onChange={v => set('fibre_interdite_pct', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Num label="Coût fibre min (k€)" value={params.cout_min} disabled={fixe} onChange={v => set('cout_min', v)} />
                <Num label="Coût fibre max (k€)" value={params.cout_max} disabled={fixe} onChange={v => set('cout_max', v)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['P1', 'P2', 'P3'].map((l, k) => <Num key={l} label={`% ${l}`} value={params.priorites[k]} disabled={fixe} onChange={v => set('priorites', params.priorites.map((x: number, j: number) => (j === k ? v : x)))} />)}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              <label className="check"><input type="checkbox" disabled={fixe} checked={params.riviere} onChange={e => set('riviere', e.target.checked)} /> Rivière ·
                <input className="bg-transparent w-8 mono text-center" type="number" min={1} value={params.ponts} disabled={fixe || !params.riviere} onChange={e => set('ponts', Number(e.target.value))} /> ponts</label>
              <label className="check"><input type="checkbox" disabled={fixe} checked={params.site_isole} onChange={e => set('site_isole', e.target.checked)} /> Site isolé (cas limite)</label>
              <label className="check"><input type="checkbox" disabled={fixe} checked={params.periph} onChange={e => set('periph', e.target.checked)} /> Périphérique</label>
              {SCEN_GEN.map(([k, l]) => (
                <label key={k} className="check"><input type="checkbox" disabled={fixe} checked={params.scenarios.includes(k)} onChange={e => set('scenarios', e.target.checked ? [...params.scenarios, k] : params.scenarios.filter((x: string) => x !== k))} /> {l}</label>
              ))}
              <span className={`pill ${params.poids_negatifs ? 'p-am' : 'p-mu'}`} title="Uniquement dans les presets Test M3">{params.poids_negatifs ? '✓' : '—'} poids négatifs (tests M3 seulement)</span>
            </div>
          </div>

          <div className="min-w-0">
            {err && <ErrorBox error={err} />}
            {res?.carte ? (
              <NetworkCanvas sites={res.carte.sites} routes={res.carte.routes} fibre={res.carte.fibre} decor={res.carte.decor} height={360} plain={res.carte.sites.length > 1500}
                overlay={<div className="mapover flex items-center gap-2" style={{ left: 12, top: 12 }}>{res.validation.ok ? <Pill kind="ok"><Check size={13} />Validateur : 0 erreur{res.validation.warnings.length ? ` · ${res.validation.warnings.length} avert.` : ''}</Pill> : <Pill kind="ko">✗ {res.validation.errors.length} erreur(s)</Pill>}{loading && <span className="mu text-[13px]">génération…</span>}</div>} />
            ) : <Skeleton h={360} />}
            {res && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                <Stat v={res.stats.sites} l="sommets" /><Stat v={res.stats.arcs} l="arcs" /><Stat v={res.stats.troncons} l="tronçons" />
                <Stat v={fmt(res.stats.degre_moyen, 2)} l="degré moyen" /><Stat v={res.stats.composantes_fibre} l="comp. fibre" /><Stat v={res.stats.nb_scc} l="CFC" />
              </div>
            )}
            {res && <div className="mt-3"><div className="lbl mb-1.5">Commande équivalente</div><CodeLine cmd={res.commande} /></div>}
            <div className="caption mt-2">sha256 de la base générée : <span className="mono text-ink2">{res?.sha256_base.slice(0, 16)}…</span>{res?.commande.includes('--params') ? ' · enregistrez les paramètres dans params.json' : ''}</div>
          </div>

          <div className="xl:col-span-2 2xl:col-span-1">
            <div className="lbl mb-2">Fichiers générés</div>
            {(res?.fichiers ?? []).map(f => (
              <div key={f.nom} onClick={() => setApercu(f.nom)} className={`fileC flex items-center gap-2.5 mb-1.5 cursor-pointer ${f.nom === apercu ? 'on' : ''}`} style={{ padding: '9px 12px' }}>
                <FileText size={16} color={f.nom.endsWith('.json') ? '#6250d6' : '#1F4E79'} />
                <span className="mono text-[13.5px]">{f.nom}</span>
                <span className="mu num text-[12.5px] ml-auto">{f.lignes !== null ? `${f.lignes} lignes · ` : ''}{bytes(f.octets)}</span>
                <button className="btn btn-gh btn-sm" style={{ padding: '3px 7px' }} onClick={e => { e.stopPropagation(); downloadGenerated(preset, params, f.nom, f.nom) }} title={`Télécharger ${f.nom}`}><Download size={13} /></button>
              </div>
            ))}
            <button className="btn btn-pri w-full justify-center mt-2" disabled={!res} onClick={() => downloadGenerated(preset, params, null, `${params.nom}.zip`)}><Download size={15} />Télécharger tout (.zip)</button>
            <button className="btn btn-gh w-full justify-center mt-2" disabled={!res?.validation.ok} onClick={() => enregistrer()}><Save size={15} />Enregistrer dans data/{params.nom}</button>
            {res?.existe && <div className="caption mt-1.5">⚠ data/{params.nom} existe déjà : confirmation demandée avant écrasement.</div>}
          </div>
        </div>
      )}
      {fichier && (
        <div className="mt-4">
          <div className="lbl mb-1.5">Aperçu · <span className="mono normal-case tracking-normal text-ink">{fichier.nom}</span></div>
          <pre className="code overflow-auto whitespace-pre" style={{ display: 'block', maxHeight: 200, lineHeight: 1.65 }}>
            {fichier.apercu.split('\n').map((l, i) => <div key={i} style={{ color: i === 0 && !fichier.nom.endsWith('.json') ? 'var(--navy)' : undefined, fontWeight: i === 0 ? 600 : 400 }}>{l}</div>)}
            <span className="mu2">…</span>
          </pre>
        </div>
      )}
    </Card>
  )
}

function TableEditor({ dataset, onDone }: { dataset: string; onDone: () => void }) {
  const s = useStore()
  const tables = useApi(() => api.tables(dataset), [dataset])
  const [onglet, setOnglet] = useState('sites.csv')
  const [ed, setEd] = useState<Record<string, { entete: string[]; lignes: string[][] }>>({})
  const [modifies, setModifies] = useState<Set<string>>(new Set())
  const [rapport, setRapport] = useState<any>(null)
  useEffect(() => {
    if (!tables.data) return
    const m: typeof ed = {}
    Object.entries(tables.data).forEach(([k, t]) => { m[k] = { entete: t.entete, lignes: t.lignes.map(l => [...l.valeurs]) } })
    setEd(m)
  }, [tables.data])
  if (!tables.data || !ed[onglet]) return <Skeleton h={200} />
  const t = ed[onglet]
  const maj = (f: (x: string[][]) => string[][]) => { setEd(e => ({ ...e, [onglet]: { ...e[onglet], lignes: f(e[onglet].lignes) } })); setModifies(m => new Set(m).add(onglet)) }
  const exporter = async () => {
    const payload = Object.fromEntries([...modifies].map(k => [k, ed[k]]))
    try {
      const r = await api.newVersion(dataset, payload)
      setRapport(r)
      if (r.enregistre) { s.toast('ok', `Nouvelle version data/${r.nom} créée (original intact)`); s.refreshDatasets() }
      else s.toast('error', `${r.validation.errors.length} erreur(s) : version refusée`)
    } catch (e: any) { s.toast('error', e.message) }
  }
  return (
    <div>
      <div className="tabs">
        {FICHIERS.map(f => <button key={f} className={onglet === f ? 'on' : ''} onClick={() => setOnglet(f)}><span className="mono">{f}</span>{modifies.has(f) ? ' •' : ''}</button>)}
        <span className="flex-1" />
        <button className="btn btn-gh btn-sm" onClick={() => maj(l => [...l, t.entete.map(() => '')])}><Plus size={13} /> Ligne</button>
        <button className="btn btn-gh btn-sm ml-1.5" onClick={onDone}>Fermer l’éditeur</button>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 380 }}>
        <table className="tbl compact">
          <thead><tr><th>#</th>{t.entete.map(c => <th key={c}>{c}</th>)}<th /></tr></thead>
          <tbody>{t.lignes.slice(0, 400).map((l, i) => (
            <tr key={i}><td className="mu mono">{i + 2}</td>
              {l.map((v, j) => <td key={j} style={{ padding: 3 }}><input className="inp mono w-full" style={{ padding: '4px 7px', fontSize: 13 }} value={v} onChange={e => maj(ls => ls.map((r, k) => (k === i ? r.map((c, m) => (m === j ? e.target.value : c)) : r)))} /></td>)}
              <td><button className="mu hover:text-ink" onClick={() => maj(ls => ls.filter((_, k) => k !== i))} title="Supprimer la ligne"><Trash2 size={14} /></button></td></tr>
          ))}</tbody>
        </table>
        {t.lignes.length > 400 && <div className="caption p-2">Affichage limité aux 400 premières lignes.</div>}
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className="mu text-[13.5px]">{modifies.size} fichier(s) modifié(s). L’original n’est jamais modifié : un nouveau jeu <span className="mono">{dataset}_vN</span> est créé.</span>
        <button className="btn btn-pri ml-auto" disabled={!modifies.size} onClick={exporter}><Save size={15} />Re-valider et exporter</button>
      </div>
      {rapport && <div className="mt-3"><ValidationTable issues={[...rapport.validation.errors, ...rapport.validation.warnings]} /></div>}
    </div>
  )
}

function Preview({ dataset }: { dataset: string }) {
  const [f, setF] = useState('sites.csv')
  const [page, setPage] = useState(0)
  const [filtre, setFiltre] = useState('')
  const t = useApi<TablePage>(() => api.table(dataset, f, page * 20, 20, filtre), [dataset, f, page, filtre], { silent: true })
  useEffect(() => setPage(0), [f, filtre, dataset])
  return (
    <div>
      <div className="tabs">
        {FICHIERS.map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}><span className="mono">{x}</span></button>)}
        <span className="flex-1" />
        <input className="inp my-1" placeholder="Filtrer…" value={filtre} onChange={e => setFiltre(e.target.value)} style={{ width: 170 }} />
      </div>
      {t.data && (
        <>
          <div className="tbl-wrap" style={{ maxHeight: 420 }}>
            <table className="tbl compact"><thead><tr><th className="r">ligne</th>{t.data.entete.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{t.data.lignes.map(l => <tr key={l.ligne}><td className="r mu mono">{l.ligne}</td>{l.valeurs.map((v, j) => <td key={j} className="mono">{t.data!.entete[j] === 'type' && TYPE_COLOR[v] ? <span className="flex items-center gap-2"><i className="dot" style={{ background: TYPE_COLOR[v] }} />{v}</span> : v}</td>)}</tr>)}</tbody></table>
          </div>
          <div className="flex items-center gap-2 mt-3 text-[13.5px] mu">
            {t.data.total} ligne(s)
            <button className="btn btn-gh btn-sm ml-auto" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Précédent</button>
            <span className="mono">{page + 1} / {Math.max(1, Math.ceil(t.data.total / 20))}</span>
            <button className="btn btn-gh btn-sm" disabled={(page + 1) * 20 >= t.data.total} onClick={() => setPage(p => p + 1)}>Suivant →</button>
          </div>
        </>
      )}
    </div>
  )
}

function Import() {
  const s = useStore()
  const [nom, setNom] = useState('import_1')
  const [rapport, setRapport] = useState<any>(null)
  const [survol, setSurvol] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const envoyer = async (files: FileList | null) => {
    if (!files?.length) return
    const fd = new FormData()
    fd.append('nom', nom)
    Array.from(files).forEach(f => fd.append('fichiers', f))
    try {
      const r = await api.importDataset(fd)
      setRapport(r)
      if (r.enregistre) { s.toast('ok', `Jeu ${r.nom} importé`); s.refreshDatasets() }
      else s.toast('error', `Import refusé : ${r.validation.errors.length} erreur(s)`)
    } catch (e: any) { s.toast('error', e.message) }
  }
  return (
    <Card title={<><Upload size={18} /> Importer un jeu</>} sub="CSV ou .zip, validés avant enregistrement">
      <div className="text-center py-6 cursor-pointer rounded-[10px]" style={{ border: `1.5px dashed ${survol ? 'var(--navy)' : 'var(--rule-2)'}`, background: survol ? 'var(--navy-soft)' : 'var(--surface-2)' }} onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)} onDrop={e => { e.preventDefault(); setSurvol(false); envoyer(e.dataTransfer.files) }}>
        <Upload size={24} className="mx-auto mu" />
        <b className="block mt-1.5">Glisser-déposer ou cliquer</b>
        <input ref={input} type="file" multiple accept=".csv,.zip,.json" className="hidden" onChange={e => envoyer(e.target.files)} />
      </div>
      <div className="field mt-3">Nom du nouveau jeu<input className="inp mono" value={nom} onChange={e => setNom(e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
      {rapport && <div className="mt-3"><div className="mb-2 flex items-center gap-2">{rapport.enregistre ? <Pill kind="ok">✓ enregistré</Pill> : <Pill kind="ko">✗ refusé</Pill>} <span className="mu text-[13px]">{rapport.fichiers_recus.join(', ')}</span></div><ValidationTable issues={[...rapport.validation.errors, ...rapport.validation.warnings]} max={30} /></div>}
    </Card>
  )
}

export default function Data() {
  const s = useStore()
  const val = useApi(() => api.validate(s.dataset), [s.dataset])
  const schema = useApi(() => api.doc('SCHEMA.md'), [], { silent: true })
  const [edition, setEdition] = useState(false)
  const g = useGraph()
  const info = s.datasets.find(d => d.id === s.dataset)
  const issues = val.data ? [...val.data.errors, ...val.data.warnings] : []
  const onglet = s.param('tab') ?? 'jeux'
  const setOnglet = (t: string) => s.setParam('tab', t === 'jeux' ? null : t)

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[['jeux', 'Jeux fournis & validation'], ['studio', 'Générateur reproductible'], ['edition', 'Import, édition & scénarios'], ['format', 'Format des fichiers (SCHEMA.md)']].map(([k, l]) => (
          <button key={k} className={onglet === k ? 'on' : ''} onClick={() => setOnglet(k)}>{l}</button>
        ))}
      </div>

      {onglet === 'jeux' && (
        <div className="grid gap-5">
          <Card fig="Tableau 1 · sujet §2.4" title="Jeux de données fournis">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Jeu</th><th>Famille</th><th className="r">Sites</th><th className="r">Arcs</th><th className="r">Tronçons</th><th className="r">Demandes</th><th className="r">Scénarios</th><th className="r">Graine</th><th>Validation</th><th /></tr></thead>
                <tbody>{s.datasets.map(d => {
                  const f = FAMILLE[d.groupe ?? ''] ?? [d.groupe ?? 'autre', 'mu']
                  return (
                    <tr key={d.id} className={`cursor-pointer ${d.id === s.dataset ? 'sel' : ''}`} onClick={() => s.setDataset(d.id)}>
                      <td className="mono font-semibold">{d.id}</td>
                      <td><Pill kind={f[1]}>{f[0]}</Pill></td>
                      <td className="r">{d.fichiers?.['sites.csv'] ?? '—'}</td>
                      <td className="r">{d.fichiers?.['routes.csv'] ?? '—'}</td>
                      <td className="r">{d.fichiers?.['fibre.csv'] ?? '—'}</td>
                      <td className="r">{d.fichiers?.['demandes.csv'] ?? '—'}</td>
                      <td className="r">{d.scenarios?.length ?? '—'}</td>
                      <td className="r mono">{d.graine ?? '—'}</td>
                      <td>{d.erreurs ? <Pill kind="ko">{d.erreurs} erreur(s)</Pill> : d.avertissements ? <Pill kind="am">✓ {d.avertissements} avert.</Pill> : <Pill kind="ok">✓ valide</Pill>}</td>
                      <td className="r"><a className="btn btn-gh btn-sm" href={zipUrl(d.id)} onClick={e => e.stopPropagation()} title="Télécharger (.zip)"><Download size={13} /></a></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {FICHIERS.map(f => {
              const st = info?.statut_fichiers?.[f]
              return (
                <div key={f} className="fileC">
                  <div className="flex items-center gap-2"><FileText size={17} color="var(--navy)" /><span className="mono font-semibold text-[14px]">{f}</span>
                    <span className="ml-auto">{st === 'ok' ? <Pill kind="ok">✓</Pill> : st === 'avertissement' ? <Pill kind="am">⚠</Pill> : st === 'erreur' ? <Pill kind="ko">✗</Pill> : null}</span></div>
                  <div className="big mt-2" title={`Colonnes : ${COLS[f]}`}>{info?.fichiers?.[f] ?? '—'}<small>lignes</small></div>
                  <a className="link text-[13px] mt-1.5 inline-block" href={fileUrl(s.dataset, f)}>↓ télécharger</a>
                </div>
              )
            })}
          </div>

          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card fig="Validateur" title={<>Rapport de validation · <span className="mono text-[17px]">{s.dataset}</span></>}
              right={val.data && <><Pill kind={val.data.errors.length ? 'ko' : 'ok'}>{val.data.errors.length} erreur(s)</Pill><Pill kind={val.data.warnings.length ? 'am' : 'mu'}>{val.data.warnings.length} avertissement(s)</Pill>
                <button className={`btn btn-sm ${edition ? 'btn-on' : 'btn-gh'}`} onClick={() => setEdition(e => !e)}><Pencil size={13} />{edition ? 'Aperçu' : 'Éditer'}</button></>}>
              {val.error && <ErrorBox error={val.error} />}
              {val.data ? <ValidationTable issues={issues} /> : <Skeleton h={80} />}
              <div className="mt-5">{edition ? <TableEditor dataset={s.dataset} onDone={() => setEdition(false)} /> : <Preview dataset={s.dataset} />}</div>
            </Card>
            <div className="grid gap-5 content-start">
              <Callout kind="def" title="Règles vérifiées (§2.3)">
                <ul className="list-disc ml-5 space-y-1">
                  <li>colonnes obligatoires, identifiants <b>uniques</b></li>
                  <li>site inexistant → <b>ligne rejetée</b> avec message</li>
                  <li>temps et coûts <b>≥ 0</b> (sauf tests M3)</li>
                  <li>un scénario <b>ne modifie jamais</b> la base</li>
                </ul>
              </Callout>
            </div>
          </div>
        </div>
      )}

      {onglet === 'studio' && <Studio />}

      {onglet === 'edition' && (
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card title={<><Wand2 size={18} /> Scénarios du jeu <span className="mono text-[16px]">{s.dataset}</span></>}>
              <div className="flex flex-wrap gap-2">{(info?.scenarios ?? []).map(x => <span key={x} className="chip">{x}</span>)}</div>
            </Card>
            <Import />
          </div>
          {g.data && <ScenarioBuilder graph={g.data} />}
        </div>
      )}

      {onglet === 'format' && (
        <Card fig="Documentation" title={<><FileText size={18} /> data/SCHEMA.md — description des champs</>}>
          {schema.data ? <div className="max-w-[1100px]"><Markdown text={schema.data} /></div> : <div className="mu">SCHEMA.md introuvable.</div>}
        </Card>
      )}
    </div>
  )
}
