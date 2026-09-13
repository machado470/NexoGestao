import { INestApplication, ValidationPipe } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'
import {
  describeRealIntegration,
  REAL_INTEGRATION_ENABLED_MESSAGE,
  REAL_INTEGRATION_SKIP_REASON,
  RUN_REAL_INTEGRATION,
} from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] ${REAL_INTEGRATION_SKIP_REASON}`)
else console.info(`[integration-run] ${REAL_INTEGRATION_ENABLED_MESSAGE}`)

describeRealIntegration('Phase 2 tenant mutation isolation (Postgres e2e)', () => {
  jest.setTimeout(90_000)

  let app: INestApplication
  let prisma: PrismaService

  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be explicitly configured for integration tests')
  const jwt = new JwtService({ secret: process.env.JWT_SECRET })
  const ids = {
    orgA: randomUUID(), orgB: randomUUID(),
    userA: randomUUID(), userB: randomUUID(),
    personA: randomUUID(), personB: randomUUID(),
    customerA: randomUUID(), customerB: randomUUID(),
    serviceOrderA: randomUUID(), serviceOrderB: randomUUID(), completeServiceOrderB: randomUUID(),
    chargeB: randomUUID(), conversationB: randomUUID(),
    whatsappApproveB: randomUUID(), whatsappExecuteB: randomUUID(), whatsappCancelB: randomUUID(),
  }
  const orgIds = [ids.orgA, ids.orgB]
  const authA = () => ({
    Authorization: `Bearer ${jwt.sign({ sub: ids.userA, role: 'ADMIN', orgId: ids.orgA, personId: ids.personA })}`,
  })

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)

    await prisma.organization.createMany({ data: [
      { id: ids.orgA, name: 'Tenant Mutations Org A', slug: `tenant-mutations-a-${ids.orgA}`, requiresOnboarding: true },
      { id: ids.orgB, name: 'Tenant Mutations Org B', slug: `tenant-mutations-b-${ids.orgB}`, requiresOnboarding: true },
    ] })
    await prisma.user.createMany({ data: [
      { id: ids.userA, orgId: ids.orgA, email: `${ids.userA}@test.invalid`, role: 'ADMIN', active: true },
      { id: ids.userB, orgId: ids.orgB, email: `${ids.userB}@test.invalid`, role: 'ADMIN', active: true },
    ] })
    await prisma.person.createMany({ data: [
      { id: ids.personA, orgId: ids.orgA, userId: ids.userA, name: 'Operator A', role: 'TECH' },
      { id: ids.personB, orgId: ids.orgB, userId: ids.userB, name: 'Operator B', role: 'TECH' },
    ] })
    await prisma.customer.createMany({ data: [
      { id: ids.customerA, orgId: ids.orgA, name: 'Customer A', phone: '+5511980000001' },
      { id: ids.customerB, orgId: ids.orgB, name: 'Customer B', phone: '+5511980000002' },
    ] })
    await prisma.serviceOrder.createMany({ data: [
      { id: ids.serviceOrderA, orgId: ids.orgA, customerId: ids.customerA, title: 'Service A', assignedToPersonId: ids.personA },
      { id: ids.serviceOrderB, orgId: ids.orgB, customerId: ids.customerB, title: 'Service B', status: 'DONE', amountCents: 12500, dueDate: new Date(Date.now() + 86_400_000), assignedToPersonId: ids.personB },
      { id: ids.completeServiceOrderB, orgId: ids.orgB, customerId: ids.customerB, title: 'Service B in progress', status: 'IN_PROGRESS', startedAt: new Date(), assignedToPersonId: ids.personB },
    ] })
    await prisma.charge.create({ data: {
      id: ids.chargeB, orgId: ids.orgB, customerId: ids.customerB, serviceOrderId: ids.serviceOrderB,
      amountCents: 12500, dueDate: new Date(Date.now() + 86_400_000), status: 'PENDING',
    } })
    await prisma.whatsAppConversation.create({ data: {
      id: ids.conversationB, orgId: ids.orgB, customerId: ids.customerB, phone: '+5511980000002',
      contextType: 'SERVICE_ORDER', contextId: ids.serviceOrderB, status: 'OPEN',
    } })
    await prisma.whatsAppActionExecution.createMany({ data: [
      { id: ids.whatsappApproveB, orgId: ids.orgB, conversationId: ids.conversationB, suggestedAction: 'SEND_SERVICE_UPDATE', status: 'PENDING_APPROVAL', approvalRequired: true, idempotencyKey: `approve-${ids.orgB}`, actionPayload: { entityType: 'SERVICE_ORDER', entityId: ids.serviceOrderB } },
      { id: ids.whatsappExecuteB, orgId: ids.orgB, conversationId: ids.conversationB, suggestedAction: 'MARK_RESOLVED', status: 'APPROVED', approvalRequired: false, idempotencyKey: `execute-${ids.orgB}` },
      { id: ids.whatsappCancelB, orgId: ids.orgB, conversationId: ids.conversationB, suggestedAction: 'SEND_SERVICE_UPDATE', status: 'PENDING_APPROVAL', approvalRequired: true, idempotencyKey: `cancel-${ids.orgB}`, actionPayload: { entityType: 'SERVICE_ORDER', entityId: ids.serviceOrderB } },
    ] })
  })

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.usageMetric.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.idempotencyRecord.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.payment.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppMessage.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppActionExecution.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppConversation.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppTemplate.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppWebhookEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.charge.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.serviceOrder.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.appointment.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.customer.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.organizationExecutionConfig.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.tenantFeatureOverride.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.subscription.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.person.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
        // Official events can finish persisting while the other tenant rows are
        // being drained, so make the organization deletion the final FK boundary.
        await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
      }
    } finally {
      if (app) {
        await app.close()
      }
    }
  })

  it('não atualiza customer nem O.S. da Org B', async () => {
    const timelineBefore = await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })

    await request(app.getHttpServer()).patch(`/customers/${ids.customerB}`).set(authA())
      .send({ name: 'Cross-tenant customer' }).expect(404)
    await request(app.getHttpServer()).patch(`/service-orders/${ids.serviceOrderB}`).set(authA())
      .send({ title: 'Cross-tenant service', status: 'CANCELED' }).expect(404)

    expect(await prisma.customer.findUnique({ where: { id: ids.customerB } })).toMatchObject({ orgId: ids.orgB, name: 'Customer B' })
    expect(await prisma.serviceOrder.findUnique({ where: { id: ids.serviceOrderB } })).toMatchObject({ orgId: ids.orgB, title: 'Service B', status: 'DONE' })
    expect(await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })).toBe(timelineBefore)
  })

  it('não gera cobrança para O.S. da Org B', async () => {
    const chargesBefore = await prisma.charge.count({ where: { serviceOrderId: ids.serviceOrderB } })
    const timelineBefore = await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })

    await request(app.getHttpServer()).post(`/service-orders/${ids.serviceOrderB}/generate-charge`).set(authA()).send({}).expect(404)

    expect(await prisma.charge.count({ where: { serviceOrderId: ids.serviceOrderB } })).toBe(chargesBefore)
    expect(await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })).toBe(timelineBefore)
  })

  it('não inicia nem completa execução da Org B', async () => {
    const timelineBefore = await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })

    await request(app.getHttpServer()).post('/executions/start').set(authA())
      .send({ serviceOrderId: ids.serviceOrderB }).expect(404)
    await request(app.getHttpServer()).post(`/executions/${ids.completeServiceOrderB}/complete`).set(authA())
      .send({ notes: 'Cross-tenant completion' }).expect(404)

    expect(await prisma.serviceOrder.findUnique({ where: { id: ids.serviceOrderB } })).toMatchObject({ status: 'DONE', startedAt: null, finishedAt: null })
    expect(await prisma.serviceOrder.findUnique({ where: { id: ids.completeServiceOrderB } })).toMatchObject({ status: 'IN_PROGRESS', finishedAt: null, outcomeSummary: null })
    expect(await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })).toBe(timelineBefore)
  })

  it('não paga nem cancela cobrança da Org B', async () => {
    const timelineBefore = await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })
    const idempotencyKey = `cross-tenant-pay-${ids.chargeB}`

    await request(app.getHttpServer()).post(`/finance/charges/${ids.chargeB}/pay`).set(authA())
      .set('Idempotency-Key', idempotencyKey).send({ method: 'PIX', amountCents: 12500 }).expect(404)
    await request(app.getHttpServer()).post(`/finance/charges/${ids.chargeB}/cancel`).set(authA())
      .send({ cancellationReason: 'Cross-tenant cancel' }).expect(404)

    expect(await prisma.charge.findUnique({ where: { id: ids.chargeB } })).toMatchObject({ orgId: ids.orgB, status: 'PENDING', paidAt: null, canceledAt: null, cancellationReason: null })
    expect(await prisma.payment.count({ where: { chargeId: ids.chargeB } })).toBe(0)
    expect(await prisma.idempotencyRecord.count({ where: { key: idempotencyKey } })).toBe(0)
    expect(await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })).toBe(timelineBefore)
  })

  it.each([
    ['approve', 'whatsappApproveB'],
    ['execute', 'whatsappExecuteB'],
    ['cancel', 'whatsappCancelB'],
  ] as const)('não permite %s de WhatsApp Action Execution da Org B', async (operation, idKey) => {
    const executionId = ids[idKey]
    const executionBefore = await prisma.whatsAppActionExecution.findUniqueOrThrow({ where: { id: executionId } })
    const conversationBefore = await prisma.whatsAppConversation.findUniqueOrThrow({ where: { id: ids.conversationB } })
    const messagesBefore = await prisma.whatsAppMessage.count({ where: { orgId: { in: orgIds } } })
    const timelineBefore = await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })
    const auditBefore = await prisma.auditEvent.count({ where: { orgId: { in: orgIds } } })

    await request(app.getHttpServer()).post(`/whatsapp/action-executions/${executionId}/${operation}`).set(authA())
      .send({ reason: 'Cross-tenant action', orgId: ids.orgB, tenantId: ids.orgB, organizationId: ids.orgB }).expect(404)

    expect(await prisma.whatsAppActionExecution.findUnique({ where: { id: executionId } })).toEqual(executionBefore)
    expect(await prisma.whatsAppConversation.findUnique({ where: { id: ids.conversationB } })).toEqual(conversationBefore)
    expect(await prisma.whatsAppMessage.count({ where: { orgId: { in: orgIds } } })).toBe(messagesBefore)
    expect(await prisma.timelineEvent.count({ where: { orgId: { in: orgIds } } })).toBe(timelineBefore)
    expect(await prisma.auditEvent.count({ where: { orgId: { in: orgIds } } })).toBe(auditBefore)
  })

  it('completa onboarding somente para a organização autenticada', async () => {
    await request(app.getHttpServer()).post('/onboarding/complete').set(authA()).send({}).expect(201)

    expect(await prisma.organization.findUnique({ where: { id: ids.orgA } })).toMatchObject({ requiresOnboarding: false })
    expect(await prisma.organization.findUnique({ where: { id: ids.orgB } })).toMatchObject({ requiresOnboarding: true })
  })
})
