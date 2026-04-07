import { useState } from 'react'
import NavBar from './components/NavBar'
import VoteArena from './components/VoteArena'
import Leaderboard from './components/Leaderboard'
import MyTaste from './components/MyTaste'
import About from './components/About'
import { isConfigured } from './supabaseClient'

function SetupBanner() {
  return (
    <div className="setup-banner">
      <div className="setup-card">
        <div className="setup-icon">⚙️</div>
        <h2>Connect Your Supabase Project</h2>
        <p>Create a <code>.env</code> file in the project root:</p>
        <pre className="setup-code">{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <ol className="setup-steps">
          <li>Create a Supabase project at <strong>supabase.com</strong></li>
          <li>Run the SQL migrations in <code>supabase/migrations/</code> in order</li>
          <li>Run the Python scraper to seed song data</li>
          <li>Add your credentials to <code>.env</code> and restart the dev server</li>
        </ol>
      </div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState('vote')

  return (
    <div className="app">
      <NavBar view={view} onSwitch={setView} />
      <main className="main-content">
        {!isConfigured ? (
          <SetupBanner />
        ) : view === 'vote' ? (
          <VoteArena />
        ) : view === 'leaderboard' ? (
          <Leaderboard />
        ) : view === 'about' ? (
          <About />
        ) : (
          <MyTaste />
        )}
      </main>
      <footer className="footer">
        <p className="footer-disclaimer">Not affiliated with or endorsed by EA Sports or FIFA.</p>
        <p>Song data from FIFA 08–23 soundtracks. Rankings powered by ELO.</p>
        <p>Built with ♥ in Sydney &mdash; <a href="https://github.com/liamxxpotter/FUTorNOT" target="_blank" rel="noopener noreferrer" className="footer-link">github.com/liamxxpotter/FUTorNOT</a></p>
      </footer>
    </div>
  )
}
