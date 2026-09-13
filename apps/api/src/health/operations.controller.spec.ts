import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { OperationsController } from './operations.controller'

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const role = req.headers['x-test-role']
    if (!role) throw new UnauthorizedException()
    req.user = {
      sub: `user-${req.headers['x-test-org'] ?? 'org-a'}`,
      role,
      orgId: req.headers['x-test-org'] ?? 'org-a',
    }
    return true
  }
}

describe('OperationsController authorization', () => {
  let app: INestApplication
  const monitoring = {
    summary: jest.fn(),
    queues: jest.fn(),
    dlq: jest.fn(),
  }
  const incidents = { list: jest.fn() }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [RolesGuard],
    })
      .useMocker((token) => token?.toString().includes('OperationalMonitoringService') ? monitoring : incidents)
      .overrideGuard(JwtAuthGuard).useClass(TestJwtGuard)
      .overrideGuard(ActiveUserGuard).useValue({ canActivate: () => true })
      .compile()

    app = module.createNestApplication()
    await app.init()
  })

  afterEach(() => jest.clearAllMocks())
  afterAll(() => app.close())

  const paths = [
    '/internal/operations/summary',
    '/internal/operations/incidents',
    '/internal/operations/queues',
    '/internal/operations/dlq',
    '/internal/operations/recent-failures',
  ]

  it.each(paths)('%s exige autenticação e preserva a regra de role atual', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401)
    for (const role of ['OPERADOR', 'FINANCEIRO', 'MANAGER', 'STAFF', 'VIEWER']) {
      await request(app.getHttpServer()).get(path).set('x-test-role', role).expect(403)
    }
    expectNoGlobalTelemetryRead()
  })

  it.each(paths)('%s nega fatos globais aos ADMINs das organizações A e B', async (path) => {
    const responseA = await request(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'ADMIN')
      .set('x-test-org', 'org-a')
      .expect(403)
    const responseB = await request(app.getHttpServer())
      .get(path)
      .set('x-test-role', 'ADMIN')
      .set('x-test-org', 'org-b')
      .expect(403)

    for (const body of [responseA.body, responseB.body]) {
      expect(JSON.stringify(body)).not.toMatch(/secret|token|dsn|redis:\/\/|postgres(?:ql)?:\/\//i)
    }
    expectNoGlobalTelemetryRead()
  })

  it.each(paths)('%s ignora tentativas de troca de orgId no request', async (path) => {
    await request(app.getHttpServer())
      .get(`${path}?orgId=org-b`)
      .set('x-test-role', 'ADMIN')
      .set('x-test-org', 'org-a')
      .set('x-org-id', 'org-b')
      .expect(403)

    expectNoGlobalTelemetryRead()
  })

  function expectNoGlobalTelemetryRead() {
    expect(monitoring.summary).not.toHaveBeenCalled()
    expect(monitoring.queues).not.toHaveBeenCalled()
    expect(monitoring.dlq).not.toHaveBeenCalled()
    expect(incidents.list).not.toHaveBeenCalled()
  }
})
