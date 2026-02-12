import api from './api'

/**
 * 📜 Evento de auditoria (fonte da verdade)
 * Alinhado com TimelineService + presenter do backend
 */
export type AuditEvent = {
  id: string
  action: string
  context?: string | null
  createdAt: string
  personName?: string | null
}

/**
 * 📜 Timeline global (admin)
 */
export async function getGlobalTimeline(): Promise<AuditEvent[]> {
  const { data } = await api.get('/timeline')
  return data
}

/**
 * 👤 Timeline por pessoa (admin / detalhe)
 */
export async function getPersonTimeline(
  personId: string,
): Promise<AuditEvent[]> {
  const { data } = await api.get(
    `/timeline/person/${personId}`,
  )
  return data
}
