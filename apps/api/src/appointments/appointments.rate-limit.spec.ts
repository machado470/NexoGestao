import { Controller, Get, INestApplication } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { ConfigService } from '@nestjs/config'
import request from 'supertest'
import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'
import { QuotasService } from '../quotas/quotas.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuthController } from '../auth/auth.controller'
import { AuthService } from '../auth/auth.service'
import { GoogleIdTokenVerifier } from '../auth/google-id-token-verifier'

@Controller('unrelated')
class UnrelatedController { @Get() list() { return { ok: true } } }

describe('appointment read request budget', () => {
  let app: INestApplication
  const appointments = { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn() }
  const quotas = { validateQuota: jest.fn() }
  const auth = { login: jest.fn() }

  beforeEach(async () => {
    jest.resetAllMocks()
    appointments.list.mockResolvedValue({ data: [], pagination: {} })
    appointments.get.mockImplementation(async (_org, id) => ({ id }))
    appointments.create.mockResolvedValue({ id: 'created' })
    appointments.update.mockResolvedValue({ id: 'updated' })
    auth.login.mockResolvedValue({ token: 'test-session' })
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AppointmentsController, AuthController, UnrelatedController],
      providers: [
        RolesGuard, { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: AppointmentsService, useValue: appointments },
        { provide: QuotasService, useValue: quotas },
        { provide: AuthService, useValue: auth },
        { provide: GoogleIdTokenVerifier, useValue: { verify: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 'user', userId: 'user', orgId: 'org', role: req.headers['x-test-role'] || 'ADMIN' }
      return true
    } }).compile()
    app = module.createNestApplication()
    await app.init()
  })
  afterEach(async () => app?.close())

  it('permits refreshes across list query variants and still caps the route at 120 per minute', async () => {
    for (let index = 0; index < 120; index++) {
      await request(app.getHttpServer()).get(`/appointments?limit=${index % 2 ? 1000 : 100}&page=${index + 1}`).expect(200)
    }
    await request(app.getHttpServer()).get('/appointments?limit=1&page=999').expect(429)
    expect(appointments.list).toHaveBeenCalledTimes(120)
  })
  it('shares a finite detail budget across different record identifiers', async () => {
    for (let index = 0; index < 120; index++) await request(app.getHttpServer()).get(`/appointments/record-${index}`).expect(200)
    await request(app.getHttpServer()).get('/appointments/new-record').expect(429)
    expect(appointments.get).toHaveBeenCalledTimes(120)
  })
  it('keeps read and creation budgets separate and preserves creation throttling', async () => {
    for (let index = 0; index < 12; index++) await request(app.getHttpServer()).get('/appointments').expect(200)
    for (let index = 0; index < 10; index++) await request(app.getHttpServer()).post('/appointments').send({ customerId: 'customer' }).expect(201)
    await request(app.getHttpServer()).post('/appointments').send({ customerId: 'customer' }).expect(429)
    expect(appointments.create).toHaveBeenCalledTimes(10)
    expect(quotas.validateQuota).toHaveBeenCalledTimes(10)
  })
  it('preserves mutation throttling across different record identifiers', async () => {
    for (let index = 0; index < 10; index++) await request(app.getHttpServer()).patch(`/appointments/record-${index}`).send({ notes: 'edited' }).expect(200)
    await request(app.getHttpServer()).patch('/appointments/another-record').send({ notes: 'edited' }).expect(429)
    expect(appointments.update).toHaveBeenCalledTimes(10)
  })
  it('keeps VIEWER read-only despite the larger read budget', async () => {
    for (let index = 0; index < 12; index++) await request(app.getHttpServer()).get('/appointments').set('x-test-role', 'VIEWER').expect(200)
    await request(app.getHttpServer()).patch('/appointments/record').set('x-test-role', 'VIEWER').send({ notes: 'forbidden' }).expect(403)
    await request(app.getHttpServer()).post('/appointments').set('x-test-role', 'VIEWER').send({ customerId: 'customer' }).expect(403)
    expect(appointments.create).not.toHaveBeenCalled()
    expect(appointments.update).not.toHaveBeenCalled()
  })
  it('preserves the five-attempt login limit from the authentication policy', async () => {
    for (let index = 0; index < 5; index++) await request(app.getHttpServer()).post('/auth/login').send({ email: 'test@example.com', password: 'test' }).expect(201)
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'test@example.com', password: 'test' }).expect(429)
    expect(auth.login).toHaveBeenCalledTimes(5)
  })
  it('does not widen unrelated GET endpoints', async () => {
    for (let index = 0; index < 10; index++) await request(app.getHttpServer()).get('/unrelated').expect(200)
    await request(app.getHttpServer()).get('/unrelated').expect(429)
  })
})
