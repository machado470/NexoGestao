import { INestApplication, ValidationPipe } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { createHmac, randomUUID } from 'crypto'
import request from 'supertest'

import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'
import { describeRealIntegration, RUN_REAL_INTEGRATION } from './infra-guards'

const APP_SECRET = 'phase-2-2-webhook-integration-secret'
process.env.WHATSAPP_PROVIDER = 'meta_cloud'
process.env.META_APP_SECRET = APP_SECRET
process.env.META_ACCESS_TOKEN ||= 'integration-token'
process.env.META_PHONE_NUMBER_ID ||= 'integration-outbound-account'

describeRealIntegration('Phase 2.2 WhatsApp public webhook tenant isolation (Postgres/Redis e2e)', () => {
  jest.setTimeout(120_000)

  let app: INestApplication
  let prisma: PrismaService
  const ids = { orgA: randomUUID(), orgB: randomUUID(), userA: randomUUID(), userB: randomUUID() }
  const orgIds = [ids.orgA, ids.orgB]
  const accounts = { a: `wa-a-${randomUUID()}`, b: `wa-b-${randomUUID()}`, unknown: `wa-unknown-${randomUUID()}` }
  const jwt = new JwtService({ secret: process.env.JWT_SECRET })

  const payload = (accountId: string, messageId: string, spoof: Record<string, string> = {}) => ({
    object: 'whatsapp_business_account',
    ...spoof,
    entry: [{ id: `business-${accountId}`, changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { display_phone_number: '5511999999999', phone_number_id: accountId },
      messages: [{ from: '5511988887777', id: messageId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: `message-${messageId}` } }],
    } }] }],
  })
  const signature = (body: unknown) => `sha256=${createHmac('sha256', APP_SECRET).update(JSON.stringify(body)).digest('hex')}`
  const post = (body: Record<string, any>) => request(app.getHttpServer()).post('/whatsapp/webhooks/meta_cloud')
    .set('x-hub-signature-256', signature(body)).send(body)
  const waitForEvent = async (id: string) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const event = await prisma.whatsAppWebhookEvent.findUnique({ where: { id } })
      if (event?.status === 'PROCESSED') return event
      if (event?.status === 'FAILED') throw new Error(`webhook processing failed: ${event.errorMessage}`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`webhook ${id} was not processed by the real Redis worker`)
  }
  const assertNoWrongTenantEffects = async (expected: Record<string, number>) => {
    for (const orgId of orgIds) {
      const actual = {
        events: await prisma.whatsAppWebhookEvent.count({ where: { orgId } }),
        conversations: await prisma.whatsAppConversation.count({ where: { orgId } }),
        messages: await prisma.whatsAppMessage.count({ where: { orgId } }),
        timeline: await prisma.timelineEvent.count({ where: { orgId } }),
        actions: await prisma.whatsAppActionExecution.count({ where: { orgId } }),
      }
      expect(actual.events).toBe(expected[`${orgId}:events`] ?? 0)
      expect(actual.conversations).toBe(expected[`${orgId}:conversations`] ?? 0)
      expect(actual.messages).toBe(expected[`${orgId}:messages`] ?? 0)
      expect(actual.timeline).toBe(expected[`${orgId}:timeline`] ?? 0)
      expect(actual.actions).toBe(0)
    }
  }

  beforeAll(async () => {
    if (!RUN_REAL_INTEGRATION) return
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be explicitly configured for integration tests')
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    await prisma.organization.createMany({ data: [
      { id: ids.orgA, name: 'Webhook Org A', slug: `webhook-a-${ids.orgA}` },
      { id: ids.orgB, name: 'Webhook Org B', slug: `webhook-b-${ids.orgB}` },
    ] })
    await prisma.user.createMany({ data: [
      { id: ids.userA, orgId: ids.orgA, email: `${ids.userA}@test.invalid`, role: 'ADMIN', active: true },
      { id: ids.userB, orgId: ids.orgB, email: `${ids.userB}@test.invalid`, role: 'ADMIN', active: true },
    ] })
    await prisma.whatsAppProviderAccount.createMany({ data: [
      { orgId: ids.orgA, provider: 'meta_cloud', accountId: accounts.a },
      { orgId: ids.orgB, provider: 'meta_cloud', accountId: accounts.b },
    ] })
  })

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.timelineEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppActionExecution.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppMessage.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppConversation.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppWebhookEvent.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.whatsAppProviderAccount.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
      }
    } finally {
      if (app) await app.close()
    }
  })

  it('correlaciona A e B exclusivamente pela conta persistida e ignora tenant spoofing', async () => {
    const bodyA = payload(accounts.a, `wamid-${randomUUID()}`, { orgId: ids.orgB, tenantId: ids.orgB, organizationId: ids.orgB })
    const eventA = (await post(bodyA).set('x-org-id', ids.orgB).expect(200)).body.webhookEventId
    await waitForEvent(eventA)
    await assertNoWrongTenantEffects({ [`${ids.orgA}:events`]: 1, [`${ids.orgA}:conversations`]: 1, [`${ids.orgA}:messages`]: 1, [`${ids.orgA}:timeline`]: 1 })

    const bodyB = payload(accounts.b, `wamid-${randomUUID()}`, { orgId: ids.orgA, tenantId: ids.orgA, organizationId: ids.orgA })
    const eventB = (await post(bodyB).set('x-nexo-org-id', ids.orgA).expect(200)).body.webhookEventId
    await waitForEvent(eventB)
    await assertNoWrongTenantEffects({
      [`${ids.orgA}:events`]: 1, [`${ids.orgA}:conversations`]: 1, [`${ids.orgA}:messages`]: 1, [`${ids.orgA}:timeline`]: 1,
      [`${ids.orgB}:events`]: 1, [`${ids.orgB}:conversations`]: 1, [`${ids.orgB}:messages`]: 1, [`${ids.orgB}:timeline`]: 1,
    })
  })

  it('rejeita conta desconhecida e correlação ambígua antes de persistir qualquer efeito', async () => {
    await post(payload(accounts.unknown, `wamid-${randomUUID()}`, { orgId: ids.orgA })).expect(400)
    const ambiguous = payload(accounts.a, `wamid-${randomUUID()}`)
    ambiguous.entry.push(payload(accounts.b, `wamid-${randomUUID()}`).entry[0])
    await post(ambiguous).expect(400)
    await assertNoWrongTenantEffects({
      [`${ids.orgA}:events`]: 1, [`${ids.orgA}:conversations`]: 1, [`${ids.orgA}:messages`]: 1, [`${ids.orgA}:timeline`]: 1,
      [`${ids.orgB}:events`]: 1, [`${ids.orgB}:conversations`]: 1, [`${ids.orgB}:messages`]: 1, [`${ids.orgB}:timeline`]: 1,
    })
  })

  it('mantém replay e providerMessageId tenant-safe sem efeitos derivados extras', async () => {
    const eventA = await prisma.whatsAppWebhookEvent.findFirstOrThrow({ where: { orgId: ids.orgA } })
    const tokenA = jwt.sign({ sub: ids.userA, role: 'ADMIN', orgId: ids.orgA })
    await request(app.getHttpServer()).post(`/whatsapp/webhook-events/${eventA.id}/replay`)
      .set('Authorization', `Bearer ${tokenA}`).send({ force: true }).expect(201)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const originalId = (eventA.payload as any).entry[0].changes[0].value.messages[0].id
    const equivalentSpoof = payload(accounts.a, originalId, { orgId: ids.orgB, tenantId: ids.orgB })
    const replayedPublicEvent = (await post(equivalentSpoof).expect(200)).body.webhookEventId
    await waitForEvent(replayedPublicEvent)
    await assertNoWrongTenantEffects({
      [`${ids.orgA}:events`]: 2, [`${ids.orgA}:conversations`]: 1, [`${ids.orgA}:messages`]: 1, [`${ids.orgA}:timeline`]: 1,
      [`${ids.orgB}:events`]: 1, [`${ids.orgB}:conversations`]: 1, [`${ids.orgB}:messages`]: 1, [`${ids.orgB}:timeline`]: 1,
    })
  })
})
