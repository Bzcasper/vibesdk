import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="p-8">Listing Factory - Coming Soon</div>} />
      </Routes>
    </Router>
  )
}
