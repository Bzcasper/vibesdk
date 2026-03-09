import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './app/routes/Dashboard'
import Inventory from './app/routes/Inventory'
import NewListing from './app/routes/NewListing'
import Enricher from './app/routes/Enricher'
import Platforms from './app/routes/platforms'
import Settings from './app/routes/settings'
import CSVBatches from './app/routes/csv-batches'

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: '📊 Dashboard' },
    { path: '/enrich', label: '✨ AI Enricher' },
    { path: '/inventory', label: '📦 Inventory' },
    { path: '/new', label: '➕ New Listing' },
    { path: '/platforms', label: '🌐 Platforms' },
    { path: '/batches', label: '📋 CSV Batches' },
    { path: '/settings', label: '⚙️ Settings' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">Listing Factory</h1>
          <p className="text-sm text-slate-600 mt-1">Jewelry Automation</p>
        </div>
        
        <nav className="p-4 space-y-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-4 py-2 rounded-lg transition ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {children}
      </div>
    </div>
  )
}

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/enrich" element={<Layout><Enricher /></Layout>} />
        <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
        <Route path="/new" element={<Layout><NewListing /></Layout>} />
        <Route path="/platforms" element={<Layout><Platforms /></Layout>} />
        <Route path="/batches" element={<Layout><CSVBatches /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </Router>
  )
}
