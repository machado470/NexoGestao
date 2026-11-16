import { Prisma, SubscriptionStatus } from '@prisma/client'

export type CommercialDecision =
  | { allowed: true }
  | { allowed: false; reasonCode: string; reasonMessage: string; policyType: 'commercial_block' }

/** Admission policy for quota-controlled creation, commercial meters and premium features.
 * Reads, billing recovery and provider reconciliation do not pass this boundary.
 * No grace period is inferred from an overdue subscription.
 */
export function subscriptionAccess(subscription: {
  status: SubscriptionStatus
  currentPeriodEnd: Date
} | null, now = new Date()): CommercialDecision {
  if (!subscription) return { allowed: true } // Existing FREE fallback.
  const blocked = (reasonCode: string, reasonMessage: string): CommercialDecision =>
    ({ allowed: false, policyType: 'commercial_block', reasonCode, reasonMessage })
  switch (subscription.status) {
    case SubscriptionStatus.ACTIVE: return { allowed: true }
    case SubscriptionStatus.TRIALING:
      return Number.isFinite(subscription.currentPeriodEnd?.getTime()) && subscription.currentPeriodEnd > now
        ? { allowed: true }
        : blocked('tenant_trial_expired', 'Trial expirado. Recurso restrito até atualizar o plano.')
    case SubscriptionStatus.SUSPENDED:
      return blocked('tenant_subscription_suspended', 'Assinatura suspensa por política comercial.')
    case SubscriptionStatus.CANCELED:
      return blocked('tenant_subscription_cancelled', 'Assinatura cancelada. Faça upgrade para reativar este recurso.')
    case SubscriptionStatus.PAST_DUE:
      return blocked('tenant_subscription_past_due', 'Assinatura com pagamento pendente.')
    default:
      return blocked('tenant_subscription_unavailable', 'Situação da assinatura indisponível. Tente novamente.')
  }
}

/** Same admission rule inside the atomic WhatsApp claim (cron and BullMQ).
 * Messages stay QUEUED while restricted; periodic recovery can resume after regularization.
 */
export function subscriptionAllowsDispatch(orgId: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "Subscription" commercial_subscription
    WHERE commercial_subscription."orgId" = ${orgId}
      AND NOT (
        commercial_subscription.status = 'ACTIVE'::"SubscriptionStatus"
        OR (commercial_subscription.status = 'TRIALING'::"SubscriptionStatus"
          AND commercial_subscription."currentPeriodEnd" > statement_timestamp())
      )
  )`
}
