import { INestApplication, RequestMethod, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { AssignmentFactoryService } from '../assignments/assignment-factory.service'
import { AssignmentsController } from '../assignments/assignments.controller'
import { AssignmentsService } from '../assignments/assignments.service'
import { AuditService } from '../audit/audit.service'
import { ROLES_KEY } from '../auth/decorators/roles.decorator'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { PrismaService } from '../prisma/prisma.service'
import { RiskService } from '../risk/risk.service'
import { TimelineService } from '../timeline/timeline.service'
import { TrackItemsController } from '../track-items/track-items.controller'
import { TrackItemsService } from '../track-items/track-items.service'
import { TracksController } from './tracks.controller'
import { TracksService } from './tracks.service'

/**
 * C8 PR3-2 — role-based access to tracks, track items and assignment maintenance.
 *
 * Decisions: only organization ADMINs administer and read tracks and items (D1/D2) and run
 * rebuild-progress (D3). Executing one's own assignment stays open to its owner, whatever the role.
 * Authorization is asserted separately from functional success: an authorized request may still be
 * refused by validation or business rules, but never with 401/403.
 */

const USERS = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-a' },
  managerA: { userId: 'u-manager-a', orgId: 'org-a', role: 'MANAGER', personId: 'person-manager-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'person-staff-a' },
  staffOtherA: { userId: 'u-staff-other-a', orgId: 'org-a', role: 'STAFF', personId: 'person-other-a' },
  viewerA: { userId: 'u-viewer-a', orgId: 'org-a', role: 'VIEWER', personId: 'person-viewer-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'person-admin-b' },
} as const
type UserKey = keyof typeof USERS
const NON_ADMIN_ROLES: UserKey[] = ['managerA', 'staffA', 'viewerA']

type Track = { id: string; orgId: string; status: string; title: string; slug: string; version: number; description: string | null; createdAt: Date }
type Item = { id: string; trackId: string; title: string; content: string; type: string; order: number }
type Assignment = { id: string; personId: string; trackId: string; progress: number }
let tracks: Track[]
let items: Item[]
let assignments: Assignment[]
let completions: Array<{ itemId: string; personId: string; assignmentId: string }>

const PERSON_ORG: Record<string, string> = {
  'person-staff-a': 'org-a',
  'person-other-a': 'org-a',
  'person-viewer-a': 'org-a',
}

function reset() {
  const at = new Date('2026-11-01T00:00:00.000Z')
  tracks = [
    { id: 'track-a', orgId: 'org-a', status: 'DRAFT', title: 'Trilha A', slug: 'trilha-a', version: 1, description: null, createdAt: at },
    { id: 'track-active', orgId: 'org-a', status: 'ACTIVE', title: 'Trilha ativa', slug: 'trilha-ativa', version: 1, description: null, createdAt: at },
    { id: 'track-b', orgId: 'org-b', status: 'DRAFT', title: 'Trilha B', slug: 'trilha-b', version: 1, description: null, createdAt: at },
  ]
  items = [
    { id: 'item-a1', trackId: 'track-a', title: 'Item A1', content: '', type: 'READING', order: 1 },
    { id: 'ti-1', trackId: 'track-active', title: 'Passo 1', content: '', type: 'READING', order: 1 },
    { id: 'ti-2', trackId: 'track-active', title: 'Passo 2', content: '', type: 'ACTION', order: 2 },
    { id: 'item-b1', trackId: 'track-b', title: 'Item B1', content: '', type: 'READING', order: 1 },
  ]
  assignments = [
    { id: 'asg-staff', personId: 'person-staff-a', trackId: 'track-active', progress: 0 },
    { id: 'asg-viewer', personId: 'person-viewer-a', trackId: 'track-active', progress: 0 },
  ]
  completions = []
}

const findTrack = (where: any) =>
  tracks.find((t) => (where.id === undefined || t.id === where.id) && (where.orgId === undefined || t.orgId === where.orgId) && (where.slug === undefined || t.slug === where.slug))
const withAssignmentRelations = (a: Assignment) => ({
  ...a,
  person: { orgId: PERSON_ORG[a.personId] },
  track: { ...tracks.find((t) => t.id === a.trackId)!, items: items.filter((i) => i.trackId === a.trackId).sort((x, y) => x.order - y.order) },
  completions: completions.filter((c) => c.assignmentId === a.id),
})

const prisma: any = {
  track: {
    findMany: jest.fn(async ({ where }: any) => tracks.filter((t) => t.orgId === where.orgId).map((t) => ({ ...t, assignments: [] }))),
    findFirst: jest.fn(async ({ where, include }: any) => {
      const t = findTrack(where)
      if (!t) return null
      return { ...t, ...(include?.items ? { items: items.filter((i) => i.trackId === t.id) } : {}), ...(include?.assignments ? { assignments: [] } : {}) }
    }),
    findFirstOrThrow: jest.fn(async ({ where }: any) => {
      const t = findTrack(where)
      if (!t) throw Object.assign(new Error('No Track found'), { code: 'P2025' })
      return { ...t }
    }),
    create: jest.fn(async ({ data }: any) => ({ id: 'track-new', createdAt: new Date(), ...data })),
    update: jest.fn(async ({ where, data }: any) => {
      const t = findTrack(where)
      if (!t) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
      Object.assign(t, data)
      return { ...t }
    }),
  },
  trackItem: {
    findFirst: jest.fn(async ({ where }: any) => {
      const item = items.find((i) => i.id === where.id)
      if (!item) return null
      const track = tracks.find((t) => t.id === item.trackId)!
      if (where.track?.orgId && track.orgId !== where.track.orgId) return null
      return { ...item, track: { ...track } }
    }),
    findMany: jest.fn(async ({ where }: any) => items.filter((i) => i.trackId === where.trackId)),
    aggregate: jest.fn(async ({ where }: any) => ({ _max: { order: Math.max(0, ...items.filter((i) => i.trackId === where.trackId).map((i) => i.order)) } })),
    count: jest.fn(async ({ where }: any) => items.filter((i) => i.trackId === where.trackId).length),
    create: jest.fn(async ({ data }: any) => ({ id: 'item-new', ...data })),
    update: jest.fn(async ({ where, data }: any) => ({ ...items.find((i) => i.id === where.id), ...data })),
    delete: jest.fn(async ({ where }: any) => {
      items = items.filter((i) => i.id !== where.id)
      return { id: where.id }
    }),
  },
  assignment: {
    findUnique: jest.fn(async ({ where }: any) => {
      const a = assignments.find((x) => x.id === where.id)
      return a ? withAssignmentRelations(a) : null
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const a = assignments.find((x) => x.id === where.id)!
      Object.assign(a, data)
      return { ...a }
    }),
    updateMany: jest.fn(async () => ({ count: 0 })),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  },
  trackItemCompletion: {
    create: jest.fn(async ({ data }: any) => {
      completions.push(data)
      return data
    }),
  },
  auditEvent: { create: jest.fn(async ({ data }: any) => ({ id: 'audit', ...data })) },
  person: { findUnique: jest.fn(async () => null) },
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
}

/** Every Prisma call: a denied request must not reach the database at all. */
const allPrismaMocks = () =>
  Object.values(prisma).flatMap((delegate: any) => (typeof delegate === 'function' ? [delegate] : Object.values(delegate))) as jest.Mock[]

const assignmentFactory = { assignPeopleToTrack: jest.fn(async ({ personIds }: any) => ({ assigned: personIds.length })) }
const timeline = { log: jest.fn().mockResolvedValue(undefined) }
const risk = { recalculatePersonRisk: jest.fn().mockResolvedValue(undefined) }

/**
 * `crossOrg`: 404 where the service throws NotFoundException. `blocked` where it uses
 * findFirstOrThrow: the API's ApiExceptionFilter does not map Prisma P2025, so these answer 500
 * (pre-existing, out of scope here); the request is still refused with no data and no write.
 */
type Route = { name: string; method: 'get' | 'post' | 'patch' | 'delete'; path: string; body?: object; adminStatus: number; crossOrgPath?: string; crossOrg?: 404 | 'blocked' }

/** The 14 track and item routes, each with a valid request and its expected result for an ADMIN of org-a. */
const ADMIN_ROUTES: Route[] = [
  { name: 'GET /tracks', method: 'get', path: '/tracks', adminStatus: 200 },
  { name: 'GET /tracks/:id', method: 'get', path: '/tracks/track-a', adminStatus: 200, crossOrgPath: '/tracks/track-a', crossOrg: 'blocked' },
  { name: 'GET /tracks/:id/items', method: 'get', path: '/tracks/track-a/items', adminStatus: 200, crossOrgPath: '/tracks/track-a/items', crossOrg: 'blocked' },
  { name: 'POST /tracks', method: 'post', path: '/tracks', body: { title: 'Nova trilha' }, adminStatus: 201 },
  { name: 'PATCH /tracks/:id', method: 'patch', path: '/tracks/track-a', body: { title: 'Renomeada' }, adminStatus: 200, crossOrgPath: '/tracks/track-a' },
  { name: 'POST /tracks/:id/items', method: 'post', path: '/tracks/track-a/items', body: { type: 'READING', title: 'Novo' }, adminStatus: 201, crossOrgPath: '/tracks/track-a/items' },
  { name: 'POST /tracks/:id/publish', method: 'post', path: '/tracks/track-a/publish', adminStatus: 201, crossOrgPath: '/tracks/track-a/publish' },
  { name: 'POST /tracks/:id/archive', method: 'post', path: '/tracks/track-a/archive', adminStatus: 201, crossOrgPath: '/tracks/track-a/archive' },
  { name: 'POST /tracks/:id/assign', method: 'post', path: '/tracks/track-a/assign', body: { personIds: ['person-staff-a'] }, adminStatus: 201 },
  { name: 'POST /tracks/:id/unassign', method: 'post', path: '/tracks/track-a/unassign', body: { personIds: ['person-staff-a'] }, adminStatus: 201, crossOrgPath: '/tracks/track-a/unassign', crossOrg: 'blocked' },
  { name: 'GET /track-items/track/:trackId', method: 'get', path: '/track-items/track/track-a', adminStatus: 200, crossOrgPath: '/track-items/track/track-a' },
  { name: 'POST /track-items/track/:trackId', method: 'post', path: '/track-items/track/track-a', body: { type: 'ACTION', title: 'Novo' }, adminStatus: 201, crossOrgPath: '/track-items/track/track-a' },
  { name: 'PATCH /track-items/:itemId', method: 'patch', path: '/track-items/item-a1', body: { title: 'Novo' }, adminStatus: 200, crossOrgPath: '/track-items/item-a1' },
  { name: 'DELETE /track-items/:itemId', method: 'delete', path: '/track-items/item-a1', adminStatus: 200, crossOrgPath: '/track-items/item-a1' },
]

describe('C8 PR3-2: only organization ADMINs reach track and item routes', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const call = (route: Route, user?: UserKey, path = route.path) => {
    const req = http()[route.method](path)
    if (user) req.set('x-test-user', user)
    return route.body ? req.send(route.body) : req
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TracksController, TrackItemsController, AssignmentsController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        TracksService,
        TrackItemsService,
        AssignmentsService,
        AuditService,
        { provide: PrismaService, useValue: prisma },
        { provide: AssignmentFactoryService, useValue: assignmentFactory },
        { provide: TimelineService, useValue: timeline },
        { provide: RiskService, useValue: risk },
      ],
    })
      // Session validation (incl. inactive users) is exercised for real in the PostgreSQL spec.
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
      // Operational state (SUSPENDED/RESTRICTED) has its own coverage; neutral here.
      .overrideGuard(OperationalStateGuard)
      .useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    )
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => {
    reset()
    jest.clearAllMocks()
  })

  describe.each(NON_ADMIN_ROLES)('%s', (user) => {
    it.each(ADMIN_ROUTES.map((r) => [r.name, r] as const))('%s → 403 before any database access or audit', async (_name, route) => {
      await call(route, user).expect(403)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
      expect(assignmentFactory.assignPeopleToTrack).not.toHaveBeenCalled()
    })
  })

  describe('adminA (authorized)', () => {
    it.each(ADMIN_ROUTES.map((r) => [r.name, r] as const))('%s is authorized and succeeds on valid input', async (_name, route) => {
      const res = await call(route, 'adminA')
      expect([401, 403]).not.toContain(res.status) // authorization
      expect(res.status).toBe(route.adminStatus) // functional result with valid input
    })

    it('authorized but invalid or forbidden by business rules is a 400/404, not a 403', async () => {
      await http().post('/tracks').set('x-test-user', 'adminA').send({}).expect(400)
      await http().patch('/tracks/track-active').set('x-test-user', 'adminA').send({ title: 'x' }).expect(400) // only DRAFT
      await http().post('/tracks/track-active/publish').set('x-test-user', 'adminA').expect(400) // already ACTIVE
      await http().post('/tracks/missing/publish').set('x-test-user', 'adminA').expect(404)
    })
  })

  it('an ADMIN of another organization is refused (404, or blocked where pre-existing) and writes nothing', async () => {
    for (const route of ADMIN_ROUTES.filter((r) => r.crossOrgPath)) {
      const res = await call(route, 'adminB', route.crossOrgPath)
      if (route.crossOrg === 'blocked') {
        expect([route.name, res.status >= 400]).toEqual([route.name, true])
        expect(JSON.stringify(res.body)).not.toContain('Trilha A')
      } else {
        expect([route.name, res.status]).toEqual([route.name, 404])
      }
    }
    expect(prisma.track.create).not.toHaveBeenCalled()
    expect(prisma.track.update).not.toHaveBeenCalled()
    expect(prisma.trackItem.create).not.toHaveBeenCalled()
    expect(prisma.trackItem.update).not.toHaveBeenCalled()
    expect(prisma.trackItem.delete).not.toHaveBeenCalled()
    expect(prisma.assignment.updateMany).not.toHaveBeenCalled()
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled()
    expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    expect(tracks.find((t) => t.id === 'track-a')).toMatchObject({ status: 'DRAFT', title: 'Trilha A' })
  })

  it('unauthenticated requests are 401 on every route', async () => {
    for (const route of ADMIN_ROUTES) await call(route).expect(401)
    await http().post('/assignments/asg-staff/rebuild-progress').expect(401)
    await http().post('/assignments/asg-staff/start').expect(401)
    for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
  })

  describe('assignments', () => {
    it('the owner, whatever the role, still starts and completes their own assignment', async () => {
      await http().post('/assignments/asg-staff/start').set('x-test-user', 'staffA').expect(201)
      await http().post('/assignments/asg-staff/complete-item').set('x-test-user', 'staffA').send({ itemId: 'ti-1' }).expect(201)
      expect(assignments.find((a) => a.id === 'asg-staff')!.progress).toBe(50)
      await http().post('/assignments/asg-viewer/start').set('x-test-user', 'viewerA').expect(201)
      await http().post('/assignments/asg-viewer/complete-item').set('x-test-user', 'viewerA').send({ itemId: 'ti-1' }).expect(201)
    })

    it('another collaborator cannot execute someone else’s assignment', async () => {
      await http().post('/assignments/asg-staff/start').set('x-test-user', 'staffOtherA').expect(403)
      await http().post('/assignments/asg-staff/complete-item').set('x-test-user', 'staffOtherA').send({ itemId: 'ti-1' }).expect(403)
      expect(prisma.trackItemCompletion.create).not.toHaveBeenCalled()
      expect(assignments.find((a) => a.id === 'asg-staff')!.progress).toBe(0)
    })

    it.each(['managerA', 'staffA', 'staffOtherA', 'viewerA'] as UserKey[])('rebuild-progress by %s → 403 before any database access (the owner included)', async (user) => {
      await http().post('/assignments/asg-staff/rebuild-progress').set('x-test-user', user).expect(403)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
    })

    it('rebuild-progress by ADMIN is authorized and recalculates progress', async () => {
      completions.push({ itemId: 'ti-1', personId: 'person-staff-a', assignmentId: 'asg-staff' })
      await http().post('/assignments/asg-staff/rebuild-progress').set('x-test-user', 'adminA').expect(201)
      expect(assignments.find((a) => a.id === 'asg-staff')!.progress).toBe(50)
    })

    it('rebuild-progress by an ADMIN of another organization is 404', async () => {
      await http().post('/assignments/asg-staff/rebuild-progress').set('x-test-user', 'adminB').expect(404)
      expect(prisma.assignment.update).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------------------------
// Structural guard: a new route cannot be added to these controllers without explicit roles.

const HTTP_METHODS = new Set([RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.ALL])

/** Routes of a controller and the roles each one declares (handler first, then class). */
function routesOf(controller: any) {
  const proto = controller.prototype
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .filter((name) => Reflect.hasMetadata(PATH_METADATA, proto[name]) && HTTP_METHODS.has(Reflect.getMetadata(METHOD_METADATA, proto[name])))
    .map((name) => ({ name, roles: Reflect.getMetadata(ROLES_KEY, proto[name]) ?? Reflect.getMetadata(ROLES_KEY, controller) }))
}

function adminOnlyViolations(controller: any, ownerRoutes: string[] = []) {
  const violations: string[] = []
  const guards: any[] = Reflect.getMetadata(GUARDS_METADATA, controller) ?? []
  if (guards.indexOf(JwtAuthGuard) !== 0 || guards.indexOf(RolesGuard) !== 1) violations.push(`${controller.name}: guards must be [JwtAuthGuard, RolesGuard, …]`)
  for (const route of routesOf(controller)) {
    if (ownerRoutes.includes(route.name)) continue
    if (!Array.isArray(route.roles) || route.roles.length !== 1 || route.roles[0] !== 'ADMIN') {
      violations.push(`${controller.name}.${route.name}: expected @Roles('ADMIN'), got ${JSON.stringify(route.roles ?? null)}`)
    }
  }
  return violations
}

describe('C8 PR3-2: structural role declarations', () => {
  it('every track and item route declares @Roles(\'ADMIN\') behind JwtAuthGuard → RolesGuard', () => {
    expect(routesOf(TracksController)).toHaveLength(10)
    expect(routesOf(TrackItemsController)).toHaveLength(4)
    expect(adminOnlyViolations(TracksController)).toEqual([])
    expect(adminOnlyViolations(TrackItemsController)).toEqual([])
  })

  it('assignment routes are ADMIN-only except the explicit owner-execution routes', () => {
    // Owner-scoped execution: access is decided per assignment in AssignmentsService.
    const ownerRoutes = ['start', 'nextItem', 'completeItem']
    expect(routesOf(AssignmentsController).map((r) => r.name).sort()).toEqual(['completeItem', 'listByPerson', 'nextItem', 'rebuildProgress', 'start'])
    expect(adminOnlyViolations(AssignmentsController, ownerRoutes)).toEqual([])
  })

  it('the structural check detects a route without roles (self-test)', () => {
    const { Controller, Get, UseGuards } = jest.requireActual('@nestjs/common')
    @Controller('probe')
    @UseGuards(JwtAuthGuard, RolesGuard)
    class ProbeController {
      @Get('open') open() {}
    }
    expect(adminOnlyViolations(ProbeController)).toEqual([`ProbeController.open: expected @Roles('ADMIN'), got null`])
  })
})
