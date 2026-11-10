import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { FinanceController } from '../finance/finance.controller'
import { FinanceService } from '../finance/finance.service'
import { ManualPaymentsService } from '../finance/manual-payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { OperationalStateService } from '../people/operational-state.service'
import { TimelineService } from '../timeline/timeline.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService } from '../common/commercial/commercial-policy.service'

describe('Manual payment routes share the policy boundary', () => {
  let app: INestApplication
  const finance = { payCharge: jest.fn() }
  const prisma = { charge: { findFirst: jest.fn() } }
  const commercial = { enforceMeter: jest.fn() }
  const ops = { enforceLimit: jest.fn(), recordCriticalEvent: jest.fn(), increment: jest.fn() }
  const state = { getStatus: jest.fn() }
  const paths = ['/finance/charges/charge/pay', '/payments/charges/charge/pay']
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController, PaymentsController],
      providers: [ManualPaymentsService, RolesGuard,
        { provide: FinanceService, useValue: finance },
        { provide: PaymentsService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: CommercialPolicyService, useValue: commercial },
        { provide: TenantOperationsService, useValue: ops },
        { provide: OperationalStateService, useValue: state },
        { provide: TimelineService, useValue: { log: jest.fn() } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 'actor', orgId: 'org', personId: 'person', role: req.headers['x-role'] ?? 'MANAGER' }
      return true
    } }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => {
    jest.clearAllMocks()
    finance.payCharge.mockResolvedValue({ id: 'payment' })
    prisma.charge.findFirst.mockResolvedValue({ amountCents: 1000 })
    commercial.enforceMeter.mockResolvedValue({ allowed: true })
    ops.enforceLimit.mockReturnValue({ allowed: true })
    state.getStatus.mockResolvedValue({ state: 'NORMAL' })
  })
  it.each(paths)('%s preserves actor, method and idempotency header', async path => {
    await request(app.getHttpServer()).post(path).set('idempotency-key', 'retry-key')
      .send({ method: 'PIX', amountCents: 1000, notes: 'receipt' }).expect(201)
    expect(finance.payCharge).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org', chargeId: 'charge', actorUserId: 'actor', method: 'PIX', amountCents: 1000,
      notes: 'receipt', idempotencyKey: 'retry-key',
    }))
    expect(ops.enforceLimit).toHaveBeenCalledWith(expect.objectContaining({ scope: 'finance:pay-charge', orgId: 'org' }))
  })
  it.each(paths)('%s rejects commercial blocks before persistence', async path => {
    commercial.enforceMeter.mockResolvedValue({ allowed: false, reasonCode: 'blocked' })
    await request(app.getHttpServer()).post(path).send({ method: 'PIX', amountCents: 1000 }).expect(400)
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it.each(paths)('%s rejects shared tenant rate limits', async path => {
    ops.enforceLimit.mockReturnValue({ allowed: false, reason: 'rate-limit', used: 30 })
    await request(app.getHttpServer()).post(path).send({ method: 'PIX', amountCents: 1000 }).expect(400)
    expect(finance.payCharge).not.toHaveBeenCalled()
    expect(ops.increment).not.toHaveBeenCalled()
  })
  it.each(paths)('%s rejects restricted managers', async path => {
    state.getStatus.mockResolvedValue({ state: 'RESTRICTED' })
    await request(app.getHttpServer()).post(path).send({ method: 'PIX', amountCents: 1000 }).expect(403)
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it.each(paths)('%s rejects undeclared roles', async path => {
    await request(app.getHttpServer()).post(path).set('x-role', 'VIEWER').send({ method: 'PIX', amountCents: 1000 }).expect(403)
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it.each(paths)('%s gives the body idempotency key the canonical precedence', async path => {
    await request(app.getHttpServer()).post(path).set('idempotency-key', 'header-key')
      .send({ method: 'CASH', amountCents: 1000, idempotencyKey: 'body-key' }).expect(201)
    expect(finance.payCharge).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'body-key' }))
  })
  it.each(paths)('%s propagates financial conflicts without reporting success', async path => {
    const { ConflictException } = await import('@nestjs/common')
    finance.payCharge.mockRejectedValueOnce(new ConflictException('Charge cancelada'))
    await request(app.getHttpServer()).post(path).send({ method: 'PIX', amountCents: 1000 }).expect(409)
    expect(ops.increment).not.toHaveBeenCalled()
  })
  it('preserves the original empty-body manual payment contract', async () => {
    const response = await request(app.getHttpServer()).post(paths[1]).send({}).expect(201)
    expect(response.body).toEqual({ ok: true, message: 'Cobrança marcada como paga' })
    expect(finance.payCharge).toHaveBeenCalledWith(expect.objectContaining({ method: 'OTHER', amountCents: 1000 }))
  })
  it.each(['manual', 'pix', 'cash', 'card', 'transfer'])('supports legacy method %s and tenant-scoped amount', async paymentMethod => {
    await request(app.getHttpServer()).post(paths[1]).send({ paymentMethod }).expect(201)
    expect(prisma.charge.findFirst).toHaveBeenCalledWith({ where: { id: 'charge', orgId: 'org' }, select: { amountCents: true } })
    expect(finance.payCharge).toHaveBeenCalledWith(expect.objectContaining({ method: paymentMethod === 'manual' ? 'OTHER' : paymentMethod.toUpperCase(), amountCents: 1000 }))
  })
  it('returns 404 for a charge absent from the tenant instead of false success', async () => {
    prisma.charge.findFirst.mockResolvedValue(null)
    await request(app.getHttpServer()).post(paths[1]).send({}).expect(404)
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it.each([{ paymentMethod: 'invalid' }, { method: 'PIX', paymentMethod: 'cash' }, { amountCents: -1 }, { amountCents: null }, { paymentMethod: null }])('rejects malformed legacy payment %p', async body => {
    await request(app.getHttpServer()).post(paths[1]).send(body).expect(400)
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
})
