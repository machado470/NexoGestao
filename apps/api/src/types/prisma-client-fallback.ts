/* Fallback local para compilação/testes quando o Prisma Client gerado não está disponível. */
const makeEnum = <T extends string>(values: readonly T[]) =>
  Object.freeze(Object.fromEntries(values.map((value) => [value, value])) as Record<T, T>)

export const UserRole = makeEnum(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const)
export type UserRole = (typeof UserRole)[keyof typeof UserRole]
export const AppointmentStatus = makeEnum(['SCHEDULED', 'CONFIRMED', 'CANCELED', 'DONE', 'NO_SHOW'] as const)
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]
export const TrackStatus = makeEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'] as const)
export type TrackStatus = (typeof TrackStatus)[keyof typeof TrackStatus]
export const UsageMetricEvent: Record<string, string> = {}
export type UsageMetricEvent = string
export const PlanName = makeEnum(['FREE', 'STARTER', 'PRO', 'BUSINESS'] as const)
export type PlanName = (typeof PlanName)[keyof typeof PlanName]
export const SubscriptionStatus = makeEnum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INACTIVE'] as const)
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus]
export const BillingEventType = makeEnum(['CHARGE', 'PAYMENT', 'REFUND'] as const)
export type BillingEventType = (typeof BillingEventType)[keyof typeof BillingEventType]
export const BillingEventStatus = makeEnum(['PENDING', 'COMPLETED', 'FAILED'] as const)
export type BillingEventStatus = (typeof BillingEventStatus)[keyof typeof BillingEventStatus]
export const ServiceOrderStatus = makeEnum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELED'] as const)
export type ServiceOrderStatus = (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus]
export const ChargeStatus = makeEnum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED'] as const)
export type ChargeStatus = (typeof ChargeStatus)[keyof typeof ChargeStatus]
export const PaymentMethod = makeEnum(['PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER'] as const)
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]
export const NotificationType = makeEnum(['CHARGE_OVERDUE','SERVICE_OVERDUE','PAYMENT_RECEIVED','CUSTOMER_CREATED','INVITE_RECEIVED','TRIAL_ENDING','TRIAL_ENDED','APPOINTMENT_CONFIRMED','APPOINTMENT_NO_SHOW','SERVICE_ORDER_COMPLETED','PAYMENT_OVERDUE','RISK_LEVEL_CHANGED'] as const)
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]
export const OperationalStateValue = makeEnum(['NORMAL', 'WARNING', 'RESTRICTED', 'SUSPENDED'] as const)
export type OperationalStateValue = (typeof OperationalStateValue)[keyof typeof OperationalStateValue]
export const WhatsAppEntityType = makeEnum(['APPOINTMENT', 'SERVICE_ORDER', 'CHARGE'] as const)
export type WhatsAppEntityType = (typeof WhatsAppEntityType)[keyof typeof WhatsAppEntityType]
export const WhatsAppMessageStatus = makeEnum(['QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELED'] as const)
export type WhatsAppMessageStatus = (typeof WhatsAppMessageStatus)[keyof typeof WhatsAppMessageStatus]
export const WhatsAppMessageType = makeEnum(['APPOINTMENT_CONFIRMATION','REMIND_24H','PAYMENT_LINK','PAYMENT_REMINDER','RECEIPT','EXECUTION_CONFIRMATION'] as const)
export type WhatsAppMessageType = (typeof WhatsAppMessageType)[keyof typeof WhatsAppMessageType]

export const AutomationTrigger = makeEnum(['SERVICE_ORDER_COMPLETED','PAYMENT_OVERDUE','APPOINTMENT_CREATED'] as const)
export type AutomationTrigger = (typeof AutomationTrigger)[keyof typeof AutomationTrigger]
export const AutomationExecutionStatus = makeEnum(['PENDING','SKIPPED','SUCCESS','FAILED'] as const)
export type AutomationExecutionStatus = (typeof AutomationExecutionStatus)[keyof typeof AutomationExecutionStatus]
export const AutomationActionType = makeEnum(['SEND_WHATSAPP_MESSAGE','CREATE_CHARGE','CREATE_NOTIFICATION','UPDATE_RISK'] as const)
export type AutomationActionType = (typeof AutomationActionType)[keyof typeof AutomationActionType]

export type Person = { id: string; name: string } & Record<string, unknown>
export type AuditEvent = { id: string; action: string; context?: string | null; createdAt: Date; person?: Pick<Person, 'name'> | null } & Record<string, unknown>
export namespace $Enums {
  export type ChargeStatus = (typeof ChargeStatus)[keyof typeof ChargeStatus]
  export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]
}
export const $Enums = { ChargeStatus, PaymentMethod }

export namespace Prisma {
  export class PrismaClientKnownRequestError extends Error { code = 'P0000'; meta?: unknown }
  export class PrismaClientValidationError extends Error {}
}

export class PrismaClient {
  [key: string]: any
  $use(_middleware: (...args: any[]) => any): void {}
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  async $queryRaw<T = unknown>(..._args: unknown[]): Promise<T> {
    return undefined as T
  }

  async $executeRaw(..._args: unknown[]): Promise<number> {
    return 0
  }

  async $queryRawUnsafe<T = unknown>(..._args: unknown[]): Promise<T> {
    return undefined as T
  }
  async $transaction<T>(input: Promise<T>[]): Promise<T[]>
  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T>
  async $transaction<T>(input: Promise<T>[] | ((tx: this) => Promise<T>)): Promise<T | T[]> {
    if (typeof input === 'function') return input(this)
    return Promise.all(input)
  }
}
