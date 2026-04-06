import { useMyTaste } from '../hooks/useMyTaste'

function StatCard({ value, label }) {
  return (
    <div className="taste-stat-card">
      <div className="taste-stat-value">{value}</div>
      <div className="taste-stat-label">{label}</div>
    </div>
  )
}

export default function MyTaste() {
  const { stats, hasEnoughData, voteCount, loading, error } = useMyTaste()

  if (loading) {
    return (
      <div className="arena-state">
        <div className="spinner" />
        <p>Loading your taste profile…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="arena-state arena-state--error">
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!hasEnoughData) {
    return (
      <div className="my-taste">
        <div className="my-taste-header">
          <h2 className="leaderboard-title">🎧 Your Taste</h2>
          <p className="leaderboard-sub">Your personal FIFA soundtrack profile</p>
        </div>
        <div className="arena-state">
          <p style={{ fontSize: '2.5rem' }}>🎵</p>
          <p>Vote on at least <strong style={{ color: 'var(--green)' }}>10 songs</strong> to unlock your taste profile.</p>
          <p className="arena-sub">
            {voteCount > 0
              ? `You've voted ${voteCount} time${voteCount !== 1 ? 's' : ''} — ${10 - voteCount} more to go!`
              : 'Head to the Vote tab to get started.'}
          </p>
        </div>
      </div>
    )
  }

  const maxWinRate = Math.max(...stats.year_breakdown.map((y) => y.win_rate), 1)

  return (
    <div className="my-taste">
      <div className="my-taste-header">
        <h2 className="leaderboard-title">🎧 Your Taste</h2>
        <p className="leaderboard-sub">Based on {stats.total_votes} votes this session</p>
      </div>

      {/* Stat cards */}
      <div className="taste-stats-grid">
        <StatCard value={stats.total_votes} label="Votes Cast" />
        <StatCard
          value={stats.favourite_year ? `FIFA ${stats.favourite_year}` : '—'}
          label="Favourite Soundtrack"
        />
      </div>

      {/* Top 10 */}
      <h3 className="taste-section-title">Your Top 10</h3>
      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Song</th>
              <th>Artist</th>
              <th>Game</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>
            {stats.top_songs.map((song, i) => (
              <tr key={song.id} className={i < 3 ? 'row-podium' : ''}>
                <td className="rank-cell">
                  {i === 0 && <span className="medal">🥇</span>}
                  {i === 1 && <span className="medal">🥈</span>}
                  {i === 2 && <span className="medal">🥉</span>}
                  {i >= 3  && <span className="rank-num">{i + 1}</span>}
                </td>
                <td className="title-cell">
                  {song.title}
                  {song.is_volta && <span className="badge badge-volta badge-sm">VOLTA</span>}
                </td>
                <td className="artist-cell">{song.artist}</td>
                <td><span className="badge badge-year badge-sm">FIFA {song.fifa_year}</span></td>
                <td className="elo-cell">{song.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Win rate by year */}
      <h3 className="taste-section-title">Win Rate by Soundtrack</h3>
      <div className="year-bars">
        {stats.year_breakdown.map((y) => (
          <div key={y.year} className="year-bar-row">
            <span className="badge badge-year" style={{ minWidth: '72px', justifyContent: 'center' }}>
              FIFA {y.year}
            </span>
            <div className="year-bar-track">
              <div
                className="year-bar-fill"
                style={{ width: `${(y.win_rate / maxWinRate) * 100}%` }}
              />
            </div>
            <span className="year-bar-pct">{y.win_rate}%</span>
            <span className="year-bar-detail">{y.wins}W / {y.plays - y.wins}L</span>
          </div>
        ))}
      </div>
    </div>
  )
}
