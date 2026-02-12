import { useEffect, useState } from 'react'
import api from '../services/api'

export function useMe() {
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe(null))
      .finally(() => setLoading(false))
  }, [])

  return { me, loading }
}
