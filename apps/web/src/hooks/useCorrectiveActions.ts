import { useCallback, useEffect, useState } from 'react'
import {
  getCorrectiveActionsByPerson,
  type CorrectiveAction,
} from '../services/correctiveActions'

export function useCorrectiveActions(personId?: string) {
  const [actions, setActions] = useState<CorrectiveAction[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!personId) return

    setLoading(true)
    getCorrectiveActionsByPerson(personId)
      .then(setActions)
      .finally(() => setLoading(false))
  }, [personId])

  useEffect(() => {
    load()
  }, [load])

  return {
    actions,
    loading,
    reload: load,
  }
}
