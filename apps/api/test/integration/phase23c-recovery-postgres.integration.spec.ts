import { ConfigService } from '@nestjs/config'
import { ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../src/prisma/prisma.service'
import { HealthController } from '../../src/health/health.controller'
import { compose, eventually, assertDedicatedPhase23cInfrastructure } from './phase23c-harness'
import { describeRealIntegration, RUN_REAL_INTEGRATION, REAL_INTEGRATION_SKIP_REASON } from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] REAL POSTGRES: ${REAL_INTEGRATION_SKIP_REASON}`)

describeRealIntegration('Phase 2.3C — REAL POSTGRES down and recovery', () => {
  jest.setTimeout(90_000)
  const fixtureId = `phase23c-pg-${Date.now()}`
  let prisma: PrismaService
  let health: HealthController

  beforeAll(async () => {
    assertDedicatedPhase23cInfrastructure()
    prisma = new PrismaService({ get: () => undefined } as any)
    await prisma.$connect()
    health = new HealthController(prisma, new ConfigService(), {
      isEnabled: () => true, getQueueStatus: async () => ({ ok: true }),
    } as any)
    await prisma.organization.create({ data: { id: fixtureId, name: 'Phase 2.3C fixture', slug: fixtureId } })
  })

  afterAll(async () => {
    compose('postgres-phase23c', 'start')
    if (prisma) {
      await eventually(() => prisma.$queryRaw`SELECT 1`, () => true).catch(() => undefined)
      await prisma.organization.deleteMany({ where: { id: fixtureId } }).catch(() => undefined)
      await prisma.$disconnect()
    }
  })

  it('detects fail-closed without leaking connection material and reconnects automatically', async () => {
    expect(await health.readiness()).toMatchObject({ status: 'ready', checks: { database: { ok: true } } })
    const detectionStarted = Date.now()
    compose('postgres-phase23c', 'stop')
    const unavailable = await eventually(async () => {
      try { return await health.readiness() } catch (error) { return error }
    }, (value) => value instanceof ServiceUnavailableException)
    const response = (unavailable as ServiceUnavailableException).getResponse()
    expect(response).toMatchObject({ status: 'not_ready', checks: { database: { ok: false }, prismaClient: { ok: false } } })
    expect(response).not.toHaveProperty('stack')
    expect(response).not.toHaveProperty('error')
    expect(response).not.toHaveProperty('connectionString')
    expect(response).not.toHaveProperty('datasourceUrl')
    expect(response).not.toHaveProperty('checks.database.error')
    expect(response).not.toHaveProperty('checks.prismaClient.error')
    expect(JSON.stringify(response)).not.toMatch(/phase23c-local-only|postgresql:\/\/|DATABASE_URL|"(?:stack|error|connectionString|datasourceUrl)"\s*:|node_modules|prisma\/schema|P\d{4}|localhost:\d+|127\.0\.0\.1:\d+/i)
    expect(JSON.stringify(response)).not.toContain('"database":{"ok":true')
    console.info(`[phase23c] postgres detectionMs~${Date.now() - detectionStarted}`)

    const recoveryStarted = Date.now()
    compose('postgres-phase23c', 'start')
    const ready = await eventually(() => health.readiness(), (value: any) => value?.status === 'ready', 30_000)
    console.info(`[phase23c] postgres recoveryMs~${Date.now() - recoveryStarted}`)
    expect(ready).toMatchObject({ checks: { database: { ok: true } } })
    expect(await prisma.organization.findUnique({ where: { id: fixtureId } })).toMatchObject({ name: 'Phase 2.3C fixture' })
  })
})
