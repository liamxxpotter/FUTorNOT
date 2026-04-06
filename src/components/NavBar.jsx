import { useState } from 'react'

const TABS = [
  { id: 'vote',        label: '⚽ Vote' },
  { id: 'leaderboard', label: '🏆 Leaderboard' },
  { id: 'profile',     label: '🎧 My Taste' },
]

export default function NavBar({ view, onSwitch }) {
  const [menuOpen, setMenuOpen] = useState(false)

  function navigate(v) {
    onSwitch(v)
    setMenuOpen(false)
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-fut">FUT</span>
        <span className="brand-or">or</span>
        <span className="brand-not">NOT</span>
      </div>

      {/* Desktop: inline tab buttons */}
      <div className="navbar-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${view === t.id ? 'active' : ''}`}
            onClick={() => navigate(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: hamburger toggle */}
      <button
        className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Mobile: dropdown menu */}
      {menuOpen && (
        <div className="nav-menu">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-menu-item ${view === t.id ? 'active' : ''}`}
              onClick={() => navigate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
