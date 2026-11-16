import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'
import { WhatsAppService } from '../../src/whatsapp/whatsapp.service'
import { subscriptionAccess } from '../../src/common/commercial/subscription-access'

// Global cron claim is deliberately exercised only in its dedicated local database.
const run = process.env.RUN_REAL_INTEGRATION === 'true' && new URL(process.env.DATABASE_URL || 'postgresql://localhost/none').pathname === '/nexo_commercial_test'
const suite = run ? describe : describe.skip
suite('Subscription policy / HTTP and atomic dispatch / real PostgreSQL', () => {
  jest.setTimeout(90000)
  let app: INestApplication, db: PrismaService, whatsapp: WhatsAppService, customerId: string, chargeId: string
  const orgId = randomUUID(), otherOrgId = randomUUID(), userId = randomUUID(), personId = randomUUID(), orgIds = [orgId, otherOrgId]
  const previous = { operational: process.env.DISABLE_OPERATIONAL_STATE_SCHEDULE, whatsapp: process.env.DISABLE_WHATSAPP_SCHEDULE }
  let auth: Record<string, string>
  beforeAll(async () => {
    process.env.DISABLE_OPERATIONAL_STATE_SCHEDULE = 'true'; process.env.DISABLE_WHATSAPP_SCHEDULE = '1'
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true })); await app.init()
    db = app.get(PrismaService); whatsapp = app.get(WhatsAppService)
    await db.organization.createMany({ data: orgIds.map(id => ({ id, name: 'Commercial synthetic QA', slug: id })) })
    const plan = await db.plan.upsert({ where: { name: PlanName.PRO }, update: {}, create: { name: PlanName.PRO, priceCents: 100, displayName: 'Pro QA' } })
    await db.subscription.createMany({ data: orgIds.map(id => ({ orgId: id, planId: plan.id, status: 'ACTIVE' as const, currentPeriodStart: new Date(Date.now() - 86400000), currentPeriodEnd: new Date(Date.now() + 86400000) })) })
    await db.user.create({ data: { id: userId, orgId, email: `${userId}@test.invalid`, role: 'ADMIN', active: true, emailVerifiedAt: new Date() } })
    await db.person.create({ data: { id: personId, orgId, userId, name: 'Commercial QA', role: 'TECH' } })
    customerId = (await db.customer.create({ data: { orgId, name: 'Existing customer', phone: '11900000000' } })).id
    chargeId = (await db.charge.create({ data: { orgId, customerId, amountCents: 1000, dueDate: new Date() } })).id
    auth = { Authorization: 'Bearer ' + new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: userId, orgId, role: 'ADMIN', personId, sessionVersion: 0 }) }
  })
  afterAll(async () => {
    try {
      if (db) {
        const where = { orgId: { in: orgIds } }
        await db.whatsAppMessage.deleteMany({ where }); await db.timelineEvent.deleteMany({ where }); await db.auditEvent.deleteMany({ where }); await db.usageMetric.deleteMany({ where })
        await db.idempotencyRecord.deleteMany({ where }); await db.tenantRateLimitBucket.deleteMany({ where })
        await db.charge.deleteMany({ where }); await db.customer.deleteMany({ where }); await db.person.deleteMany({ where }); await db.user.deleteMany({ where }); await db.subscription.deleteMany({ where }); await db.organization.deleteMany({ where: { id: { in: orgIds } } })
      }
    } finally {
      if (app) await app.close()
      for (const [key, value] of [['DISABLE_OPERATIONAL_STATE_SCHEDULE', previous.operational], ['DISABLE_WHATSAPP_SCHEDULE', previous.whatsapp]] as const) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value
      }
    }
  })
  const state = (status: SubscriptionStatus, future = true) => db.subscription.update({ where: { orgId }, data: { status, currentPeriodEnd: new Date(Date.now() + (future ? 86400000 : -86400000)) } })
  it.each(['SUSPENDED', 'PAST_DUE', 'CANCELED', 'TRIALING'] as const)('%s blocks admissions but retains existing data and subscription reads', async status => {
    await state(status, status !== 'TRIALING')
    const server = app.getHttpServer(), before = await db.customer.count({ where: { orgId } })
    await request(server).post('/customers').set(auth).send({ name: 'Must not persist', phone: '11900000000' }).expect(403)
    const create = await request(server).post('/finance/charges').set(auth).send({ customerId, amountCents: 1000, dueDate: new Date().toISOString() }).expect(400)
    expect(JSON.stringify(create.body)).toContain(status === 'TRIALING' ? 'tenant_trial_expired' : 'tenant_subscription_')
    await request(server).post(`/finance/charges/${chargeId}/pay`).set(auth).send({ method: 'CASH', amountCents: 1000 }).expect(400)
    await request(server).post('/whatsapp/messages').set(auth).send({ customerId, toPhone: '11900000000', content: 'Must not send' }).expect(403)
    await request(server).get(`/customers/${customerId}`).set(auth).expect(200)
    await request(server).get('/billing/subscription').set(auth).expect(200)
    await request(server).get('/commercial/context').set(auth).expect(200)
    expect(await db.customer.count({ where: { orgId } })).toBe(before)
    expect(await db.charge.count({ where: { orgId } })).toBe(1)
    expect(await db.payment.count({ where: { orgId } })).toBe(0)
    expect(await db.whatsAppMessage.count({ where: { orgId } })).toBe(0)
  })
  it('regularization restores normal customer creation without a new session', async () => {
    await state('ACTIVE')
    await request(app.getHttpServer()).post('/customers').set(auth).send({ name: 'After regularization', phone: '11900000001' }).expect(201)
    expect(await db.customer.count({ where: { orgId } })).toBe(2)
  })
  const queued = () => db.whatsAppMessage.create({ data: { orgId, customerId, entityId: customerId, entityType: 'CUSTOMER', messageType: 'MANUAL', toPhone: '+5511900000000', renderedText: 'Synthetic claim only' } })
  it.each([
    ['ACTIVE', true, true], ['TRIALING', true, true], ['TRIALING', false, false], ['SUSPENDED', true, false], ['CANCELED', true, false], ['PAST_DUE', true, false],
  ] as const)('%s future=%s matches the shared policy in BullMQ and cron claims', async (status, future, allowed) => {
    const subscription = await state(status, future)
    expect(subscriptionAccess(subscription).allowed).toBe(allowed)
    const message = await queued()
    try {
      const claim = await whatsapp.claimMessageForDispatch({ id: message.id, orgId, workerId: 'commercial-bullmq-qa' })
      expect(Boolean(claim)).toBe(allowed)
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'QUEUED', lockedAt: null, lockedBy: null } })
      const cron = await whatsapp.claimQueued({ limit: 1, workerId: 'commercial-cron-qa' })
      expect(cron.some(m => m.id === message.id)).toBe(allowed)
      if (!allowed) expect((await db.whatsAppMessage.findUniqueOrThrow({ where: { id: message.id } })).status).toBe('QUEUED')
    } finally { await db.whatsAppMessage.delete({ where: { id: message.id } }) }
  })
  it('keeps the existing FREE fallback eligible in both dispatch claims without a subscription', async () => {
    const subscription = await db.subscription.findUniqueOrThrow({ where: { orgId: otherOrgId } })
    await db.subscription.delete({ where: { orgId: otherOrgId } })
    const message = await db.whatsAppMessage.create({ data: { orgId: otherOrgId, entityId: otherOrgId, entityType: 'GENERAL', messageType: 'MANUAL', toPhone: '+5511900000000', renderedText: 'FREE synthetic claim' } })
    try {
      expect((await whatsapp.claimMessageForDispatch({ id: message.id, orgId: otherOrgId, workerId: 'free-qa' }))?.id).toBe(message.id)
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: 'QUEUED', lockedAt: null, lockedBy: null } })
      expect((await whatsapp.claimQueued({ limit: 1, workerId: 'free-cron-qa' })).map(m => m.id)).toEqual([message.id])
    } finally {
      await db.whatsAppMessage.delete({ where: { id: message.id } })
      await db.subscription.create({ data: subscription })
    }
  })
  it('skips a blocked tenant without starving an eligible tenant, and resumes after regularization', async () => {
    await state('ACTIVE'); const blocked = await queued(); await state('SUSPENDED')
    const eligible = await db.whatsAppMessage.create({ data: { orgId: otherOrgId, entityId: otherOrgId, entityType: 'GENERAL', messageType: 'MANUAL', toPhone: '+5511900000000', renderedText: 'Other tenant synthetic claim' } })
    try {
      const claimed = await whatsapp.claimQueued({ limit: 1, workerId: 'commercial-cron-isolation-qa' })
      expect(claimed.map(m => m.id)).toEqual([eligible.id])
      expect(await whatsapp.claimMessageForDispatch({ id: blocked.id, orgId: otherOrgId, workerId: 'wrong-tenant' })).toBeNull()
      await state('ACTIVE')
      const resumed = await whatsapp.claimMessageForDispatch({ id: blocked.id, orgId, workerId: 'regularized-worker' })
      expect(resumed?.id).toBe(blocked.id)
    } finally { await db.whatsAppMessage.deleteMany({ where: { id: { in: [blocked.id, eligible.id] } } }) }
  })
})
