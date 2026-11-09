import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PassportModule } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import request from 'supertest'
import { QueueController } from '../queue/queue.controller'
import { QueueService } from '../queue/queue.service'
import { InternalStatsController } from './internal-stats.controller'
import { JwtStrategy } from '../auth/jwt.strategy'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'
import { QueueObservabilityService } from '../common/metrics/queue-observability.service'
import { QueueMetricsExporterService } from '../common/metrics/queue-metrics-exporter.service'
import { OperationalDiagnosticsService } from './operational-diagnostics.service'
import { OperationalSignalsService } from './operational-signals.service'

// Real JWT verification/roles/active-user guards; only persistence and telemetry sources are simulated.
describe('Global telemetry alternate routes with signed sessions', () => {
  const paths = ['/queue/status', '/internal/metrics']
  const roles = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER', 'OPERADOR', 'FINANCEIRO']
  const secret = 'telemetry-tests-only-secret'
  const jwt = new JwtService({ secret })
  const users = new Map<string, any>()
  const queues = { getQueueStatus: jest.fn() }
  const exporter = { exportJson: jest.fn() }
  const prisma = { user: {
    findUnique: jest.fn(async ({ where }: any) => users.get(where.id) ?? null),
    findFirst: jest.fn(async ({ where }: any) => {
      const user = users.get(where.id)
      return user?.active && user.orgId === where.orgId ? user : null
    }),
  } }
  let app: INestApplication
  const authorization = (id: string) => {
    const user = users.get(id)
    return `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person.id, sessionVersion: user.sessionVersion }, { expiresIn: 3600 })}`
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PassportModule], controllers: [QueueController, InternalStatsController], providers: [
      JwtStrategy, JwtAuthGuard, ActiveUserGuard, RolesGuard,
      { provide: ConfigService, useValue: { get: (key: string) => key === 'JWT_SECRET' ? secret : undefined } },
      { provide: PrismaService, useValue: prisma }, { provide: QueueService, useValue: queues },
      { provide: WhatsAppObservabilityService, useValue: {} }, { provide: QueueObservabilityService, useValue: {} },
      { provide: QueueMetricsExporterService, useValue: exporter },
      { provide: OperationalDiagnosticsService, useValue: {} }, { provide: OperationalSignalsService, useValue: {} },
    ] }).compile()
    app = module.createNestApplication(); await app.init()
  })
  beforeEach(() => {
    jest.clearAllMocks(); users.clear()
    for (const role of roles) for (const orgId of ['org-a', 'org-b']) {
      const id = `${orgId}-${role}`
      users.set(id, { id, orgId, role, active: true, sessionVersion: 0, person: { id: `person-${id}`, active: true } })
    }
  })
  afterEach(() => {
    expect(queues.getQueueStatus).not.toHaveBeenCalled()
    expect(exporter.exportJson).not.toHaveBeenCalled()
  })
  afterAll(async () => { await app.close() })
  it.each(paths)('%s rejects visitors and invalid signatures before reading telemetry', async path => {
    await request(app.getHttpServer()).get(path).expect(401)
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer invalid').expect(401)
  })
  it.each(roles)('does not expose global data to organization role %s', async role => {
    for (const path of paths) for (const org of ['org-a', 'org-b']) {
      const { body } = await request(app.getHttpServer()).get(path).set('Authorization', authorization(`${org}-${role}`)).expect(403)
      expect(JSON.stringify(body)).not.toMatch(/org-a|org-b|redis:\/\/|postgres(?:ql)?:\/\/|backlog|counters|gauges/)
    }
  })
  it.each(paths)('%s does not accept an orgId query/header as platform authority', async path => {
    await request(app.getHttpServer()).get(`${path}?orgId=org-b`).set('x-org-id', 'org-b').set('Authorization', authorization('org-a-ADMIN')).expect(403)
  })
  it.each(paths)('%s rejects revoked or inactive sessions', async path => {
    const token = authorization('org-a-ADMIN')
    users.get('org-a-ADMIN').active = false
    await request(app.getHttpServer()).get(path).set('Authorization', token).expect(401)
    users.get('org-a-ADMIN').active = true
    users.get('org-a-ADMIN').sessionVersion++
    await request(app.getHttpServer()).get(path).set('Authorization', token).expect(401)
  })
})
