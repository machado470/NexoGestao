import { useEffect, useState } from 'react'
import {
  listPeople,
  type PersonSummary,
} from '../services/persons'

export function usePersons() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PersonSummary[]>([])

  async function load() {
    setLoading(true)
    try {
      const people = await listPeople()
      setData(people)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return {
    loading,
    data,
    reload: load,
  }
}
