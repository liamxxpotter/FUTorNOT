import { useState, useEffect, useRef } from 'react'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useGameRankings } from '../hooks/useGameRankings'
import { useControversial } from '../hooks/useControversial'
import { useUpsets } from '../hooks/useUpsets'
import { useSparklines } from '../hooks/useSparklines'
import Sparkline from './Sparkline'

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function SongsTab() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const isSearching = debouncedSearch.trim().length > 0

  // Reset to page 0 whenever search changes
  const prevSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      setPage(0)
      prevSearch.current = debouncedSearch
    }
  }, [debouncedSearch])

  const { songs, loading, total, error, pageSize } = useLeaderboard(page, debouncedSearch)
  const sparklines = useSparklines(songs.map(s => s.id))

  const totalPages = Math.ceil(total / pageSize)
  const globalOffset = page * pageSize

  return (
    <>
      {/* Search bar */}
      <div className="search-wrap">
        <span className="search-icon">🔍</span>
        <input
          className="search-input"
          type="text"
          placeholder="Search by song or artist…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search songs"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
        )}
      </div>

      {loading ? (
        <div className="arena-state"><div className="spinner" /><p>Loading rankings…</p></div>
      ) : error ? (
        <div className="arena-state arena-state--error"><p>Error: {error}</p></div>
      ) : songs.length === 0 ? (
        <div className="arena-state"><p>No songs found for "{debouncedSearch}"</p></div>
      ) : (
        <>
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Song</th>
                  <th>Artist</th>
                  <th>Game</th>
                  <th>ELO</th>
                  <th>Matches</th>
                  <th className="sparkline-th">Trend</th>
                </tr>
              </thead>
              <tbody>
                {songs.map((song, i) => {
                  const rank = isSearching ? null : globalOffset + i
                  const isPodium = !isSearching && page === 0 && i < 3
                  return (
                    <tr key={song.id} className={isPodium ? 'row-podium' : ''}>
                      <td className="rank-cell">
                        {isPodium && i === 0 && <span className="medal">🥇</span>}
                        {isPodium && i === 1 && <span className="medal">🥈</span>}
                        {isPodium && i === 2 && <span className="medal">🥉</span>}
                        {!isPodium && <span className="rank-num">{rank != null ? rank + 1 : '—'}</span>}
                      </td>
                      <td className="title-cell">
                        {song.title}
                        {song.is_volta && <span className="badge badge-volta badge-sm">VOLTA</span>}
                      </td>
                      <td className="artist-cell">{song.artist}</td>
                      <td><span className="badge badge-year badge-sm">FIFA {song.fifa_year}</span></td>
                      <td className="elo-cell">{Math.round(song.elo)}</td>
                      <td className="matches-cell">{song.match_count}</td>
                      <td className="sparkline-cell">
                        <Sparkline values={sparklines.get(song.id)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!isSearching && totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
              <span className="page-indicator">{page + 1} / {totalPages}</span>
              <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next →</button>
            </div>
          )}

          {isSearching && (
            <p className="search-result-count">{total} result{total !== 1 ? 's' : ''}</p>
          )}
        </>
      )}
    </>
  )
}

function GamesTab() {
  const { games, loading, error } = useGameRankings()

  if (loading) return <div className="arena-state"><div className="spinner" /><p>Loading game rankings…</p></div>
  if (error)   return <div className="arena-state arena-state--error"><p>Error: {error}</p></div>

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Soundtrack</th>
            <th>Avg ELO</th>
            <th>Songs</th>
            <th>Matches</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={`${g.fifa_year}-${g.is_volta}`} className={i < 3 ? 'row-podium' : ''}>
              <td className="rank-cell">
                {i === 0 && <span className="medal">🥇</span>}
                {i === 1 && <span className="medal">🥈</span>}
                {i === 2 && <span className="medal">🥉</span>}
                {i >= 3  && <span className="rank-num">{i + 1}</span>}
              </td>
              <td className="title-cell">
                <span className="badge badge-year" style={{fontSize:'0.85rem', padding:'0.25rem 0.65rem'}}>
                  FIFA {g.fifa_year}
                </span>
                {g.is_volta && <span className="badge badge-volta badge-sm">VOLTA</span>}
              </td>
              <td className="elo-cell">{Math.round(g.avg_elo)}</td>
              <td className="matches-cell">{g.song_count}</td>
              <td className="matches-cell">{g.total_matches}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ControversialTab() {
  const { songs, loading, error } = useControversial()

  if (loading) return <div className="arena-state"><div className="spinner" /><p>Crunching the numbers…</p></div>
  if (error)   return <div className="arena-state arena-state--error"><p>Error: {error}</p></div>
  if (songs.length === 0) return <div className="arena-state"><p>Not enough data yet — cast more votes!</p></div>

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Song</th>
            <th>Artist</th>
            <th>Game</th>
            <th>ELO</th>
            <th>Matches</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song, i) => (
            <tr key={song.id}>
              <td className="rank-cell"><span className="rank-num">{i + 1}</span></td>
              <td className="title-cell">
                {song.title}
                {song.is_volta && <span className="badge badge-volta badge-sm">VOLTA</span>}
              </td>
              <td className="artist-cell">{song.artist}</td>
              <td><span className="badge badge-year badge-sm">FIFA {song.fifa_year}</span></td>
              <td className="elo-cell">{Math.round(song.elo)}</td>
              <td className="matches-cell">{song.match_count}</td>
              <td className="controversy-cell">{song.controversy_score.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UpsetsTab() {
  const { upsets, loading, error } = useUpsets()

  if (loading) return <div className="arena-state"><div className="spinner" /><p>Loading upsets…</p></div>
  if (error)   return <div className="arena-state arena-state--error"><p>Error: {error}</p></div>
  if (upsets.length === 0) return (
    <div className="arena-state">
      <p>No upsets recorded yet.</p>
      <p className="arena-sub">New votes will populate this feed.</p>
    </div>
  )

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Winner</th>
            <th style={{ textAlign: 'center' }}>beat</th>
            <th>Loser</th>
            <th>Upset By</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {upsets.map((u) => (
            <tr key={u.vote_id}>
              <td className="title-cell">
                <div>{u.winner_title}</div>
                <div className="artist-cell" style={{ fontSize: '0.8rem' }}>{u.winner_artist}</div>
                <div className="upset-elo-before">{Math.round(u.winner_elo_before)} ELO</div>
              </td>
              <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 700 }}>⚡</td>
              <td className="title-cell">
                <div>{u.loser_title}</div>
                <div className="artist-cell" style={{ fontSize: '0.8rem' }}>{u.loser_artist}</div>
                <div className="upset-elo-before">{Math.round(u.loser_elo_before)} ELO</div>
              </td>
              <td className="upset-margin">+{Math.round(u.upset_margin)}</td>
              <td className="upset-time">{timeAgo(u.voted_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Leaderboard() {
  const [tab, setTab] = useState('songs')

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h2 className="leaderboard-title">Rankings</h2>
        <div className="leaderboard-tabs">
          <button className={`lb-tab ${tab === 'songs' ? 'active' : ''}`} onClick={() => setTab('songs')}>
            🎵 Songs
          </button>
          <button className={`lb-tab ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
            🎮 By Game
          </button>
          <button className={`lb-tab ${tab === 'controversial' ? 'active' : ''}`} onClick={() => setTab('controversial')}>
            🤔 Controversial
          </button>
          <button className={`lb-tab ${tab === 'upsets' ? 'active' : ''}`} onClick={() => setTab('upsets')}>
            ⚡ Upsets
          </button>
        </div>
      </div>

      {tab === 'songs'         && <SongsTab />}
      {tab === 'games'         && <GamesTab />}
      {tab === 'controversial' && <ControversialTab />}
      {tab === 'upsets'        && <UpsetsTab />}
    </div>
  )
}
