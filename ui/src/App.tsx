import { motion } from 'framer-motion'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CommandPalette, DemoBar, Footer, Sidebar, TopBar } from './components/Shell'
import { ErrorBox, Toasts } from './components/ui'
import { StoreProvider } from './lib/store'
import Access from './pages/Access'
import Bench from './pages/Bench'
import Data from './pages/Data'
import Fibre from './pages/Fibre'
import NegCycles from './pages/NegCycles'
import Overview from './pages/Overview'
import Repro from './pages/Repro'
import RoutesPage from './pages/Routes'
import Scenarios from './pages/Scenarios'
import Team from './pages/Team'

/** Une erreur de rendu ne doit jamais donner une page blanche. */
class Garde extends Component<{ children: ReactNode; cle: string }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  componentDidUpdate(p: { cle: string }) { if (p.cle !== this.props.cle && this.state.err) this.setState({ err: null }) }
  render() { return this.state.err ? <ErrorBox error={`Erreur d'affichage : ${this.state.err}`} onRetry={() => this.setState({ err: null })} /> : this.props.children }
}

function Layout() {
  const loc = useLocation()
  const [palette, setPalette] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [])
  return (
    <div className="grid h-full overflow-hidden" style={{ gridTemplateColumns: 'auto minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="grid min-w-0 min-h-0 h-full" style={{ gridTemplateRows: '58px minmax(0, 1fr) 30px' }}>
        <TopBar onPalette={() => setPalette(true)} />
        <main className="overflow-auto min-h-0" style={{ padding: '20px 22px 28px' }}>
          <motion.div key={loc.pathname} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              <Garde cle={loc.pathname}>
                <Routes location={loc}>
                  <Route path="/" element={<Overview />} />
                  <Route path="/donnees" element={<Data />} />
                  <Route path="/accessibilite" element={<Access />} />
                  <Route path="/itineraires" element={<RoutesPage />} />
                  <Route path="/circuits" element={<NegCycles />} />
                  <Route path="/fibre" element={<Fibre />} />
                  <Route path="/scenarios" element={<Scenarios />} />
                  <Route path="/benchmarks" element={<Bench />} />
                  <Route path="/reproductibilite" element={<Repro />} />
                  <Route path="/equipe" element={<Team />} />
                  <Route path="*" element={<Overview />} />
                </Routes>
              </Garde>
          </motion.div>
        </main>
        <Footer />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <DemoBar />
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <Layout />
      </StoreProvider>
    </HashRouter>
  )
}
