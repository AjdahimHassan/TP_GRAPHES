// Page 2 — Données & validation : studio de génération, fichiers, rapport de validation, éditeur, import.
import { Dice5, Download, FileText, Pencil, Plus, Save, Trash2, Upload, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import NetworkCanvas from '../components/NetworkCanvas'
import ScenarioBuilder from '../components/ScenarioBuilder'
import { Card, CodeLine, ErrorBox, Markdown, Pill, Seg, Skeleton, Stat } from '../components/ui'
import { ValidationTable } from '../components/widgets'
import { api, downloadGenerated, fileUrl, zipUrl } from '../lib/api'
import { bytes, fmt } from '../lib/format'
import { useGraph } from '../lib/hooks'
import { useApi, useStore } from '../lib/store'
import type { GenResult, Preset, TablePage } from '../lib/types'
import { TYPE_COLOR } from '../theme/tokens'

const FICHIERS = ['sites.csv', 'routes.csv', 'fibre.csv', 'demandes.csv', 'scenarios.csv']
const SCEN_GEN = [['fermeture_axe', 'Fermeture des ponts centraux'], ['panne_fibre', 'Panne fibre'], ['heure_pointe', 'Heure de pointe'], ['zone_travaux', 'Zone de travaux'], ['crue_nova', 'Crue de la Nova']]

function Num({ label, value, onChange, step = 1, disabled, color }: { label: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean; color?: string }) {
  return (
    <div className="field">
      <span>{color && <span style={{ color }}>● </span>}{label}</span>
      <input className="inp" type="number" step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}
function Slider({ label, value, min, max, step = 1, unit = '', onChange, disabled }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="field">{label}
      <div className="flex items-center gap-2"><input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} className="flex-1" />
        <span className="mono text-white text-right" style={{ minWidth: 54 }}>{fmt(value, step < 1 ? 2 : 0)}{unit}</span></div>
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
    <Card className="mb-3.5" style={{ borderColor: '#2A3A60' }}
      title={<span className="text-[14px] flex items-center gap-2"><Zap size={16} color="#FFB547" /> Studio de génération de jeux de données <Pill kind="in">synthétique</Pill></span>}
      right={<Seg value={preset} onChange={setPreset} options={(presets.data ?? []).map((p: Preset) => ({ v: p.id, l: p.label }))} />}>
      {!params ? <Skeleton h={300} /> : (
        <div className="grid gap-4" style={{ gridTemplateColumns: '330px 1fr 340px' }}>
          <div>
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <div className="field">Nom du jeu<input className="inp" value={params.nom} onChange={e => set('nom', e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
              <div className="field">Graine
                <div className="flex gap-1"><input className="inp flex-1" type="number" value={params.graine ?? 0} disabled={fixe} onChange={e => set('graine', Number(e.target.value))} />
                  <button className="btn btn-gh btn-sm" disabled={fixe} onClick={() => set('graine', Math.floor(Math.random() * 100000))} title="Graine aléatoire"><Dice5 size={13} /></button></div>
              </div>
              <Num label="Sites (total)" value={params.n_sites} disabled={fixe} onChange={v => set('n_sites', v)} />
              <Num label="Demandes" value={params.demandes} disabled={fixe} onChange={v => set('demandes', v)} />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2.5">
              <Num label="Casernes" value={params.casernes} color={TYPE_COLOR.caserne} disabled={fixe} onChange={v => set('casernes', v)} />
              <Num label="Hôpitaux" value={params.hopitaux} color={TYPE_COLOR.hopital} disabled={fixe} onChange={v => set('hopitaux', v)} />
              <Num label="Écoles" value={params.ecoles} color={TYPE_COLOR.ecole} disabled={fixe} onChange={v => set('ecoles', v)} />
              <Num label="Télécom" value={params.telecom} color={TYPE_COLOR.telecom} disabled={fixe} onChange={v => set('telecom', v)} />
            </div>
            <div className="grid gap-2">
              <Slider label="Degré moyen visé (densité)" value={params.degre_moyen} min={2} max={14} step={0.5} disabled={fixe} onChange={v => set('degre_moyen', v)} />
              <Slider label="Routes à sens unique" value={params.sens_unique_pct} min={0} max={40} unit=" %" disabled={fixe} onChange={v => set('sens_unique_pct', v)} />
              <div className="grid grid-cols-2 gap-2">
                <Slider label="Pointe min ×" value={params.pointe_min} min={1} max={2} step={0.05} disabled={fixe} onChange={v => set('pointe_min', v)} />
                <Slider label="Pointe max ×" value={params.pointe_max} min={1} max={3} step={0.05} disabled={fixe} onChange={v => set('pointe_max', v)} />
              </div>
              <Slider label="Arcs en travaux" value={params.travaux_pct} min={0} max={20} unit=" %" disabled={fixe} onChange={v => set('travaux_pct', v)} />
              <Slider label="Fibre interdite (zones inondables)" value={params.fibre_interdite_pct} min={0} max={30} unit=" %" disabled={fixe} onChange={v => set('fibre_interdite_pct', v)} />
              <div className="grid grid-cols-2 gap-2">
                <Num label="Coût fibre min (k€)" value={params.cout_min} disabled={fixe} onChange={v => set('cout_min', v)} />
                <Num label="Coût fibre max (k€)" value={params.cout_max} disabled={fixe} onChange={v => set('cout_max', v)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['P1', 'P2', 'P3'].map((l, k) => <Num key={l} label={`% ${l}`} value={params.priorites[k]} disabled={fixe} onChange={v => set('priorites', params.priorites.map((x: number, j: number) => (j === k ? v : x)))} />)}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap mt-2.5 text-[11.5px]">
              <label className="pill p-cy cursor-pointer"><input type="checkbox" disabled={fixe} checked={params.riviere} onChange={e => set('riviere', e.target.checked)} /> Rivière ·
                <input className="bg-transparent w-7 mono" type="number" min={1} value={params.ponts} disabled={fixe || !params.riviere} onChange={e => set('ponts', Number(e.target.value))} /> ponts</label>
              <label className="pill p-cy cursor-pointer"><input type="checkbox" disabled={fixe} checked={params.site_isole} onChange={e => set('site_isole', e.target.checked)} /> Site isolé (cas limite)</label>
              <label className="pill p-cy cursor-pointer"><input type="checkbox" disabled={fixe} checked={params.periph} onChange={e => set('periph', e.target.checked)} /> Périphérique</label>
              {SCEN_GEN.map(([k, l]) => (
                <label key={k} className="pill p-mu cursor-pointer"><input type="checkbox" disabled={fixe} checked={params.scenarios.includes(k)} onChange={e => set('scenarios', e.target.checked ? [...params.scenarios, k] : params.scenarios.filter((x: string) => x !== k))} /> {l}</label>
              ))}
              <span className={`pill ${params.poids_negatifs ? 'p-ko' : 'p-mu'}`} title="Uniquement dans les presets Test M3">{params.poids_negatifs ? '✓' : '+'} poids négatifs (test M3 uniquement)</span>
            </div>
          </div>

          <div className="min-w-0">
            {err && <ErrorBox error={err} />}
            {res?.carte ? (
              <NetworkCanvas sites={res.carte.sites} routes={res.carte.routes} fibre={res.carte.fibre} decor={res.carte.decor} height={330} plain={res.carte.sites.length > 1500}
                overlay={<div className="mapover" style={{ left: 10, bottom: 10 }}>{res.validation.ok ? <Pill kind="ok">✓ Validateur : 0 erreur{res.validation.warnings.length ? ` · ${res.validation.warnings.length} avert.` : ''}</Pill> : <Pill kind="ko">✗ {res.validation.errors.length} erreur(s)</Pill>}{loading && <span className="mu ml-2 text-[11px]">génération…</span>}</div>} />
            ) : <Skeleton h={330} />}
            {res && (
              <div className="grid grid-cols-6 gap-2 mt-2.5">
                <Stat v={res.stats.sites} l="sommets" /><Stat v={res.stats.arcs} l="arcs" /><Stat v={res.stats.troncons} l="tronçons" />
                <Stat v={fmt(res.stats.degre_moyen, 2)} l="degré moy." /><Stat v={res.stats.composantes_fibre} l="comp. fibre" /><Stat v={res.stats.nb_scc} l="CFC" />
              </div>
            )}
            {res && <div className="mt-2.5"><CodeLine cmd={res.commande} /></div>}
            <div className="mu2 text-[11px] mt-1.5">Même graine + mêmes paramètres → fichiers identiques octet par octet, depuis l'UI ou la CLI{res?.commande.includes('--params') ? ' (enregistrez les paramètres dans params.json)' : ''}. sha256 base <span className="mono">{res?.sha256_base.slice(0, 12)}…</span></div>
          </div>

          <div>
            <div className="mu text-[11px] uppercase tracking-[.8px] font-semibold mb-2">Fichiers générés</div>
            {(res?.fichiers ?? []).map(f => (
              <div key={f.nom} onClick={() => setApercu(f.nom)} className="flex items-center gap-2 px-2.5 py-[7px] rounded-[9px] mb-[5px] cursor-pointer border" style={{ background: f.nom === apercu ? '#141f3a' : '#0b1224', borderColor: f.nom === apercu ? '#2A3A60' : '#17213b' }}>
                <FileText size={14} color={f.nom.endsWith('.json') ? '#A78BFA' : '#2EE6D6'} />
                <span className="mono text-[12px]">{f.nom}</span>
                <span className="mu2 mono text-[10.5px] ml-auto">{f.lignes !== null ? `${f.lignes} lignes · ` : ''}{bytes(f.octets)}</span>
                <button className="btn btn-gh btn-sm" onClick={e => { e.stopPropagation(); downloadGenerated(preset, params, f.nom, f.nom) }}><Download size={11} /></button>
              </div>
            ))}
            <button className="btn btn-pri w-full justify-center mt-2" disabled={!res} onClick={() => downloadGenerated(preset, params, null, `${params.nom}.zip`)}><Download size={13} />Télécharger tout (.zip)</button>
            <button className="btn btn-gh w-full justify-center mt-1.5" disabled={!res?.validation.ok} onClick={() => enregistrer()}><Save size={13} />Enregistrer dans data/{params.nom} et sélectionner</button>
            {res?.existe && <div className="mu2 text-[11px] mt-1">⚠ data/{params.nom} existe déjà : confirmation demandée avant écrasement.</div>}
          </div>
        </div>
      )}
      {fichier && (
        <div className="mt-3.5">
          <div className="mu text-[11px] mb-1.5">Aperçu · <span className="mono text-white">{fichier.nom}</span></div>
          <pre className="code block overflow-auto whitespace-pre" style={{ display: 'block', maxHeight: 170, lineHeight: 1.6 }}>
            {fichier.apercu.split('\n').map((l, i) => <div key={i} style={{ color: i === 0 && !fichier.nom.endsWith('.json') ? '#FFB547' : undefined }}>{l}</div>)}
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
        {FICHIERS.map(f => <button key={f} className={onglet === f ? 'on' : ''} onClick={() => setOnglet(f)}>{f}{modifies.has(f) ? ' •' : ''}</button>)}
        <span className="flex-1" />
        <button onClick={() => maj(l => [...l, t.entete.map(() => '')])}><Plus size={12} className="inline" /> Ligne</button>
        <button onClick={onDone}>Fermer</button>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 360 }}>
        <table className="tbl">
          <thead><tr><th>#</th>{t.entete.map(c => <th key={c}>{c}</th>)}<th /></tr></thead>
          <tbody>{t.lignes.slice(0, 400).map((l, i) => (
            <tr key={i}><td className="mu2 mono">{i + 2}</td>
              {l.map((v, j) => <td key={j} style={{ padding: 2 }}><input className="inp w-full" style={{ padding: '3px 6px', fontSize: 11 }} value={v} onChange={e => maj(ls => ls.map((r, k) => (k === i ? r.map((c, m) => (m === j ? e.target.value : c)) : r)))} /></td>)}
              <td><button className="mu" onClick={() => maj(ls => ls.filter((_, k) => k !== i))}><Trash2 size={12} /></button></td></tr>
          ))}</tbody>
        </table>
        {t.lignes.length > 400 && <div className="mu2 text-[11px] p-2">Affichage limité aux 400 premières lignes.</div>}
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <span className="mu text-[11.5px]">{modifies.size} fichier(s) modifié(s). L'original n'est jamais modifié : un nouveau jeu <span className="mono">{dataset}_vN</span> est créé.</span>
        <button className="btn btn-pri ml-auto" disabled={!modifies.size} onClick={exporter}><Save size={13} />Re-valider et exporter</button>
      </div>
      {rapport && <div className="mt-2.5"><ValidationTable issues={[...rapport.validation.errors, ...rapport.validation.warnings]} /></div>}
    </div>
  )
}

function Preview({ dataset }: { dataset: string }) {
  const [f, setF] = useState('sites.csv')
  const [page, setPage] = useState(0)
  const [filtre, setFiltre] = useState('')
  const t = useApi<TablePage>(() => api.table(dataset, f, page * 25, 25, filtre), [dataset, f, page, filtre], { silent: true })
  useEffect(() => setPage(0), [f, filtre, dataset])
  return (
    <div>
      <div className="tabs">
        {FICHIERS.map(x => <button key={x} className={f === x ? 'on' : ''} onClick={() => setF(x)}>{x}</button>)}
        <span className="flex-1" />
        <input className="inp my-1" placeholder="Filtrer…" value={filtre} onChange={e => setFiltre(e.target.value)} style={{ width: 150 }} />
      </div>
      {t.data && (
        <>
          <div className="overflow-auto" style={{ maxHeight: 330 }}>
            <table className="tbl"><thead><tr><th>ligne</th>{t.data.entete.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{t.data.lignes.map(l => <tr key={l.ligne}><td className="mu2 mono">{l.ligne}</td>{l.valeurs.map((v, j) => <td key={j} className="mono">{t.data!.entete[j] === 'type' ? <><span style={{ color: TYPE_COLOR[v] }}>●</span> {v}</> : v}</td>)}</tr>)}</tbody></table>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[11.5px] mu">
            {t.data.total} ligne(s)
            <button className="btn btn-gh btn-sm ml-auto" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
            <span className="mono">{page + 1} / {Math.max(1, Math.ceil(t.data.total / 25))}</span>
            <button className="btn btn-gh btn-sm" disabled={(page + 1) * 25 >= t.data.total} onClick={() => setPage(p => p + 1)}>→</button>
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
    <Card style={{ border: `1px dashed ${survol ? '#FFB547' : '#3a4a75'}` }}>
      <div className="text-center py-3 cursor-pointer" onClick={() => input.current?.click()}
        onDragOver={e => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)} onDrop={e => { e.preventDefault(); setSurvol(false); envoyer(e.dataTransfer.files) }}>
        <Upload size={22} className="mx-auto mu" />
        <b className="block mt-1">Importer des CSV ou un .zip</b>
        <div className="mu text-[11.5px]">Glisser-déposer · le validateur s'exécute avant tout enregistrement</div>
        <input ref={input} type="file" multiple accept=".csv,.zip,.json" className="hidden" onChange={e => envoyer(e.target.files)} />
      </div>
      <div className="field mt-1">Nom du nouveau jeu<input className="inp" value={nom} onChange={e => setNom(e.target.value.replace(/[^A-Za-z0-9_-]/g, '_'))} /></div>
      {rapport && <div className="mt-2.5"><div className="mb-1.5">{rapport.enregistre ? <Pill kind="ok">✓ enregistré</Pill> : <Pill kind="ko">✗ refusé</Pill>} <span className="mu text-[11px]">{rapport.fichiers_recus.join(', ')}</span></div><ValidationTable issues={[...rapport.validation.errors, ...rapport.validation.warnings]} max={30} /></div>}
    </Card>
  )
}

export default function Data() {
  const s = useStore()
  const val = useApi(() => api.validate(s.dataset), [s.dataset])
  const schema = useApi(() => api.doc('SCHEMA.md'), [], { silent: true })
  const [edition, setEdition] = useState(false)
  const [builder, setBuilder] = useState(false)
  const g = useGraph()
  const info = s.datasets.find(d => d.id === s.dataset)
  const issues = val.data ? [...val.data.errors, ...val.data.warnings] : []
  const groupeLbl: Record<string, [string, string]> = { mini: ['vérifiable à la main', 'p-ok'], test: ['test M3', 'p-ko'], realiste: ['réaliste · synthétique', 'p-in'], generes: ['benchmarks', 'p-mu'] }
  return (
    <div>
      <Studio />
      <div className="grid grid-cols-5 gap-3.5 mb-3.5">
        {FICHIERS.map(f => {
          const st = info?.statut_fichiers?.[f]
          return (
            <div key={f} className="fileC">
              <div className="flex items-center gap-2"><FileText size={16} color="#8592AE" /><span className="mono font-semibold text-[12.5px]">{f}</span>
                <span className="ml-auto">{st === 'ok' ? <Pill kind="ok">✓ valide</Pill> : st === 'avertissement' ? <Pill kind="am">⚠ avert.</Pill> : st === 'erreur' ? <Pill kind="ko">✗ erreur</Pill> : null}</span></div>
              <div className="big mt-2 mb-0.5">{info?.fichiers?.[f] ?? '—'}<small className="mu text-[12px]"> lignes</small></div>
              <a className="mu2 text-[10.5px] mono hover:text-white" href={fileUrl(s.dataset, f)}>↓ télécharger</a>
            </div>
          )
        })}
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card title={<>Rapport de validation <span className="mu font-medium">· {s.dataset}</span></>}
          right={val.data && <><Pill kind={val.data.errors.length ? 'ko' : 'ok'}>{val.data.errors.length} erreur(s)</Pill><Pill kind="am">{val.data.warnings.length} avertissement(s)</Pill>
            <button className={`btn btn-sm ${edition ? 'btn-pri' : 'btn-gh'}`} onClick={() => setEdition(e => !e)}><Pencil size={11} />Éditer</button></>}>
          {val.error && <ErrorBox error={val.error} />}
          {val.data ? <ValidationTable issues={issues} /> : <Skeleton h={80} />}
          <div className="mt-4">{edition ? <TableEditor dataset={s.dataset} onDone={() => setEdition(false)} /> : <Preview dataset={s.dataset} />}</div>
        </Card>
        <div className="grid gap-3.5 content-start">
          <Import />
          <Card title="Jeux disponibles">
            {s.datasets.map(d => (
              <div key={d.id} className="flex items-center gap-2 py-[7px] border-b border-[#141d35] cursor-pointer" onClick={() => s.setDataset(d.id)}>
                <span className={`mono ${d.id === s.dataset ? 'text-amb' : ''}`}>{d.id}</span>
                <span className="mu2 mono text-[11px]">{d.fichiers?.['sites.csv'] ?? '?'} sites</span>
                <span className={`ml-auto pill ${groupeLbl[d.groupe ?? '']?.[1] ?? 'p-mu'}`}>{groupeLbl[d.groupe ?? '']?.[0] ?? d.groupe}</span>
                <a className="btn btn-gh btn-sm" href={zipUrl(d.id)} onClick={e => e.stopPropagation()} title="Télécharger (.zip)"><Download size={11} /></a>
              </div>
            ))}
          </Card>
          <Card title="Scénarios du jeu" right={<button className="btn btn-gh btn-sm" onClick={() => setBuilder(b => !b)}><Plus size={11} />Constructeur</button>}>
            <div className="flex flex-wrap gap-1.5">{(info?.scenarios ?? []).map(x => <span key={x} className="chip">{x}</span>)}</div>
            <div className="mu2 text-[11px] mt-2">Un scénario ajoute des lignes à scenarios.csv ; il ne modifie jamais sites, routes, fibre ni demandes.</div>
          </Card>
        </div>
      </div>
      {builder && g.data && <div className="mt-3.5"><ScenarioBuilder graph={g.data} onClose={() => setBuilder(false)} /></div>}
      <Card className="mt-3.5" title={<><FileText size={14} /> data/SCHEMA.md</>}>
        {schema.data ? <div className="overflow-auto" style={{ maxHeight: 420 }}><Markdown text={schema.data} /></div> : <div className="mu">SCHEMA.md introuvable.</div>}
      </Card>
    </div>
  )
}
