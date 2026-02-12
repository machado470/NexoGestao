import { useEffect, useState } from 'react'

import CollaboratorShell from '../../layouts/CollaboratorShell'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import EventTimeline from '../../components/base/EventTimeline'

import { getMe } from '../../services/me'
import { getPersonTimeline } from '../../services/timeline'
import type { AuditEvent } from '../../services/timeline'

export default function TimelinePage() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<AuditEvent[]>([])

  async function load() {
    setLoading(true)

    const me = await getMe()

    if (!me.user.personId) {
      setEvents([])
      setLoading(false)
      return
    }

    const timeline = await getPersonTimeline(
      me.user.personId,
    )

    setEvents(timeline)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <CollaboratorShell>
      <PageHeader
        title="Linha do tempo"
        description="Registro das suas ações e eventos"
      />

      {loading && (
        <p className="text-sm opacity-60">
          Carregando eventos…
        </p>
      )}

      {!loading && (
        <Card>
          <EventTimeline events={events} />
        </Card>
      )}
    </CollaboratorShell>
  )
}
