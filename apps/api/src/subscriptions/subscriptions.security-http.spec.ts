import { INestApplication, ServiceUnavailableException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PassportModule } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import request from 'supertest'
import { SubscriptionsController } from './subscriptions.controller'
import { SubscriptionsService } from './subscriptions.service'
import { BillingService } from '../billing/billing.service'
import { PlansService } from '../plans/plans.service'
import { JwtStrategy } from '../auth/jwt.strategy'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'

describe('Legacy subscription routes with signed sessions', () => {
  const secret = 'subscription-test-secret'
  const jwt = new JwtService({ secret })
  const users = new Map<string, any>()
  const billing = { cancelSubscription: jest.fn() }
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.get(where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) => {
        const user = users.get(where.id)
        return user?.active && user.orgId === where.orgId ? user : null
      }),
    },
    subscription: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  }
  let app: INestApplication
  const authorization = (id = 'ADMIN') => {
    const user = users.get(id)
    return `Bearer ${jwt.sign({ sub: id, orgId: user.orgId, role: user.role, personId: user.person.id, sessionVersion: user.sessionVersion }, { expiresIn: 3600 })}`
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PassportModule], controllers: [SubscriptionsController], providers: [
      SubscriptionsService, JwtStrategy, JwtAuthGuard, ActiveUserGuard, RolesGuard,
      { provide: ConfigService, useValue: { get: (key: string) => key === 'JWT_SECRET' ? secret : undefined } },
      { provide: PrismaService, useValue: prisma }, { provide: PlansService, useValue: {} },
      { provide: BillingService, useValue: billing },
    ] }).compile()
    app = module.createNestApplication(); await app.init()
  })
  beforeEach(() => {
    jest.clearAllMocks(); users.clear()
    for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER', 'OPERADOR', 'FINANCEIRO']) {
      users.set(role, { id: role, orgId: 'org-a', role, active: true, sessionVersion: 0, person: { id: role, active: true } })
    }
    billing.cancelSubscription.mockResolvedValue({ status: 'CANCELED' })
    prisma.subscription.findUnique.mockResolvedValue(null)
  })
  afterAll(async () => app.close())
  afterEach(() => {
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.subscription.create).not.toHaveBeenCalled()
  })
  it.each(['FREE', 'STARTER', 'PRO', 'BUSINESS', 'invalid'])('does not activate %s from an organization admin request', async plan => {
    await request(app.getHttpServer()).patch(`/subscriptions/${plan}`).set('Authorization', authorization()).expect(405)
    expect(billing.cancelSubscription).not.toHaveBeenCalled()
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
  })
  it('cancels through Billing with the authenticated organization, ignoring spoofed tenant data', async () => {
    await request(app.getHttpServer()).post('/subscriptions/cancel?orgId=org-b')
      .set('x-org-id', 'org-b').set('Authorization', authorization()).send({ orgId: 'org-b' }).expect(201)
    expect(billing.cancelSubscription).toHaveBeenCalledWith('org-a')
  })
  it('propagates provider failure instead of local cancellation or false success', async () => {
    billing.cancelSubscription.mockRejectedValueOnce(new ServiceUnavailableException('Stripe indisponível'))
    await request(app.getHttpServer()).post('/subscriptions/cancel').set('Authorization', authorization()).expect(503)
  })
  it.each(['MANAGER', 'STAFF', 'VIEWER', 'OPERADOR', 'FINANCEIRO'])('rejects mutation by %s', async role => {
    await request(app.getHttpServer()).patch('/subscriptions/BUSINESS').set('Authorization', authorization(role)).expect(403)
    await request(app.getHttpServer()).post('/subscriptions/cancel').set('Authorization', authorization(role)).expect(403)
    expect(billing.cancelSubscription).not.toHaveBeenCalled()
  })
  it('rejects anonymous, invalid and revoked sessions', async () => {
    for (const path of ['/subscriptions/BUSINESS', '/subscriptions/cancel']) {
      const send = () => path.endsWith('cancel') ? request(app.getHttpServer()).post(path) : request(app.getHttpServer()).patch(path)
      await send().expect(401)
      await send().set('Authorization', 'Bearer invalid').expect(401)
      const token = authorization()
      users.get('ADMIN').sessionVersion++
      await send().set('Authorization', token).expect(401)
    }
    expect(billing.cancelSubscription).not.toHaveBeenCalled()
  })
  it.each(['/subscriptions/status', '/subscriptions/organization'])('%s is a read scoped to the authenticated tenant', async path => {
    prisma.subscription.findUnique.mockResolvedValue({ id: 'subscription', status: 'TRIALING', currentPeriodEnd: new Date(0) })
    await request(app.getHttpServer()).get(`${path}?orgId=org-b`).set('Authorization', authorization('VIEWER')).expect(200)
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { orgId: 'org-a' }, include: { plan: true } })
  })
})
