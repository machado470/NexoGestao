import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID } from 'node:crypto'
import { get as httpGet, ClientRequest } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import request from 'supertest'
import { AppModule } from '../../src/app.module'
import { PrismaService } from '../../src/prisma/prisma.service'
import { NotificationStreamHub } from '../../src/notifications/notification-stream-hub.service'

const suite = process.env.RUN_REAL_INTEGRATION === 'true' ? describe : describe.skip
suite('Open notification stream revocation / real HTTP and PostgreSQL', () => {
  jest.setTimeout(90000)
  let app: INestApplication, db: PrismaService, hub: NotificationStreamHub, baseUrl: string
  const orgIds: string[] = [], userIds: string[] = [], streams: ClientRequest[] = []
  const jwt = new JwtService({ secret: process.env.JWT_SECRET })
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); app.setGlobalPrefix('v1'); await app.listen(0, '127.0.0.1')
    baseUrl = await app.getUrl(); db = app.get(PrismaService); hub = app.get(NotificationStreamHub)
  })
  afterEach(() => { for (const stream of streams.splice(0)) stream.destroy() })
  afterAll(async () => {
    try {
      await db.person.deleteMany({ where: { userId: { in: userIds } } }); await db.user.deleteMany({ where: { id: { in: userIds } } }); await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    } finally { await app?.close() }
  })
  async function fixture() {
    const orgId = randomUUID(), userId = randomUUID(), personId = randomUUID(); orgIds.push(orgId); userIds.push(userId)
    await db.organization.create({ data: { id: orgId, slug: orgId, name: 'SSE synthetic QA' } })
    await db.user.create({ data: { id: userId, orgId, email: `${userId}@test.invalid`, role: 'ADMIN', active: true, emailVerifiedAt: new Date() } })
    await db.person.create({ data: { id: personId, orgId, userId, name: 'SSE QA', role: 'TECH' } })
    const token = jwt.sign({ sub: userId, orgId, personId, role: 'ADMIN', sessionVersion: 0 }, { expiresIn: '1h' })
    return { orgId, userId, personId, token }
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>
  async function eventually(check: () => boolean, timeout = 5000) {
    const until = Date.now() + timeout
    while (!check()) { if (Date.now() > until) throw new Error('SSE condition timed out'); await delay(20) }
  }
  function open(f: Fixture) {
    return new Promise<{ frames: string[]; ended: () => boolean }>((resolve, reject) => {
      const frames: string[] = []; let ended = false, ready = false, body = ''
      const stream = httpGet(`${baseUrl}/v1/notifications/stream`, { headers: { Authorization: `Bearer ${f.token}` } }, res => {
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`Unexpected stream HTTP ${res.statusCode}`)); return }
        res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; frames.push(String(chunk)); if (!ready && body.includes('event: ready')) { ready = true; clearTimeout(timeout); resolve({ frames, ended: () => ended }) } })
        res.on('end', () => { ended = true }); res.on('error', reject)
      })
      const timeout = setTimeout(() => { stream.destroy(); reject(new Error('SSE ready timed out')) }, 5000)
      stream.on('error', error => { clearTimeout(timeout); if (!ready) reject(error) }); streams.push(stream)
    })
  }
  async function notify(f: Fixture, id = randomUUID()) {
    await hub.deliver({ version: 1, kind: 'notification.created', orgId: f.orgId, userId: f.userId, eventId: id, notificationId: randomUUID(), createdAt: new Date().toISOString() })
    return id
  }
  const revoke: Record<string, (f: Fixture) => Promise<unknown>> = {
    'session version': f => db.user.update({ where: { id: f.userId }, data: { sessionVersion: { increment: 1 } } }),
    'role': f => db.user.update({ where: { id: f.userId }, data: { role: 'VIEWER' } }),
    'inactive user': f => db.user.update({ where: { id: f.userId }, data: { active: false } }),
    'inactive person': f => db.person.update({ where: { id: f.personId }, data: { active: false } }),
    'missing person': f => db.person.delete({ where: { id: f.personId } }),
  }
  it.each(Object.keys(revoke))('ends the real socket before the next event after %s changes', async kind => {
    const f = await fixture(), stream = await open(f), delivered = await notify(f)
    await eventually(() => stream.frames.join('').includes(delivered))
    await revoke[kind](f); const withheld = await notify(f)
    await eventually(stream.ended)
    expect(stream.frames.join('')).not.toContain(withheld)
    await request(app.getHttpServer()).get('/v1/notifications').auth(f.token, { type: 'bearer' }).expect(401)
  })
  it('closes an idle socket at the periodic session check', async () => {
    const f = await fixture(), stream = await open(f)
    await db.user.update({ where: { id: f.userId }, data: { sessionVersion: { increment: 1 } } })
    await eventually(stream.ended, 30000)
    expect(stream.frames.join('')).not.toContain('heartbeat')
  })
  it('password reset revokes the open stream and old HTTP token without disrupting another tenant', async () => {
    const f = await fixture(), other = await fixture(), stream = await open(f), otherStream = await open(other), token = randomUUID()
    await db.user.update({ where: { id: f.userId }, data: { resetToken: createHash('sha256').update(token).digest('hex'), resetTokenExpiresAt: new Date(Date.now() + 60000) } })
    await request(app.getHttpServer()).post('/v1/auth/reset-password').send({ token, password: 'Synthetic-reset-QA-123!' }).expect(201)
    const withheld = await notify(f); await eventually(stream.ended)
    expect(stream.frames.join('')).not.toContain(withheld)
    await request(app.getHttpServer()).get('/v1/notifications').auth(f.token, { type: 'bearer' }).expect(401)
    const delivered = await notify(other); await eventually(() => otherStream.frames.join('').includes(delivered)); expect(otherStream.ended()).toBe(false)
    await request(app.getHttpServer()).get('/v1/notifications').auth(other.token, { type: 'bearer' }).expect(200)
    const persisted = await db.user.findUniqueOrThrow({ where: { id: f.userId } })
    const fresh = { ...f, token: jwt.sign({ sub: f.userId, orgId: f.orgId, personId: f.personId, role: 'ADMIN', sessionVersion: persisted.sessionVersion }, { expiresIn: '1h' }) }
    const freshStream = await open(fresh), next = await notify(fresh); await eventually(() => freshStream.frames.join('').includes(next))
  })
})
