import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AuditService } from '../audit/audit.service'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequestContextService } from '../common/context/request-context.service'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { ExecutionConfigService } from '../execution/execution.config'
import { ExecutionController } from '../execution/execution.controller'
import { ExecutionEventsService } from '../execution/execution.events'
import { ExecutionRunner } from '../execution/execution.runner'
import { ExecutionService } from '../execution/execution.service'
import { OperationalStateJob } from '../people/operational-state.job'
import { OperationalStateAdminController } from './operational-state.admin.controller'

/**
 * C8 PR3-3B-7 — POST /executions/runner/run-once and POST /admin/operational-state/run-once:
 * ADMIN-only, scoped to the session organization, no cooldown bypass over HTTP, one audit event per
 * attempt that reaches the handler. Real persisted sessions are exercised in the PostgreSQL spec.
 */
const USERS = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'p-admin-a' },
  managerA: { userId: 'u-manager-a', orgId: 'org-a', role: 'MANAGER', personId: 'p-manager-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'p-staff-a' },
  viewerA: { userId: 'u-viewer-a', orgId: 'org-a', role: 'VIEWER', personId: 'p-viewer-a' },
  operadorA: { userId: 'u-op-a', orgId: 'org-a', role: 'OPERADOR', personId: 'p-op-a' },
  financeiroA: { userId: 'u-fin-a', orgId: 'org-a', role: 'FINANCEIRO', personId: 'p-fin-a' },
  noRoleA: { userId: 'u-norole-a', orgId: 'org-a', role: undefined, personId: 'p-norole-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'p-admin-b' },
} as const
type UserKey = keyof typeof USERS
const NON_ADMIN: UserKey[] = ['managerA', 'staffA', 'viewerA', 'operadorA', 'financeiroA', 'noRoleA']

const RUNNER_PATH = '/executions/runner/run-once'
const STATE_PATH = '/admin/operational-state/run-once'
const runnerResult = (orgId: string) => ({
  orgs: 1, totalCandidates: 2, executed: 1, blocked: 1, blockedRecent: 0, failed: 0, skipped: 0,
  debugExecution: false, blockedByReason: { feature_not_in_plan: 1 }, correlationId: `cycle-${orgId}`,
})

const runner = { runOnce: jest.fn(async (options: any) => runnerResult(options.scope.orgId)) }
const job = { run: jest.fn(async () => ({ evaluated: 3, changed: 1 })) }
const audit = { log: jest.fn(async (params: any) => ({ id: 'audit-1', ...params })) }
const requestContext = { correlationId: 'corr-req-1' }

describe('C8 PR3-3B-7: manual administrative runs are ADMIN-only, organization-scoped and audited', () => {
  let app: INestApplication
  const call = (path: string, user?: UserKey, body?: object) => {
    const req = request(app.getHttpServer()).post(path)
    if (user) req.set('x-test-user', user)
    return body ? req.send(body) : req
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ExecutionController, OperationalStateAdminController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        RolesGuard,
        { provide: ExecutionRunner, useValue: runner },
        { provide: OperationalStateJob, useValue: job },
        { provide: AuditService, useValue: audit },
        { provide: RequestContextService, useValue: requestContext },
        { provide: ExecutionService, useValue: {} },
        { provide: ExecutionEventsService, useValue: {} },
        { provide: ExecutionConfigService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          const user = (USERS as Record<string, (typeof USERS)[UserKey]>)[req.headers['x-test-user']]
          if (!user) throw new UnauthorizedException()
          req.user = { sub: user.userId, ...user }
          return true
        },
      })
      .compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => jest.clearAllMocks())

  const expectNoEffects = () => {
    expect(runner.runOnce).not.toHaveBeenCalled()
    expect(job.run).not.toHaveBeenCalled()
    expect(audit.log).not.toHaveBeenCalled()
  }

  describe('runner/run-once', () => {
    it('ADMIN A runs only org-a, response contract preserved, without platform totals', async () => {
      const res = await call(RUNNER_PATH, 'adminA').expect(201)
      expect(runner.runOnce).toHaveBeenCalledTimes(1)
      expect(runner.runOnce).toHaveBeenCalledWith({ debugExecution: false, scope: { orgId: 'org-a' } })
      expect(res.body).toEqual(runnerResult('org-a'))
      expect(res.body.orgs).toBe(1)
    })

    it('ADMIN B runs only org-b', async () => {
      await call(RUNNER_PATH, 'adminB').expect(201)
      expect(runner.runOnce).toHaveBeenCalledWith({ debugExecution: false, scope: { orgId: 'org-b' } })
    })

    it('overrideCooldown is never forwarded, whatever the value', async () => {
      for (const value of ['1', 'true', 'yes']) await call(`${RUNNER_PATH}?overrideCooldown=${value}`, 'adminA').expect(201)
      for (const [options] of runner.runOnce.mock.calls as any[]) {
        expect(options).not.toHaveProperty('overrideCooldown')
        expect(options.scope).toEqual({ orgId: 'org-a' })
      }
      expect(audit.log.mock.calls[0][0].metadata.requested).toEqual({ debugExecution: false, overrideCooldownIgnored: true })
    })

    it('one audit event with the verified author, organization, operation, outcome and counters', async () => {
      await call(RUNNER_PATH, 'adminA').expect(201)
      expect(audit.log).toHaveBeenCalledTimes(1)
      expect(audit.log).toHaveBeenCalledWith({
        orgId: 'org-a',
        action: 'MANUAL_EXECUTION_RUNNER_RUN',
        actorUserId: 'u-admin-a',
        actorPersonId: 'p-admin-a',
        entityType: 'Organization',
        entityId: 'org-a',
        context: 'executions.runner.run-once: SUCCEEDED',
        metadata: {
          operation: 'executions.runner.run-once',
          scope: 'organization',
          correlationId: 'corr-req-1',
          requested: { debugExecution: false, overrideCooldownIgnored: false },
          outcome: 'SUCCEEDED',
          counters: { totalCandidates: 2, executed: 1, blocked: 1, blockedRecent: 0, failed: 0, skipped: 0, runnerCorrelationId: 'cycle-org-a' },
        },
      })
    })

    it('a cycle with failed actions is audited as COMPLETED_WITH_FAILURES, a delayed cycle as SKIPPED_CYCLE_DELAY', async () => {
      runner.runOnce.mockResolvedValueOnce({ ...runnerResult('org-a'), failed: 1 })
      await call(RUNNER_PATH, 'adminA').expect(201)
      runner.runOnce.mockResolvedValueOnce({ orgs: 0, totalCandidates: 0, executed: 0, delayed: true } as any)
      await call(RUNNER_PATH, 'adminA').expect(201)
      expect(audit.log.mock.calls.map((c: any[]) => c[0].metadata.outcome)).toEqual(['COMPLETED_WITH_FAILURES', 'SKIPPED_CYCLE_DELAY'])
    })

    it('a failing run is audited as FAILED (never success), without the error message, and the error propagates', async () => {
      runner.runOnce.mockRejectedValueOnce(new Error('secret-ish internal detail'))
      const res = await call(RUNNER_PATH, 'adminA').expect(500)
      expect(JSON.stringify(res.body)).not.toContain('secret-ish')
      expect(audit.log).toHaveBeenCalledTimes(1)
      const { metadata, context } = audit.log.mock.calls[0][0]
      expect(metadata).toMatchObject({ outcome: 'FAILED', partialEffectsPossible: true, error: { type: 'Error', status: null } })
      expect(context).toBe('executions.runner.run-once: falhou')
      expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain('secret-ish')
    })

    it.each(NON_ADMIN)('%s gets 403 and nothing runs or is audited', async (user) => {
      const res = await call(RUNNER_PATH, user).expect(403)
      expect(res.body.error).toMatch(/Sem permissão/)
      expectNoEffects()
    })
  })

  describe('admin/operational-state/run-once', () => {
    it('ADMIN A recalculates only org-a and the audit records author and counters', async () => {
      const res = await call(STATE_PATH, 'adminA').expect(201)
      expect(res.body).toEqual({ ok: true })
      expect(job.run).toHaveBeenCalledWith({ orgId: 'org-a' })
      expect(audit.log).toHaveBeenCalledTimes(1)
      expect(audit.log.mock.calls[0][0]).toMatchObject({
        orgId: 'org-a', action: 'MANUAL_OPERATIONAL_STATE_RUN', actorUserId: 'u-admin-a', actorPersonId: 'p-admin-a', entityType: 'Organization', entityId: 'org-a',
        metadata: { operation: 'admin.operational-state.run-once', scope: 'organization', correlationId: 'corr-req-1', outcome: 'SUCCEEDED', counters: { evaluated: 3, changed: 1 } },
      })
    })

    it('ADMIN B recalculates only org-b', async () => {
      await call(STATE_PATH, 'adminB').expect(201)
      expect(job.run).toHaveBeenCalledWith({ orgId: 'org-b' })
    })

    it('a failing recalculation is audited as FAILED and the error propagates', async () => {
      job.run.mockRejectedValueOnce(new Error('boom'))
      await call(STATE_PATH, 'adminA').expect(500)
      expect(audit.log.mock.calls.map((c: any[]) => c[0].metadata.outcome)).toEqual(['FAILED'])
    })

    it.each(NON_ADMIN)('%s gets 403 and nothing runs or is audited', async (user) => {
      await call(STATE_PATH, user).expect(403)
      expectNoEffects()
    })
  })

  describe.each([RUNNER_PATH, STATE_PATH])('%s — authentication and tenant', (path) => {
    it('no credentials or an unknown session: 401 and no effect', async () => {
      await call(path).expect(401)
      await call(path, 'forged' as UserKey).expect(401)
      expectNoEffects()
    })

    it('a foreign orgId (query or body) is refused before the handler; nothing runs or is audited', async () => {
      await call(`${path}?orgId=org-b`, 'adminA').expect(403)
      await call(path, 'adminA', { orgId: 'org-b' }).expect(403)
      await call(path, 'adminA', { organizationId: 'org-b' }).expect(403)
      expectNoEffects()
    })

    it('a client orgId equal to the session organization changes nothing', async () => {
      await call(`${path}?orgId=org-a`, 'adminA').expect(201)
      const scope = path === RUNNER_PATH ? (runner.runOnce.mock.calls[0] as any[])[0].scope : (job.run.mock.calls[0] as any[])[0]
      expect(scope).toEqual({ orgId: 'org-a' })
    })
  })

  it('structure: JwtAuthGuard → RolesGuard and ADMIN-only on both routes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ExecutionController)).toEqual([JwtAuthGuard, RolesGuard])
    expect(Reflect.getMetadata(ROLES_KEY, ExecutionController.prototype.runOnce)).toEqual(['ADMIN'])
    expect(Reflect.getMetadata(GUARDS_METADATA, OperationalStateAdminController)).toEqual([JwtAuthGuard, RolesGuard])
    expect(Reflect.getMetadata(ROLES_KEY, OperationalStateAdminController)).toEqual(['ADMIN'])
  })
})
