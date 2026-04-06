import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useGameRankings() {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      // Pull all songs and aggregate client-side — simpler than a raw SQL RPC
      // and the dataset (604 rows) is small enough to do this comfortably.
      const { data, error } = await supabase
        .from('songs')
        .select('fifa_year, is_volta, elo, match_count')

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Group by (fifa_year, is_volta)
      const groups = {}
      for (const song of data) {
        const key = `${song.fifa_year}-${song.is_volta ? 'volta' : 'main'}`
        if (!groups[key]) {
          groups[key] = {
            fifa_year: song.fifa_year,
            is_volta: song.is_volta,
            elos: [],
            total_matches: 0,
          }
        }
        groups[key].elos.push(song.elo)
        groups[key].total_matches += song.match_count
      }

      const ranked = Object.values(groups).map((g) => ({
        fifa_year: g.fifa_year,
        is_volta: g.is_volta,
        song_count: g.elos.length,
        avg_elo: g.elos.reduce((a, b) => a + b, 0) / g.elos.length,
        top_elo: Math.max(...g.elos),
        total_matches: g.total_matches,
      }))

      ranked.sort((a, b) => b.avg_elo - a.avg_elo)
      setGames(ranked)
      setLoading(false)
    }
    fetch()
  }, [])

  return { games, loading, error }
}
