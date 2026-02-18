import { AuditEvent, Person } from '@prisma/client'

export type TimelineItem = {
  id: string
  action: string
  title: string
  description?: string | null
  context?: string | null
  createdAt: Date
  personName?: string | null
}

export function presentAuditEvent(
  event: AuditEvent & { person?: Pick<Person, 'name'> | null },
): TimelineItem {
  const text = event.context ?? null

  return {
    id: event.id,
    action: event.action,
    title: humanizeAction(event.action),
    description: text,
    context: text,
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
    case 'TRACK_ARCHIVED':
      return 'Trilha arquivada'
    case 'PERSON_CREATED':
      return 'Pessoa criada'
    case 'CUSTOMER_CREATED':
      return 'Cliente criado'
    case 'CUSTOMER_UPDATED':
      return 'Cliente atualizado'
    case 'OPERATIONAL_STATE_CHANGED':
      return 'Estado operacional alterado'
    case 'OPERATIONAL_WARNING_RAISED':
      return 'Alerta operacional gerado'
    default:
      return action.replace(/_/g, ' ').toLowerCase()
  }
}
