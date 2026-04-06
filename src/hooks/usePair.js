import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { getSessionId } from '../utils/session'

export function usePair() {
  const [pair, setPair] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('get_pair', {
      p_session_id: getSessionId(),
    })
    if (error) {
      setError(error.message)
    } else {
      setPair(data && data.length >= 2 ? data : null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { pair, loading, error, refetch }
}
