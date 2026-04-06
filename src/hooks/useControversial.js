import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useControversial() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      // Fetch songs with enough matches to be statistically meaningful
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, fifa_year, is_volta, elo, match_count')
        .gte('match_count', 5)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Sort by closeness to 1500 (most polarising = ELO stuck near baseline despite many matches)
      const sorted = [...data].sort(
        (a, b) => Math.abs(a.elo - 1500) - Math.abs(b.elo - 1500)
      )

      const top = sorted.slice(0, 50).map((s) => ({
        ...s,
        // Higher score = more controversial: many matches but ELO still near 1500
        controversy_score: s.match_count / (1 + Math.abs(s.elo - 1500)),
      }))

      setSongs(top)
      setLoading(false)
    }
    fetch()
  }, [])

  return { songs, loading, error }
}
