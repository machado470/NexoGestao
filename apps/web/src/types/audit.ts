export type AuditEventType =
  | 'QUIZ_FAILED'
  | 'QUIZ_PASSED'
  | 'TRACK_BLOCKED'
  | 'TRACK_RESET_BY_ADMIN'
  | 'CERTIFICATE_ISSUED'

export type AuditEvent = {
  id: string
  trackId: string
  type: AuditEventType
  message: string
  createdAt: string
}
