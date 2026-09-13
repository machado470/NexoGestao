import { Injectable } from '@nestjs/common'
import { DashboardService } from '../dashboard/dashboard.service'
import { PrismaService } from '../prisma/prisma.service'
import type {
  BillingFact,
  OperationConfigFact,
  ResourcesFact,
  TenantOperationsSummary,
  WebhooksFact,
  WhatsAppFact,
} from './tenant-operations.types'

const SOURCE_READ_FAILED = 'TENANT_SOURCE_READ_FAILED'

@Injectable()
export class TenantOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  async getSummary(orgId: string): Promise<TenantOperationsSummary> {
    const generatedAt = new Date().toISOString()
    const facts = await Promise.all([
      this.resources(orgId, generatedAt),
      this.whatsapp(orgId, generatedAt),
      this.webhooks(orgId, generatedAt),
      this.billing(orgId, generatedAt),
      this.operationConfig(orgId, generatedAt),
    ])
    return { contractVersion: 1, generatedAt, facts }
  }

  private async resources(orgId: string, observedAt: string): Promise<ResourcesFact> {
    try {
      const pipeline = await this.dashboard.getExecutivePipeline(orgId)
      const stage = (key: string) => pipeline.stages.find(item => item.key === key)
      return {
        key: 'resources', status: 'available', observedAt: pipeline.generatedAt, reasonCode: null,
        facts: {
          customersVolume: stage('customers')?.volume ?? null,
          customersUpdatedAt: stage('customers')?.referenceTimestamp ?? null,
          appointmentsVolume: stage('appointments')?.volume ?? null,
          appointmentsUpdatedAt: stage('appointments')?.referenceTimestamp ?? null,
          serviceOrdersVolume: stage('service-orders')?.volume ?? null,
          serviceOrdersUpdatedAt: stage('service-orders')?.referenceTimestamp ?? null,
          chargesVolume: stage('charges')?.volume ?? null,
          chargesUpdatedAt: stage('charges')?.referenceTimestamp ?? null,
          paymentsVolume: stage('payments')?.volume ?? null,
          paymentsUpdatedAt: stage('payments')?.referenceTimestamp ?? null,
        },
      }
    } catch {
      return { key: 'resources', status: 'unknown', observedAt, reasonCode: SOURCE_READ_FAILED, facts: {
        customersVolume: null, customersUpdatedAt: null, appointmentsVolume: null, appointmentsUpdatedAt: null,
        serviceOrdersVolume: null, serviceOrdersUpdatedAt: null, chargesVolume: null, chargesUpdatedAt: null,
        paymentsVolume: null, paymentsUpdatedAt: null,
      } }
    }
  }

  private async whatsapp(orgId: string, observedAt: string): Promise<WhatsAppFact> {
    try {
      const failedMessages = await this.prisma.whatsAppMessage.count({ where: { orgId, status: 'FAILED' } })
      return { key: 'whatsapp', status: 'unknown', observedAt, reasonCode: 'TENANT_CONFIGURATION_NOT_OBSERVABLE', facts: { failedMessages } }
    } catch {
      return { key: 'whatsapp', status: 'unknown', observedAt, reasonCode: SOURCE_READ_FAILED, facts: { failedMessages: null } }
    }
  }

  private async webhooks(orgId: string, observedAt: string): Promise<WebhooksFact> {
    try {
      const [configuredEndpoints, activeEndpoints, deliveries] = await Promise.all([
        this.prisma.webhookEndpoint.count({ where: { orgId } }),
        this.prisma.webhookEndpoint.count({ where: { orgId, active: true } }),
        this.prisma.webhookDelivery.groupBy({ by: ['status'], where: { endpoint: { orgId } }, _count: { _all: true } }),
      ])
      const count = (status: 'PENDING' | 'SUCCESS' | 'FAILED') => deliveries.find(item => item.status === status)?._count._all ?? 0
      return {
        key: 'webhooks', status: configuredEndpoints === 0 ? 'not_configured' : 'unknown', observedAt,
        reasonCode: configuredEndpoints === 0 ? 'NO_WEBHOOK_ENDPOINTS' : 'TENANT_AVAILABILITY_NOT_OBSERVABLE',
        facts: { configuredEndpoints, activeEndpoints, pendingDeliveries: count('PENDING'), successfulDeliveries: count('SUCCESS'), failedDeliveries: count('FAILED') },
      }
    } catch {
      return { key: 'webhooks', status: 'unknown', observedAt, reasonCode: SOURCE_READ_FAILED, facts: { configuredEndpoints: null, activeEndpoints: null, pendingDeliveries: null, successfulDeliveries: null, failedDeliveries: null } }
    }
  }

  private async billing(orgId: string, observedAt: string): Promise<BillingFact> {
    try {
      const subscription = await this.prisma.subscription.findUnique({ where: { orgId }, select: { status: true } })
      return { key: 'billing', status: subscription ? 'unknown' : 'not_configured', observedAt, reasonCode: subscription ? 'PROVIDER_AVAILABILITY_NOT_OBSERVABLE' : 'NO_SUBSCRIPTION', facts: { subscriptionStatus: subscription?.status ?? null } }
    } catch {
      return { key: 'billing', status: 'unknown', observedAt, reasonCode: SOURCE_READ_FAILED, facts: { subscriptionStatus: null } }
    }
  }

  private async operationConfig(orgId: string, observedAt: string): Promise<OperationConfigFact> {
    try {
      const config = await this.prisma.organizationExecutionConfig.findUnique({ where: { orgId }, select: { mode: true, updatedAt: true } })
      return { key: 'operation_config', status: config ? 'available' : 'not_configured', observedAt, reasonCode: config ? null : 'NO_EXECUTION_CONFIG', facts: { executionMode: config?.mode ?? null, updatedAt: config?.updatedAt.toISOString() ?? null } }
    } catch {
      return { key: 'operation_config', status: 'unknown', observedAt, reasonCode: SOURCE_READ_FAILED, facts: { executionMode: null, updatedAt: null } }
    }
  }
}
