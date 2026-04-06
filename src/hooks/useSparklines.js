import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useSparklines(songIds) {
  const [sparklines, setSparklines] = useState(new Map())

  useEffect(() => {
    if (!songIds || songIds.length === 0) return

    async function fetch() {
      const { data, error } = await supabase
        .from('elo_snapshots')
        .select('song_id, elo, snapped_at')
        .in('song_id', songIds)
        .order('snapped_at', { ascending: true })

      if (error || !data) return

      // Group into Map<songId, number[]>
      const map = new Map()
      for (const row of data) {
        if (!map.has(row.song_id)) map.set(row.song_id, [])
        map.get(row.song_id).push(Number(row.elo))
      }
      setSparklines(map)
    }

    fetch()
  }, [songIds.join(',')])  // re-fetch only when the set of IDs changes

  return sparklines
}
