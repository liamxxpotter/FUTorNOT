import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export function useUpsets() {
  const [upsets, setUpsets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase.rpc('get_upsets')

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setUpsets(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { upsets, loading, error }
}
