import { INestApplication, Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createHmac } from 'crypto'
import request from 'supertest'
import { WhatsAppController } from './whatsapp.controller'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppWebhookService } from './whatsapp-webhook.service'
import { QuotasService } from '../quotas/quotas.service'
import { IdempotencyService } from '../common/idempotency/idempotency.service'
import { IdempotencyCacheService } from '../common/idempotency/idempotency-cache.service'

// Regression for C2: inbound WhatsApp webhooks must be authenticated fail-closed, over the raw HTTP body,
// and routed to an organization only through a persisted provider account.
const SECRET = 'c2-meta-app-secret-for-tests'
const ACCOUNTS = [
  { provider: 'meta_cloud', accountId: 'phone-org-a', orgId: 'org-a', active: true },
  { provider: 'meta_cloud', accountId: 'phone-org-b', orgId: 'org-b', active: true },
  { provider: 'meta_cloud', accountId: 'phone-inactive', orgId: 'org-a', active: false },
]

const metaBody = (accountIds: string[], extra: Record<string, unknown> = {}) => ({
  object: 'whatsapp_business_account',
  ...extra,
  entry: accountIds.map((id) => ({ id: `waba-${id}`, changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { display_phone_number: '5511999999999', phone_number_id: id },
    messages: [{ from: '5511988887777', id: `wamid-${id}`, timestamp: '1760000000', type: 'text', text: { body: 'olá' } }],
  } }] })),
})
const sign = (raw: string | Buffer, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`

describe('WhatsApp webhook authentication over HTTP (C2)', () => {
  let app: INestApplication
  const envKeys = ['WHATSAPP_PROVIDER', 'META_APP_SECRET', 'NODE_ENV'] as const
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

  const prisma = {
    whatsAppProviderAccount: {
      findMany: jest.fn(async ({ where }: any) => ACCOUNTS
        .filter((a) => a.provider === where.provider && where.accountId.in.includes(a.accountId) && a.active === where.active)
        .map(({ orgId, accountId }) => ({ orgId, accountId }))),
    },
  }
  const tenantResolver = new WhatsAppWebhookService(prisma as any, {} as any, {} as any)
  const whatsapp = {
    resolveWebhookTenant: jest.fn((provider: string, payload: unknown) => tenantResolver.resolveTenantFromProviderAccount(provider, payload)),
    createWebhookEvent: jest.fn(async () => ({ id: 'event-1', createdAt: new Date('2026-11-20T00:00:00Z') })),
    enqueueInboundWebhook: jest.fn(async () => ({ id: 'job-1' })),
  }
  const logged: string[] = []

  const postRaw = (raw: string, headers: Record<string, string> = {}, path = '/whatsapp/webhooks/meta_cloud') => {
    const req = request(app.getHttpServer()).post(path).set('Content-Type', 'application/json')
    for (const [key, value] of Object.entries(headers)) req.set(key, value)
    return req.send(raw)
  }
  const postSigned = (body: unknown, path?: string) => {
    const raw = JSON.stringify(body)
    return postRaw(raw, { 'x-hub-signature-256': sign(raw) }, path)
  }
  const expectNothingPersisted = () => {
    expect(whatsapp.createWebhookEvent).not.toHaveBeenCalled()
    expect(whatsapp.enqueueInboundWebhook).not.toHaveBeenCalled()
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppService, useValue: whatsapp },
        { provide: QuotasService, useValue: {} },
        { provide: IdempotencyService, useValue: {} },
        { provide: IdempotencyCacheService, useValue: {} },
      ],
    }).compile()
    app = module.createNestApplication({ rawBody: true, logger: false })
    await app.init()
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')) })
    }
  })

  afterAll(async () => {
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key]
      else process.env[key] = previousEnv[key]
    }
    jest.restoreAllMocks()
    await app?.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'test'
    process.env.WHATSAPP_PROVIDER = 'meta_cloud'
    process.env.META_APP_SECRET = SECRET
  })

  describe('Meta Cloud', () => {
    it('accepts a valid signature computed over the raw body and routes to the account organization', async () => {
      const res = await postSigned(metaBody(['phone-org-a'])).expect(200)
      expect(res.body).toEqual(expect.objectContaining({ ok: true, received: true, webhookEventId: 'event-1' }))
      expect(whatsapp.createWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', provider: 'meta_cloud' }))
      expect(whatsapp.enqueueInboundWebhook).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a' }))
    })

    it('verifies the exact bytes Meta sent, not a re-serialized JSON', async () => {
      // Meta escapes unicode and the byte layout differs from JSON.stringify(parsed body).
      const raw = JSON.stringify(metaBody(['phone-org-a']), null, 2).replace('olá', 'ol\\u00e1')
      expect(raw).not.toBe(JSON.stringify(JSON.parse(raw)))
      await postRaw(raw, { 'x-hub-signature-256': sign(raw) }).expect(200)
      expect(whatsapp.createWebhookEvent).toHaveBeenCalledTimes(1)
    })

    it('rejects a signature computed over the re-serialized JSON instead of the raw bytes', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-a']), null, 2)
      await postRaw(raw, { 'x-hub-signature-256': sign(JSON.stringify(JSON.parse(raw))) }).expect(400)
      expectNothingPersisted()
    })

    it.each([
      ['missing header', undefined],
      ['empty header', ''],
      ['no sha256= prefix', 'deadbeef'],
      ['sha1 scheme', `sha1=${'a'.repeat(40)}`],
      ['truncated digest', 'sha256=short'],
      ['non-hex digest', `sha256=${'z'.repeat(64)}`],
      ['digest too long', `sha256=${'a'.repeat(66)}`],
    ])('rejects a %s before touching the database', async (_label, header) => {
      const raw = JSON.stringify(metaBody(['phone-org-a']))
      await postRaw(raw, header === undefined ? {} : { 'x-hub-signature-256': header }).expect(400)
      expect(whatsapp.resolveWebhookTenant).not.toHaveBeenCalled()
      expectNothingPersisted()
    })

    it('rejects duplicated signature headers (Node joins repeated headers with ", ")', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-a']))
      await postRaw(raw, { 'x-hub-signature-256': `${sign(raw)}, ${sign(raw)}` }).expect(400)
      expectNothingPersisted()
    })

    it('rejects a signature made with a different secret', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-a']))
      await postRaw(raw, { 'x-hub-signature-256': sign(raw, 'attacker-secret') }).expect(400)
      expectNothingPersisted()
    })

    it.each([undefined, ''])('fails closed when META_APP_SECRET is %j, even for a body signed with an empty key', async (secret) => {
      if (secret === undefined) delete process.env.META_APP_SECRET
      else process.env.META_APP_SECRET = secret
      const raw = JSON.stringify(metaBody(['phone-org-a']))
      await postRaw(raw, { 'x-hub-signature-256': sign(raw, '') }).expect(400)
      await postRaw(raw).expect(400)
      expectNothingPersisted()
    })

    it('rejects a body that is not JSON-parsed raw bytes (no raw body available)', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-a']))
      await request(app.getHttpServer()).post('/whatsapp/webhooks/meta_cloud').set('Content-Type', 'text/plain')
        .set('x-hub-signature-256', sign(raw)).send(raw).expect(400)
      expectNothingPersisted()
    })

    it('blocks replaying a captured signature with a tampered body or retargeted to another organization', async () => {
      const original = JSON.stringify(metaBody(['phone-org-a']))
      const capturedSignature = sign(original)
      await postRaw(original.replace('olá', 'pague agora'), { 'x-hub-signature-256': capturedSignature }).expect(400)
      await postRaw(original.replace(/phone-org-a/g, 'phone-org-b'), { 'x-hub-signature-256': capturedSignature }).expect(400)
      expectNothingPersisted()
    })

    it('keeps the legacy /webhook/:provider route under the same verification', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-b']))
      await postRaw(raw, { 'x-hub-signature-256': sign(raw, 'wrong') }, '/whatsapp/webhook/meta_cloud').expect(400)
      expectNothingPersisted()
      await postRaw(raw, { 'x-hub-signature-256': sign(raw) }, '/whatsapp/webhook/meta_cloud').expect(200)
      expect(whatsapp.createWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }))
    })
  })

  describe('organization isolation for authenticated payloads', () => {
    it('ignores organization identifiers sent in the body or headers and uses only the persisted account', async () => {
      const raw = JSON.stringify(metaBody(['phone-org-b'], { orgId: 'org-a', providerAccountId: 'phone-org-a' }))
      await postRaw(raw, { 'x-hub-signature-256': sign(raw), 'x-org-id': 'org-a' }).expect(200)
      expect(whatsapp.createWebhookEvent).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }))
      expect(whatsapp.enqueueInboundWebhook).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-b' }))
    })

    it('rejects a signed payload that mixes accounts from two organizations', async () => {
      await postSigned(metaBody(['phone-org-a', 'phone-org-b'])).expect(400)
      expectNothingPersisted()
    })

    it.each([['unknown', 'phone-unknown'], ['inactive', 'phone-inactive']])('rejects a signed payload for an %s account', async (_label, accountId) => {
      await postSigned(metaBody([accountId])).expect(400)
      expectNothingPersisted()
    })

    it('rejects a signed payload without a provider account identifier', async () => {
      await postSigned({ object: 'whatsapp_business_account', entry: [] }).expect(400)
      expectNothingPersisted()
    })
  })

  describe('Z-API', () => {
    it.each([
      ['no credentials', {}],
      ['a Client-Token header', { 'Client-Token': 'any-token' }],
      ['a forged Meta-style signature', { 'x-hub-signature-256': sign('{}') }],
    ])('rejects inbound callbacks with %s (no verified callback contract: fail closed)', async (_label, headers) => {
      process.env.WHATSAPP_PROVIDER = 'zapi'
      const raw = JSON.stringify({ instanceId: 'instance-a', phone: '5511988887777', text: { message: 'olá' } })
      await postRaw(raw, headers as Record<string, string>, '/whatsapp/webhooks/zapi').expect(400)
      await postRaw(raw, headers as Record<string, string>, '/whatsapp/webhook/zapi').expect(400)
      expect(whatsapp.resolveWebhookTenant).not.toHaveBeenCalled()
      expectNothingPersisted()
    })
  })

  it('rejects a provider in the URL that differs from the configured provider', async () => {
    const raw = JSON.stringify(metaBody(['phone-org-a']))
    await postRaw(raw, { 'x-hub-signature-256': sign(raw) }, '/whatsapp/webhooks/zapi').expect(400)
    await postRaw(raw, { 'x-hub-signature-256': sign(raw) }, '/whatsapp/webhooks/mock').expect(400)
    expectNothingPersisted()
  })

  it('never writes the secret, signatures or message bodies to logs', async () => {
    logged.length = 0
    const raw = JSON.stringify(metaBody(['phone-org-a']))
    const signature = sign(raw)
    await postRaw(raw, { 'x-hub-signature-256': signature }).expect(200)
    await postRaw(raw, { 'x-hub-signature-256': sign(raw, 'wrong') }).expect(400)
    const output = logged.join('\n')
    expect(output).not.toContain(SECRET)
    expect(output).not.toContain(signature.slice(7))
    expect(output).not.toContain('olá')
  })
})
