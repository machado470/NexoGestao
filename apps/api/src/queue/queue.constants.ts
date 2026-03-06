export const QUEUE_NAMES = {
  AUTOMATION: 'automation',
  NOTIFICATIONS: 'notifications',
  WHATSAPP: 'whatsapp',
  FINANCE: 'finance',
  WEBHOOKS: 'webhooks',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

export const QUEUE_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1_000,
  },
  removeOnComplete: true,
}

export const QUEUE_CONNECTION = 'QUEUE_CONNECTION'
