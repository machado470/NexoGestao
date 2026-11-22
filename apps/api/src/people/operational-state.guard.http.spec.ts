import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AssignmentsController } from '../assignments/assignments.controller'
import { AssignmentsService } from '../assignments/assignments.service'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CommercialPolicyService } from '../common/commercial/commercial-policy.service'
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CorrectiveActionsController } from '../corrective-actions/corrective-actions.controller'
import { CorrectiveActionsService } from '../corrective-actions/corrective-actions.service'
import { FinanceController } from '../finance/finance.controller'
import { FinanceService } from '../finance/finance.service'
import { ManualPaymentsService } from '../finance/manual-payments.service'
import { TimelineService } from '../timeline/timeline.service'
import { OperationalStateGuard, RESTRICTED_REGULARIZATION_ROUTES } from './operational-state.guard'
import { OperationalStateService } from './operational-state.service'

/**
 * C8 PR3-3B-1 (CA-3) — OperationalStateGuard bypass through the request URL.
 *
 * The guard allowed a RESTRICTED person to POST when `originalUrl` contained `/corrective-actions`
 * or `/reassess`. `originalUrl` includes the query string, so `POST /v1/finance/...?x=/reassess`
 * passed. The real guard runs here behind real controllers (finance, assignments, corrective
 * actions) mounted with the production global prefix `v1`.
 */

const USERS = {
  managerRestricted: { userId: 'u-mgr-r', orgId: 'org-a', role: 'MANAGER', personId: 'p-restricted' },
  staffRestricted: { userId: 'u-staff-r', orgId: 'org-a', role: 'STAFF', personId: 'p-restricted' },
  managerSuspended: { userId: 'u-mgr-s', orgId: 'org-a', role: 'MANAGER', personId: 'p-suspended' },
  staffSuspended: { userId: 'u-staff-s', orgId: 'org-a', role: 'STAFF', personId: 'p-suspended' },
  managerNormal: { userId: 'u-mgr-n', orgId: 'org-a', role: 'MANAGER', personId: 'p-normal' },
  staffNormal: { userId: 'u-staff-n', orgId: 'org-a', role: 'STAFF', personId: 'p-normal' },
  managerWarning: { userId: 'u-mgr-w', orgId: 'org-a', role: 'MANAGER', personId: 'p-warning' },
  adminSuspended: { userId: 'u-admin-s', orgId: 'org-a', role: 'ADMIN', personId: 'p-suspended' },
} as const
type UserKey = keyof typeof USERS

const STATE_BY_PERSON: Record<string, string> = {
  'p-restricted': 'RESTRICTED',
  'p-suspended': 'SUSPENDED',
  'p-normal': 'NORMAL',
  'p-warning': 'WARNING',
}

const operationalState = { getStatus: jest.fn(async (personId: string) => ({ state: STATE_BY_PERSON[personId] ?? 'NORMAL', riskScore: 75 })) }
const timeline = { log: jest.fn().mockResolvedValue(undefined) }
const finance = { automateOverdueLifecycle: jest.fn().mockResolvedValue({ processed: 0 }), cancelCharge: jest.fn().mockResolvedValue({ id: 'charge-1' }) }
const assignments = {
  startAssignment: jest.fn().mockResolvedValue({ id: 'asg-1', started: true }),
  getNextItem: jest.fn().mockResolvedValue({ id: 'item-1' }),
  completeItem: jest.fn().mockResolvedValue({ id: 'asg-1' }),
}
const corrective = {
  resolve: jest.fn().mockResolvedValue({ id: 'ca-1', status: 'DONE' }),
  processReassessment: jest.fn().mockResolvedValue({ reassessed: true, resolved: true }),
  listByPerson: jest.fn().mockResolvedValue([]),
}
const domainWrites = () => [finance.automateOverdueLifecycle, finance.cancelCharge, assignments.startAssignment, assignments.completeItem, corrective.resolve, corrective.processReassessment]

