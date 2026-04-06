import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { getSessionId } from '../utils/session'

export function useMyTaste() {
  const [stats, setStats] = useState(null)
  const [hasEnoughData, setHasEnoughData] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      const sessionId = getSessionId()

      // Query 1: get all votes for this session
      const { data: votes, error: votesErr } = await supabase
        .from('votes')
        .select('winner_id, loser_id')
        .eq('session_id', sessionId)

      if (votesErr) {
        setError(votesErr.message)
        setLoading(false)
        return
      }

      setVoteCount(votes.length)

      if (votes.length < 10) {
        setHasEnoughData(false)
        setLoading(false)
        return
      }

      // Collect all unique song IDs
      const idSet = new Set()
      for (const v of votes) {
        idSet.add(v.winner_id)
        idSet.add(v.loser_id)
      }
      const allIds = [...idSet]

      // Query 2: fetch those songs
      const { data: songs, error: songsErr } = await supabase
        .from('songs')
        .select('id, title, artist, fifa_year, is_volta')
        .in('id', allIds)

      if (songsErr) {
        setError(songsErr.message)
        setLoading(false)
        return
      }

      // Build lookup map
      const songsById = {}
      for (const s of songs) songsById[s.id] = s

      // Single-pass aggregation
      const winCounts   = {}  // song id → wins
      const yearWins    = {}  // year → wins
      const yearPlays   = {}  // year → appearances

      for (const v of votes) {
        const winner = songsById[v.winner_id]
        const loser  = songsById[v.loser_id]

        // Win tally
        winCounts[v.winner_id] = (winCounts[v.winner_id] || 0) + 1

        // Year breakdown
        if (winner) {
          yearWins[winner.fifa_year]  = (yearWins[winner.fifa_year]  || 0) + 1
          yearPlays[winner.fifa_year] = (yearPlays[winner.fifa_year] || 0) + 1
        }
        if (loser) {
          yearPlays[loser.fifa_year] = (yearPlays[loser.fifa_year] || 0) + 1
        }
      }

      // Top 10 songs by wins (must appear in songsById)
      const top_songs = Object.entries(winCounts)
        .filter(([id]) => songsById[id])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, wins]) => ({ ...songsById[id], wins }))

      // Year breakdown sorted by win rate desc
      const year_breakdown = Object.entries(yearPlays)
        .map(([year, plays]) => ({
          year: Number(year),
          wins: yearWins[year] || 0,
          plays,
          win_rate: Math.round(((yearWins[year] || 0) / plays) * 100),
        }))
        .sort((a, b) => b.win_rate - a.win_rate)

      // Favourite year = most wins absolute
      const favourite_year = Object.entries(yearWins)
        .sort((a, b) => b[1] - a[1])[0]?.[0]

      setStats({
        total_votes: votes.length,
        favourite_year: favourite_year ? Number(favourite_year) : null,
        top_songs,
        year_breakdown,
      })
      setHasEnoughData(true)
      setLoading(false)
    }
    fetch()
  }, [])

  return { stats, hasEnoughData, voteCount, loading, error }
}
