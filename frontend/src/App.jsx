import { lazy, Suspense } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
// The graph library is only needed on roadmap pages, so it loads when one opens.
const Roadmap = lazy(() => import('./pages/Roadmap.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const Privacy = lazy(() => import('./pages/Privacy.jsx'))
const Contact = lazy(() => import('./pages/Contact.jsx'))
import NotFound from './pages/NotFound.jsx'
import Browse from './pages/Browse.jsx'
import LangChooser, { useLangBar } from './components/LangChooser.jsx'
import { LANGS, useLang } from './lib/i18n.jsx'
import ThemeMenu from './components/ThemeMenu.jsx'
import Logo from './components/Logo.jsx'
import SweepLink from './components/SweepLink.jsx'

export default function App() {
  const { lang, setLang, t } = useLang()
  // While the first-visit language bar is showing, the header picker is hidden so there is only one.
  const [barOpen, setBarOpen] = useLangBar()
  return (
    <div className="min-h-screen flex flex-col">
      <LangChooser open={barOpen} onClose={() => setBarOpen(false)} />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:text-on-accent focus:px-4 focus:py-3">{t.skip}</a>
      <header className="border-b border-ink/80 bg-paper">
        <nav className="max-w-6xl mx-auto px-4 min-h-16 py-2 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 min-h-11 min-w-0">
            <Logo />
            <span className="min-w-0 leading-tight">
              <span className="block font-display text-[1.15rem]">Civic Navigator</span>
              <span className="hidden sm:block text-[11px] text-muted truncate">{t.notGov}</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <label htmlFor="lang" className="sr-only">{t.language}</label>
            <span className={`relative items-center ${barOpen ? 'hidden' : 'flex'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="absolute left-2.5 text-muted pointer-events-none"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
              <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)}
                className="min-h-11 rounded-md border border-line bg-card pl-8 pr-2 text-sm max-w-[8.5rem]">
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}{l.beta ? ' (Beta)' : ''}</option>)}
              </select>
            </span>
            <ThemeMenu />
          </div>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Suspense fallback={<p className="max-w-6xl mx-auto px-4 py-12 text-muted" aria-busy="true">…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/task/:taskId" element={<Roadmap />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <footer className="border-t border-line text-xs text-muted">
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-2">
          <p>{t.disclaimer}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} Civic Navigator · TSEC Internal Hackathon</span>
            <SweepLink to="/privacy" className="hover:text-ink">{t.privacy}</SweepLink>
            <SweepLink to="/admin" className="hover:text-ink">{t.admin}</SweepLink>
            <SweepLink to="/contact" className="hover:text-ink">{t.contact}</SweepLink>
          </p>
        </div>
      </footer>
    </div>
  )
}
