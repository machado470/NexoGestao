import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { OnboardingController } from './onboarding.controller'
import { OnboardingService } from './onboarding.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('onboarding completion HTTP boundary', () => {
  let app: INestApplication
  let ready = false
  const update = jest.fn()
  beforeAll(async () => {
    const prisma = {
      organization: { findUnique: jest.fn(async () => ({ requiresOnboarding: true })), update },
      customer: { count: jest.fn(async () => ready ? 1 : 0) },
      serviceOrder: { count: jest.fn(async () => ready ? 1 : 0) },
      charge: { count: jest.fn(async () => ready ? 1 : 0) },
    }
    const module = await Test.createTestingModule({ controllers: [OnboardingController], providers: [RolesGuard, { provide: OnboardingService, useValue: new OnboardingService(prisma as any) }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
        const req = context.switchToHttp().getRequest()
        req.user = { orgId: 'authenticated-org', role: req.headers['x-test-role'] || 'ADMIN' }
        return true
      } }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  beforeEach(() => { ready = false; update.mockClear() })
  afterAll(async () => app?.close())
  it('keeps ready status reads read-only', async () => {
    ready = true
    const response = await request(app.getHttpServer()).get('/onboarding/status').expect(200)
    expect(response.body.requiresOnboarding).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['/onboarding/complete', '/onboarding/complete-step'])('rejects incomplete evidence at %s', async path => {
    await request(app.getHttpServer()).post(path).send(path.endsWith('complete-step') ? { step: 'createCharge' } : {}).expect(400)
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['STAFF', 'VIEWER'])('does not let %s finalize organization setup', async role => {
    ready = true
    await request(app.getHttpServer()).post('/onboarding/complete').set('x-test-role', role).send({}).expect(403)
    await request(app.getHttpServer()).post('/onboarding/complete-step').set('x-test-role', role).send({ step: 'createCharge' }).expect(403)
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['ADMIN', 'MANAGER'])('allows %s to finalize persisted evidence for its own tenant', async role => {
    ready = true
    const response = await request(app.getHttpServer()).post('/onboarding/complete').set('x-test-role', role).send({}).expect(201)
    expect(response.body.requiresOnboarding).toBe(false)
    expect(update).toHaveBeenCalledWith({ where: { id: 'authenticated-org' }, data: { requiresOnboarding: false } })
  })
})