describe('C8 PR3-3B-1: OperationalStateGuard decides by the declared route, not the request URL', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const post = (user: UserKey, path: string, body?: object) => {
    const req = http().post(path).set('x-test-user', user)
    return body ? req.send(body) : req
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController, AssignmentsController, CorrectiveActionsController],
      providers: [
        RolesGuard,
        OperationalStateGuard,
        { provide: OperationalStateService, useValue: operationalState },
        { provide: TimelineService, useValue: timeline },
        { provide: FinanceService, useValue: finance },
        { provide: TenantOperationsService, useValue: {} },
        { provide: CommercialPolicyService, useValue: {} },
        { provide: ManualPaymentsService, useValue: {} },
        { provide: AssignmentsService, useValue: assignments },
        { provide: CorrectiveActionsService, useValue: corrective },
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
    app.setGlobalPrefix('v1') // as in main.ts
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => jest.clearAllMocks())

  /** The guard refused: 403, the RESTRICTED/SUSPENDED block is logged once, the handler never ran. */
  async function expectBlocked(res: request.Response, state: 'RESTRICTED' | 'SUSPENDED', url: string) {
    expect([url, res.status]).toEqual([url, 403])
    expect(res.body.error).toBe(state === 'SUSPENDED' ? 'Usuário suspenso temporariamente.' : 'Ação bloqueada até regularização das pendências.')
    for (const write of domainWrites()) expect(write).not.toHaveBeenCalled()
    expect(timeline.log).toHaveBeenCalledTimes(1)
    expect(timeline.log).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', action: 'OPERATIONAL_ACCESS_BLOCKED', metadata: expect.objectContaining({ state, method: 'POST', url }) }))
  }

  // Query strings, parameter values and path segments that contain the old allowlist substrings.
  const BYPASS_ATTEMPTS: Array<[UserKey, string, object | null]> = [
    ['managerRestricted', '/v1/finance/charges/automation/overdue?x=/reassess', null],
    ['managerRestricted', '/v1/finance/charges/automation/overdue?next=/corrective-actions', null],
    ['managerRestricted', '/v1/finance/charges/automation/overdue?redirect=/v1/corrective-actions/ca-1/resolve', null],
    ['managerRestricted', '/v1/finance/charges/automation/overdue?a=%2Freassess', null],
    ['managerRestricted', '/v1/finance/charges/automation/overdue#/reassess', null],
    ['managerRestricted', '/v1/finance/charges/%2Freassess/cancel', { cancellationReason: 'motivo' }],
    ['managerRestricted', '/v1/finance/charges/corrective-actions/cancel?x=/reassess', { cancellationReason: 'motivo' }],
    ['staffRestricted', '/v1/assignments/asg-1/start?x=/reassess', null],
    ['staffRestricted', '/v1/assignments/asg-1/start?y=/corrective-actions/', null],
    ['staffRestricted', '/v1/assignments/reassess/start', null],
    ['staffRestricted', '/v1/assignments/corrective-actions/complete-item', { itemId: 'item-1' }],
    ['staffRestricted', '/v1/assignments/asg-1/complete-item?x=/reassess', { itemId: 'item-1' }],
  ]

  describe('RESTRICTED cannot bypass the guard through the URL', () => {
    it.each(BYPASS_ATTEMPTS)('%s POST %s → 403 before the handler', async (user, path, body) => {
      const res = await post(user, path, body ?? undefined)
      await expectBlocked(res, 'RESTRICTED', path.split('#')[0])
    })
  })

  describe('legitimate RESTRICTED regularization routes still work (unchanged rule)', () => {
    it('POST /v1/corrective-actions/:id/resolve', async () => {
      await post('staffRestricted', '/v1/corrective-actions/ca-1/resolve').expect(201)
      expect(corrective.resolve).toHaveBeenCalledWith('org-a', 'ca-1')
      expect(timeline.log).not.toHaveBeenCalled()
    })

    it('POST /v1/corrective-actions/person/:personId/reassess', async () => {
      await post('staffRestricted', '/v1/corrective-actions/person/p-restricted/reassess').expect(201)
      expect(corrective.processReassessment).toHaveBeenCalledWith('org-a', 'p-restricted')
    })

    it('with a query string, a parameter that looks like a path, or a trailing slash', async () => {
      await post('staffRestricted', '/v1/corrective-actions/ca-2/resolve?source=ui').expect(201)
      await post('staffRestricted', '/v1/corrective-actions/reassess/resolve').expect(201)
      await post('staffRestricted', '/v1/corrective-actions/ca-3/resolve/').expect(201)
      expect(corrective.resolve.mock.calls.map((c) => c[1])).toEqual(['ca-2', 'reassess', 'ca-3'])
    })

    it('the allowlist holds exactly the two regularization routes', () => {
      expect([...RESTRICTED_REGULARIZATION_ROUTES].sort()).toEqual(['corrective-actions/:id/resolve', 'corrective-actions/person/:personId/reassess'])
    })

    it('GET stays allowed for RESTRICTED (next-item, corrective-action list)', async () => {
      await http().get('/v1/assignments/asg-1/next-item').set('x-test-user', 'staffRestricted').expect(200)
      expect(timeline.log).not.toHaveBeenCalled()
    })
  })

  describe('SUSPENDED is still blocked everywhere', () => {
    it.each([
      ['managerSuspended', '/v1/finance/charges/automation/overdue'],
      ['managerSuspended', '/v1/finance/charges/automation/overdue?x=/reassess'],
      ['staffSuspended', '/v1/assignments/asg-1/start'],
      ['staffSuspended', '/v1/corrective-actions/ca-1/resolve'],
      ['staffSuspended', '/v1/corrective-actions/person/p-suspended/reassess'],
    ] as Array<[UserKey, string]>)('%s POST %s → 403', async (user, path) => {
      await expectBlocked(await post(user, path), 'SUSPENDED', path)
    })

    it('a SUSPENDED GET is blocked too', async () => {
      await http().get('/v1/assignments/asg-1/next-item').set('x-test-user', 'staffSuspended').expect(403)
      expect(assignments.getNextItem).not.toHaveBeenCalled()
    })
  })

  describe('ADMIN and allowed states keep their behavior', () => {
    it('ADMIN is never operationally blocked (existing bypass), state not even read', async () => {
      await post('adminSuspended', '/v1/finance/charges/automation/overdue').expect(201)
      await post('adminSuspended', '/v1/assignments/asg-1/start?x=/reassess').expect(201)
      expect(operationalState.getStatus).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
    })

    it.each(['managerNormal', 'managerWarning'] as UserKey[])('%s reaches finance writes', async (user) => {
      await post(user, '/v1/finance/charges/automation/overdue').expect(201)
      await post(user, '/v1/finance/charges/charge-1/cancel', { cancellationReason: 'motivo válido' }).expect(201)
      expect(finance.automateOverdueLifecycle).toHaveBeenCalledWith('org-a')
      expect(finance.cancelCharge).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-a', id: 'charge-1' }))
      expect(timeline.log).not.toHaveBeenCalled()
    })

    it('a NORMAL STAFF reaches assignment execution', async () => {
      await post('staffNormal', '/v1/assignments/asg-1/start').expect(201)
      await post('staffNormal', '/v1/assignments/asg-1/complete-item', { itemId: 'item-1' }).expect(201)
      expect(assignments.startAssignment).toHaveBeenCalled()
      expect(assignments.completeItem).toHaveBeenCalled()
    })

    it('RolesGuard still runs before the operational check (a STAFF on finance is 403 by role, no state read)', async () => {
      const res = await post('staffRestricted', '/v1/finance/charges/automation/overdue?x=/reassess').expect(403)
      expect(res.body.error).toBe('Sem permissão (role).')
      expect(operationalState.getStatus).not.toHaveBeenCalled()
      expect(timeline.log).not.toHaveBeenCalled()
    })
  })
})
