import { useEffect, useState } from 'react'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import EventTimeline from '../../components/base/EventTimeline'
import { getPersonTimeline } from '../../services/timeline'
import type { AuditEvent } from '../../services/timeline'
import api from '../../services/api'

type Person = {
  id: string
  name: string
}

export default function Audit() {
  const [people, setPeople] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] =
    useState<string | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)

  async function loadPeople() {
    const res = await api.get('/people')
    setPeople(res.data.data)
  }

  async function loadTimeline(personId: string) {
    setLoading(true)
    const timeline = await getPersonTimeline(personId)
    setEvents(timeline)
    setLoading(false)
  }

  useEffect(() => {
    loadPeople()
  }, [])

  useEffect(() => {
    if (selectedPerson) {
      loadTimeline(selectedPerson)
    }
  }, [selectedPerson])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Auditoria"
        description="Linha do tempo auditável de decisões, eventos e impactos de risco."
      />

      <Card>
        <div className="mb-4">
          <label className="block text-sm mb-1">
            Pessoa
          </label>

          <select
            className="bg-white/5 rounded px-3 py-2 text-sm w-full"
            value={selectedPerson ?? ''}
            onChange={e =>
              setSelectedPerson(e.target.value)
            }
          >
            <option value="">
              Selecione uma pessoa
            </option>

            {people.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {!selectedPerson && (
          <div className="text-sm text-slate-400">
            Selecione uma pessoa para visualizar a auditoria completa.
          </div>
        )}

        {loading && (
          <div className="text-sm text-slate-400">
            Carregando auditoria…
          </div>
        )}

        {!loading && selectedPerson && (
          <EventTimeline events={events} />
        )}
      </Card>
    </div>
  )
}
