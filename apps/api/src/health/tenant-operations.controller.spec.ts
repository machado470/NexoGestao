import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantOperationsController } from './tenant-operations.controller'
import { TenantOperationsService } from './tenant-operations.service'

class TestIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    req.user = { orgId: req.headers.authorization === 'Bearer token-b' ? 'org-b' : 'org-a', role: 'ADMIN', active: true }
    return true
  }
}

describe('TenantOperationsController', () => {
  let app: INestApplication
  const service = { getSummary: jest.fn(async (orgId: string) => ({ contractVersion: 1, generatedAt: '2026-09-13T00:00:00.000Z', facts: [{ key: 'whatsapp', status: 'unknown', observedAt: '2026-09-13T00:00:00.000Z', reasonCode: 'TENANT_CONFIGURATION_NOT_OBSERVABLE', facts: { failedMessages: orgId === 'org-a' ? 1 : 9 } }] })) }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [TenantOperationsController], providers: [{ provide: TenantOperationsService, useValue: service }] })
      .overrideGuard(JwtAuthGuard).useClass(TestIdentityGuard)
      .overrideGuard(ActiveUserGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())
  beforeEach(() => service.getSummary.mockClear())

  it('uses only the authenticated org and ignores query/header spoofing', async () => {
    const response = await request(app.getHttpServer()).get('/v1/operations/tenant-summary?orgId=org-b').set('Authorization', 'Bearer token-a').set('x-org-id', 'org-b').send({ orgId: 'org-b' }).expect(200)
    expect(service.getSummary).toHaveBeenCalledWith('org-a')
    expect(response.body.facts[0].facts.failedMessages).toBe(1)
    expect(JSON.stringify(response.body)).not.toContain('orgId')
  })

  it('keeps organization A and B responses isolated', async () => {
    const a = await request(app.getHttpServer()).get('/v1/operations/tenant-summary').set('Authorization', 'Bearer token-a').expect(200)
    const b = await request(app.getHttpServer()).get('/v1/operations/tenant-summary').set('Authorization', 'Bearer token-b').expect(200)
    expect(a.body.facts[0].facts.failedMessages).toBe(1)
    expect(b.body.facts[0].facts.failedMessages).toBe(9)
    expect(service.getSummary).toHaveBeenNthCalledWith(1, 'org-a')
    expect(service.getSummary).toHaveBeenNthCalledWith(2, 'org-b')
  })
})
