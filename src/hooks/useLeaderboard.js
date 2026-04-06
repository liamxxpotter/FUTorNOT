import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const PAGE_SIZE = 25

export function useLeaderboard(page = 0, search = '') {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('songs')
        .select('id, title, artist, fifa_year, is_volta, elo, match_count', {
          count: search ? undefined : 'exact',
        })
        .order('elo', { ascending: false })

      if (search) {
        query = query
          .or(`title.ilike.%${search}%,artist.ilike.%${search}%`)
          .limit(50)
      } else {
        const from = page * PAGE_SIZE
        query = query.range(from, from + PAGE_SIZE - 1)
      }

      const { data, error, count } = await query

      if (error) {
        setError(error.message)
      } else {
        setSongs(data)
        setTotal(search ? data.length : count)
      }
      setLoading(false)
    }
    fetch()
  }, [page, search])

  return { songs, loading, total, error, pageSize: PAGE_SIZE }
}
