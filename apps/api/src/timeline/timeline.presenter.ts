import { AuditEvent, Person } from '@prisma/client'

export type TimelineItem = {
  id: string
  title: string
  description?: string | null
  createdAt: Date
  personName?: string | null
}

export function presentAuditEvent(
  event: AuditEvent & { person?: Pick<Person, 'name'> | null },
): TimelineItem {
  return {
    id: event.id,
    title: humanizeAction(event.action),
    description: event.context ?? null,
    createdAt: event.createdAt,
    personName: event.person?.name ?? null,
  }
}

function humanizeAction(action: string): string {
  switch (action) {
    case 'ASSIGNMENT_STARTED':
      return 'Trilha iniciada'
    case 'ASSIGNMENT_COMPLETED':
      return 'Trilha concluída'
    case 'TRACK_CREATED':
      return 'Trilha criada'
    case 'TRACK_PUBLISHED':
      return 'Trilha publicada'
    case 'CORRECTIVE_ACTION_RESOLVED':
      return 'Ação corretiva resolvida'
    case 'CORRECTIVE_REGIME_CLOSED':
      return 'Regime corretivo encerrado'
    case 'CORRECTIVE_REGIME_REOPENED':
      return 'Regime corretivo reaberto'
    default:
      return action.replace(/_/g, ' ').toLowerCase()
  }
}
