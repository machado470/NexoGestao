export type TenantFactStatus = 'available' | 'unavailable' | 'not_configured' | 'unknown'

type FactBase<Key extends string, Status extends TenantFactStatus = TenantFactStatus> = {
  key: Key
  status: Status
  observedAt: string
  reasonCode: string | null
}

export type ResourcesFact = FactBase<'resources', 'available' | 'unknown' | 'unavailable'> & {
  facts: {
    customersVolume: number | null
    customersUpdatedAt: string | null
    appointmentsVolume: number | null
    appointmentsUpdatedAt: string | null
    serviceOrdersVolume: number | null
    serviceOrdersUpdatedAt: string | null
    chargesVolume: number | null
    chargesUpdatedAt: string | null
    paymentsVolume: number | null
    paymentsUpdatedAt: string | null
  }
}

export type WhatsAppFact = FactBase<'whatsapp', 'unknown' | 'unavailable'> & {
  facts: { failedMessages: number | null }
}

export type WebhooksFact = FactBase<'webhooks', 'not_configured' | 'unknown' | 'unavailable'> & {
  facts: {
    configuredEndpoints: number | null
    activeEndpoints: number | null
    pendingDeliveries: number | null
    successfulDeliveries: number | null
    failedDeliveries: number | null
  }
}

export type BillingFact = FactBase<'billing', 'not_configured' | 'unknown' | 'unavailable'> & {
  facts: { subscriptionStatus: string | null }
}

export type OperationConfigFact = FactBase<'operation_config', 'available' | 'not_configured' | 'unknown' | 'unavailable'> & {
  facts: { executionMode: string | null; updatedAt: string | null }
}

export type TenantOperationalFact =
  | ResourcesFact
  | WhatsAppFact
  | WebhooksFact
  | BillingFact
  | OperationConfigFact

export interface TenantOperationsSummary {
  contractVersion: 1
  generatedAt: string
  facts: TenantOperationalFact[]
}
