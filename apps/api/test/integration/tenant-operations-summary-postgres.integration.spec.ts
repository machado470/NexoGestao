import { PrismaClient } from '@prisma/client'
import { DashboardService } from '../../src/dashboard/dashboard.service'
import { TenantOperationsService } from '../../src/health/tenant-operations.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('TenantOperationsService PostgreSQL real tenant isolation', () => {
  const prisma = new PrismaClient()
  const dashboard = new DashboardService(prisma as any, {} as any, {} as any)
  const service = new TenantOperationsService(prisma as any, dashboard)
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const orgIds: string[] = []

  beforeAll(async () => {
    await prisma.$connect()
    const plan = await prisma.plan.upsert({
      where: { name: 'STARTER' },
      update: {},
      create: { name: 'STARTER', displayName: 'Starter', priceCents: 0 },
    })

    for (const [tenant, count] of [['a', 1], ['b', 2]] as const) {
      const org = await prisma.organization.create({ data: { name: `Cockpit ${tenant} ${suffix}`, slug: `cockpit-${tenant}-${suffix}` } })
      orgIds.push(org.id)
      const customers = []
      for (let index = 0; index < count; index += 1) {
        customers.push(await prisma.customer.create({ data: { orgId: org.id, name: `${tenant}-${index}`, phone: `+5500${tenant}${suffix.replace(/\D/g, '').slice(-8)}${index}` } }))
      }
      const customer = customers[0]
      const appointment = await prisma.appointment.create({ data: { orgId: org.id, customerId: customer.id, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) } })
      const order = await prisma.serviceOrder.create({ data: { orgId: org.id, customerId: customer.id, appointmentId: appointment.id, title: `Order ${tenant}` } })
      const charge = await prisma.charge.create({ data: { orgId: org.id, customerId: customer.id, serviceOrderId: order.id, amountCents: count * 100, dueDate: new Date() } })
      await prisma.payment.create({ data: { orgId: org.id, chargeId: charge.id, amountCents: count * 100, method: 'PIX' } })

      for (let index = 0; index < count; index += 1) {
        await prisma.whatsAppMessage.create({ data: { orgId: org.id, entityType: 'CUSTOMER', entityId: customer.id, messageType: 'MANUAL', status: 'FAILED', toPhone: customer.phone, renderedText: `failed-${tenant}-${index}` } })
      }
      const endpoint = await prisma.webhookEndpoint.create({ data: { orgId: org.id, url: `https://${tenant}.invalid/hook`, secret: `must-not-leak-${tenant}`, events: ['test'], active: tenant === 'a' } })
      await prisma.webhookDelivery.create({ data: { endpointId: endpoint.id, eventType: 'test', payload: { privateTenant: tenant }, status: tenant === 'a' ? 'SUCCESS' : 'FAILED' } })
      if (tenant === 'a') {
        await prisma.subscription.create({ data: { orgId: org.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) } })
      }
      await prisma.organizationExecutionConfig.create({ data: { orgId: org.id, mode: tenant === 'a' ? 'manual' : 'automatic' } })
    }
  })

  afterAll(async () => {
    if (orgIds.length) {
      await prisma.webhookDelivery.deleteMany({ where: { endpoint: { orgId: { in: orgIds } } } })
      await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.whatsAppMessage.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.payment.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.charge.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.serviceOrder.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.appointment.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.customer.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.subscription.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.organizationExecutionConfig.deleteMany({ where: { orgId: { in: orgIds } } })
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    }
    await prisma.$disconnect()
  })

  it('reads distinct persisted facts for A and B without cross-tenant leakage', async () => {
    const [a, b] = await Promise.all([service.getSummary(orgIds[0]), service.getSummary(orgIds[1])])
    expect(a.facts.find(f => f.key === 'resources')?.facts).toMatchObject({ customersVolume: 1 })
    expect(b.facts.find(f => f.key === 'resources')?.facts).toMatchObject({ customersVolume: 2 })
    expect(a.facts.find(f => f.key === 'whatsapp')?.facts).toEqual({ failedMessages: 1 })
    expect(b.facts.find(f => f.key === 'whatsapp')?.facts).toEqual({ failedMessages: 2 })
    expect(a.facts.find(f => f.key === 'webhooks')?.facts).toMatchObject({ activeEndpoints: 1, successfulDeliveries: 1, failedDeliveries: 0 })
    expect(b.facts.find(f => f.key === 'webhooks')?.facts).toMatchObject({ activeEndpoints: 0, successfulDeliveries: 0, failedDeliveries: 1 })
    expect(a.facts.find(f => f.key === 'billing')).toMatchObject({ status: 'unknown', facts: { subscriptionStatus: 'ACTIVE' } })
    expect(b.facts.find(f => f.key === 'billing')).toMatchObject({ status: 'not_configured', facts: { subscriptionStatus: null } })
    expect(a.facts.find(f => f.key === 'operation_config')?.facts).toMatchObject({ executionMode: 'manual' })
    expect(b.facts.find(f => f.key === 'operation_config')?.facts).toMatchObject({ executionMode: 'automatic' })
    expect(JSON.stringify(a)).not.toMatch(/must-not-leak|privateTenant|orgId/)
    expect(JSON.stringify(b)).not.toMatch(/must-not-leak|privateTenant|orgId/)
  })
})
