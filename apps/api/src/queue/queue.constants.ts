export const QUEUE_NAMES = {
  AUTOMATION: 'automation',
  NOTIFICATIONS: 'notifications',
  WHATSAPP: 'whatsapp',
  WHATSAPP_DLQ: 'whatsapp-dlq',
  FINANCE: 'finance',
  WEBHOOKS: 'webhooks',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

export const WHATSAPP_QUEUE_JOB_NAMES = {
  DISPATCH_MESSAGE: 'dispatch-message',
  INBOUND_WEBHOOK: 'inbound-webhook',
  SEND_DLQ: 'whatsapp.send.dlq',
  INBOUND_WEBHOOK_DLQ: 'whatsapp.inbound-webhook.dlq',
} as const

export const QUEUE_DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1_000,
  },
  removeOnComplete: true,
}

export const QUEUE_CONNECTION = 'QUEUE_CONNECTION'
