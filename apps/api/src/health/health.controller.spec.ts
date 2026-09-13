import { CanActivate, ExecutionContext, INestApplication, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { HealthController } from './health.controller'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const role = req.headers['x-test-role']
    if (!role) throw new UnauthorizedException()
    req.user = { sub: 'user-a', role, orgId: req.headers['x-test-org'] ?? 'org-a' }
    return true
  }
}

describe('HealthController authorization', () => {
  let app: INestApplication
  const prisma = { organization: { findUnique: jest.fn(({ where }) => Promise.resolve(where.id === 'org-a' ? { id: 'org-a' } : null)) } }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: 'PrismaService', useValue: prisma },
        RolesGuard,
        { provide: ActiveUserGuard, useValue: { canActivate: () => true } },
      ],
    })
      .useMocker((token) => token?.toString().includes('PrismaService') ? prisma : {})
      .overrideGuard(JwtAuthGuard).useClass(TestJwtGuard)
      .overrideGuard(ActiveUserGuard).useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(() => app.close())

  it('mantém health público estritamente mínimo', async () => {
    const { body } = await request(app.getHttpServer()).get('/health').expect(200)
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp'])
  })

  it.each(['1', 'true', 'TRUE', 'yes', '0'])('nega qualquer tentativa pública de details=%s', async (value) => {
    await request(app.getHttpServer()).get(`/health?DeTaIlS=${value}`).expect(401)
  })

  it('nega detalhes a visitante e usuário comum, sem executar consulta', async () => {
    prisma.organization.findUnique.mockClear()
    await request(app.getHttpServer()).get('/health/details').expect(401)
    await request(app.getHttpServer()).get('/health/details').set('x-test-role', 'OPERADOR').expect(403)
    expect(prisma.organization.findUnique).not.toHaveBeenCalled()
  })

  it('isola detalhes administrativos pelo orgId autenticado e não vaza falhas', async () => {
    const { body } = await request(app.getHttpServer()).get('/health/details').set('x-test-role', 'ADMIN').set('x-test-org', 'org-a').expect(200)
    expect(body).toMatchObject({ orgId: 'org-a', checks: { tenant: { ok: true } } })
    expect(JSON.stringify(body)).not.toMatch(/org-b|stack|secret|password/i)
    expect(prisma.organization.findUnique).toHaveBeenCalledWith({ where: { id: 'org-a' }, select: { id: true } })
  })
})

describe('HealthController readiness factual dependency checks', () => {
  const config = { get: jest.fn().mockReturnValue('') }

  function controller(input: {
    database?: 'up' | 'down'
    queue?: Record<string, unknown>
    pubSub?: Record<string, boolean>
  } = {}) {
    const prisma = {
      $queryRaw: input.database === 'down'
        ? jest.fn().mockRejectedValue(new Error('postgres unavailable'))
        : jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    }
    const queue = {
      getQueueStatus: jest.fn().mockResolvedValue(input.queue ?? { notifications: { waiting: 0 } }),
      isEnabled: jest.fn().mockReturnValue(input.queue?.ok !== false),
    }
    return {
      health: new HealthController(prisma as any, config as any, queue as any, {
        readiness: jest.fn().mockReturnValue(input.pubSub ?? {
          publisherReady: true, subscriberReady: true, subscribed: true, shuttingDown: false,
        }),
      } as any),
      prisma,
      queue,
    }
  }

  it('não declara ready quando PostgreSQL está indisponível', async () => {
    const { health } = controller({ database: 'down' })

    await expect(health.readiness()).rejects.toMatchObject({
      response: expect.objectContaining({
        status: 'not_ready',
        checks: expect.objectContaining({
          database: expect.objectContaining({ ok: false }),
          prismaClient: { ok: false },
        }),
      }),
    })
  })

  it('não declara ready quando Redis/fila está indisponível', async () => {
    const { health } = controller({
      queue: { ok: false, redisEnabled: false, reason: 'Redis indisponível', status: 'end' },
    })

    await expect(health.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException)
    await expect(health.readiness()).rejects.toMatchObject({
      response: expect.objectContaining({
        status: 'not_ready',
        checks: expect.objectContaining({ queue: expect.objectContaining({ ok: false }) }),
      }),
    })
  })

  it('volta a declarar ready após as dependências se recuperarem', async () => {
    const { health, prisma, queue } = controller({ database: 'down' })

    await expect(health.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException)

    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    queue.getQueueStatus.mockResolvedValue({ notifications: { waiting: 0 } })
    queue.isEnabled.mockReturnValue(true)

    await expect(health.readiness()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        database: expect.objectContaining({ ok: true }),
        prismaClient: { ok: true },
        queue: expect.objectContaining({ ok: true, enabled: true }),
      },
    })
  })

  it('mantém readiness crítico ready quando somente o Pub/Sub está indisponível', async () => {
    const { health } = controller({
      pubSub: { publisherReady: false, subscriberReady: false, subscribed: false, shuttingDown: false },
    })

    await expect(health.readiness()).resolves.toMatchObject({
      status: 'ready',
      integrations: {
        notificationPubSub: {
          availability: 'unavailable',
          publisher: 'unavailable',
          subscriber: 'unavailable',
          subscription: 'unavailable',
        },
      },
    })
  })
})
