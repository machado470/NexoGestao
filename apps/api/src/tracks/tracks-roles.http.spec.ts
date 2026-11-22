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
import { ApiExceptionFilter } from '../common/http/api-exception.filter'
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

const FICTITIOUS_PERSON_DATA = {
  email: 'pessoa.ficticia@example.test',
  riskScore: 87,
  operationalRiskScore: 64,
  operationalState: 'RESTRICTED',
  offboardReason: 'Motivo de desligamento fictício',
  workloadNotes: 'Notas de carga fictícias',
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
    findFirst: jest.fn(async ({ where, include, select }: any) => {
      const t = findTrack(where)
      if (!t) return null
      const itemsOf = (spec: any) => {
        const own = items.filter((i) => i.trackId === t.id).map((i) => ({ ...i }))
        return spec?.orderBy?.order === 'asc' ? own.sort((x, y) => x.order - y.order) : own
      }
      // Assigned people carry fictitious personal data: a route that loads them would expose it.
      const assignmentsOf = () =>
        assignments.filter((a) => a.trackId === t.id).map((a) => ({ ...a, person: { id: a.personId, name: `Pessoa ${a.personId}`, orgId: PERSON_ORG[a.personId], ...FICTITIOUS_PERSON_DATA } }))
      // Prisma semantics: `select` returns only the selected fields; `include` adds relations.
      if (select) {
        const picked: any = {}
        for (const key of Object.keys(select)) {
          if (key === 'items') picked.items = itemsOf(select.items)
          else if (key === 'assignments') picked.assignments = assignmentsOf()
          else picked[key] = (t as any)[key]
        }
        return picked
      }
      return { ...t, ...(include?.items ? { items: itemsOf(include.items) } : {}), ...(include?.assignments ? { assignments: assignmentsOf() } : {}) }
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

/** `crossOrgPath`: the same request by an ADMIN of org-b must answer 404 (C8 PR3-2B: no route is exempt). */
type Route = { name: string; method: 'get' | 'post' | 'patch' | 'delete'; path: string; body?: object; adminStatus: number; crossOrgPath?: string }

/** The 14 track and item routes, each with a valid request and its expected result for an ADMIN of org-a. */
const ADMIN_ROUTES: Route[] = [
  { name: 'GET /tracks', method: 'get', path: '/tracks', adminStatus: 200 },
  { name: 'GET /tracks/:id', method: 'get', path: '/tracks/track-a', adminStatus: 200, crossOrgPath: '/tracks/track-a' },
  { name: 'GET /tracks/:id/items', method: 'get', path: '/tracks/track-a/items', adminStatus: 200, crossOrgPath: '/tracks/track-a/items' },
  { name: 'POST /tracks', method: 'post', path: '/tracks', body: { title: 'Nova trilha' }, adminStatus: 201 },
  { name: 'PATCH /tracks/:id', method: 'patch', path: '/tracks/track-a', body: { title: 'Renomeada' }, adminStatus: 200, crossOrgPath: '/tracks/track-a' },
  { name: 'POST /tracks/:id/items', method: 'post', path: '/tracks/track-a/items', body: { type: 'READING', title: 'Novo' }, adminStatus: 201, crossOrgPath: '/tracks/track-a/items' },
  { name: 'POST /tracks/:id/publish', method: 'post', path: '/tracks/track-a/publish', adminStatus: 201, crossOrgPath: '/tracks/track-a/publish' },
  { name: 'POST /tracks/:id/archive', method: 'post', path: '/tracks/track-a/archive', adminStatus: 201, crossOrgPath: '/tracks/track-a/archive' },
  { name: 'POST /tracks/:id/assign', method: 'post', path: '/tracks/track-a/assign', body: { personIds: ['person-staff-a'] }, adminStatus: 201 },
  { name: 'POST /tracks/:id/unassign', method: 'post', path: '/tracks/track-a/unassign', body: { personIds: ['person-staff-a'] }, adminStatus: 201, crossOrgPath: '/tracks/track-a/unassign' },
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
    app.useGlobalFilters(new ApiExceptionFilter()) // the production filter: unmapped errors become 500
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

  it('an ADMIN of another organization gets 404 on every id-scoped route and writes nothing', async () => {
    for (const route of ADMIN_ROUTES.filter((r) => r.crossOrgPath)) {
      const res = await call(route, 'adminB', route.crossOrgPath)
      expect([route.name, res.status]).toEqual([route.name, 404])
      expect(JSON.stringify(res.body)).not.toContain('Trilha A')
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

  // C8 PR3-2B: these three routes answered 500 (Prisma P2025 from findFirstOrThrow) instead of 404.
  describe('missing or other-organization track on GET /tracks/:id, GET /tracks/:id/items, POST /tracks/:id/unassign', () => {
    const NOT_FOUND_ROUTES = [
      { name: 'GET /tracks/:id', send: (id: string) => http().get(`/tracks/${id}`) },
      { name: 'GET /tracks/:id/items', send: (id: string) => http().get(`/tracks/${id}/items`) },
      { name: 'POST /tracks/:id/unassign', send: (id: string) => http().post(`/tracks/${id}/unassign`).send({ personIds: ['person-staff-a', 'person-admin-b'] }) },
    ]
    /** The body without the echoed request path, which naturally differs between the two ids. */
    const comparable = ({ path: _path, ...rest }: any) => rest
    const FOREIGN_DATA = ['Trilha B', 'trilha-b', 'Item B1', 'org-b', 'person-admin-b', 'Pessoa']

    beforeEach(() => {
      // org-b has a real assignment on its track: it must be neither leaked nor deleted.
      assignments.push({ id: 'asg-b', personId: 'person-admin-b', trackId: 'track-b', progress: 30 })
      PERSON_ORG['person-admin-b'] = 'org-b'
    })
    afterEach(() => delete PERSON_ORG['person-admin-b'])

    it.each(NOT_FOUND_ROUTES.map((r) => [r.name, r] as const))('%s: missing id and other-organization id are the same 404, with no data', async (_name, route) => {
      const missing = await route.send('track-does-not-exist').set('x-test-user', 'adminA')
      const foreign = await route.send('track-b').set('x-test-user', 'adminA')
      for (const res of [missing, foreign]) {
        expect(res.status).toBe(404)
        expect(res.body).toMatchObject({ success: false, error: 'Trilha não encontrada', data: null })
        expect(res.body.code).not.toBe('INTERNAL_ERROR')
        for (const fragment of FOREIGN_DATA) expect(JSON.stringify(res.body)).not.toContain(fragment)
      }
      expect(comparable(foreign.body)).toEqual(comparable(missing.body))
      // Rejected attempts write nothing and audit nothing.
      expect(prisma.assignment.deleteMany).not.toHaveBeenCalled()
      expect(prisma.auditEvent.create).not.toHaveBeenCalled()
      expect(assignments.find((a) => a.id === 'asg-b')).toEqual({ id: 'asg-b', personId: 'person-admin-b', trackId: 'track-b', progress: 30 })
    })

    it('the lookup stays scoped to the session organization before any deletion', async () => {
      await http().post('/tracks/track-b/unassign').set('x-test-user', 'adminA').send({ personIds: ['person-admin-b'] }).expect(404)
      expect(prisma.track.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'track-b', orgId: 'org-a' } }))
      expect(prisma.assignment.deleteMany).not.toHaveBeenCalled()
    })

    it('the ADMIN of the owning organization still reads and unassigns', async () => {
      const own = await http().get('/tracks/track-b').set('x-test-user', 'adminB').expect(200)
      expect(own.body).toMatchObject({ id: 'track-b', title: 'Trilha B', assignments: [expect.objectContaining({ id: 'asg-b' })] })
      await http().get('/tracks/track-b/items').set('x-test-user', 'adminB').expect(200, [{ id: 'item-b1', trackId: 'track-b', title: 'Item B1', content: '', type: 'READING', order: 1 }])
      await http().post('/tracks/track-b/unassign').set('x-test-user', 'adminB').send({ personIds: ['person-admin-b'] }).expect(201)
      expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { trackId: 'track-b', personId: { in: ['person-admin-b'] } } })
    })
  })

  // C8 PR3-2C: GET /tracks/:id/items returns only the track's items, never assignments or people.
  describe('GET /tracks/:id/items contract', () => {
    const SENSITIVE = ['assignments', 'person', FICTITIOUS_PERSON_DATA.email, 'riskScore', 'operationalRiskScore', FICTITIOUS_PERSON_DATA.offboardReason, 'offboardReason', 'workloadNotes', 'orgId', 'org-a', 'org-b']

    beforeEach(() => {
      // Stored out of order; the track also has an assigned person with personal data.
      items.push(
        { id: 'item-a3', trackId: 'track-a', title: 'Item A3', content: 'c3', type: 'CHECKPOINT', order: 3 },
        { id: 'item-a2', trackId: 'track-a', title: 'Item A2', content: 'c2', type: 'ACTION', order: 2 },
      )
      assignments.push({ id: 'asg-a', personId: 'person-staff-a', trackId: 'track-a', progress: 40 })
      tracks.push({ id: 'track-empty', orgId: 'org-a', status: 'DRAFT', title: 'Trilha vazia', slug: 'trilha-vazia', version: 1, description: null, createdAt: new Date('2026-11-01T00:00:00.000Z') })
    })

    it('an ADMIN gets 200 with only the items, ordered, equal to GET /track-items/track/:trackId', async () => {
      const res = await http().get('/tracks/track-a/items').set('x-test-user', 'adminA').expect(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.map((i: any) => [i.id, i.order])).toEqual([['item-a1', 1], ['item-a2', 2], ['item-a3', 3]])
      for (const item of res.body) expect(Object.keys(item).sort()).toEqual(['content', 'id', 'order', 'title', 'trackId', 'type'])
      const sibling = await http().get('/track-items/track/track-a').set('x-test-user', 'adminA').expect(200)
      expect(res.body).toEqual(sibling.body)
    })

    it('the response carries no assignment, person, personal data, risk score, offboarding reason or orgId', async () => {
      const res = await http().get('/tracks/track-a/items').set('x-test-user', 'adminA').expect(200)
      const text = JSON.stringify(res.body)
      for (const fragment of SENSITIVE) expect([fragment, text.includes(fragment)]).toEqual([fragment, false])
      // The query itself never loads assignments or people and stays scoped to the session org.
      expect(prisma.track.findFirst).toHaveBeenCalledWith({ where: { id: 'track-a', orgId: 'org-a' }, select: { items: { orderBy: { order: 'asc' } } } })
    })

    it('a track without items returns []', async () => {
      await http().get('/tracks/track-empty/items').set('x-test-user', 'adminA').expect(200, [])
    })

    it('a missing or other-organization track is the same 404, without the foreign items', async () => {
      const missing = await http().get('/tracks/track-missing/items').set('x-test-user', 'adminA').expect(404)
      const foreign = await http().get('/tracks/track-a/items').set('x-test-user', 'adminB').expect(404)
      const { path: _m, ...missingBody } = missing.body
      const { path: _f, ...foreignBody } = foreign.body
      expect(foreignBody).toEqual(missingBody)
      expect(JSON.stringify(foreign.body)).not.toMatch(/Item A|Trilha A/)
    })

    it.each(NON_ADMIN_ROLES)('%s gets 403 before any database access', async (user) => {
      await http().get('/tracks/track-a/items').set('x-test-user', user).expect(403)
      for (const mock of allPrismaMocks()) expect(mock).not.toHaveBeenCalled()
    })

    it('reads write nothing and audit nothing', async () => {
      await http().get('/tracks/track-a/items').set('x-test-user', 'adminA').expect(200)
      await http().get('/tracks/track-a/items').expect(401)
      const writes = [prisma.track.create, prisma.track.update, prisma.trackItem.create, prisma.trackItem.update, prisma.trackItem.delete, prisma.assignment.update, prisma.assignment.updateMany, prisma.assignment.deleteMany, prisma.auditEvent.create]
      for (const write of writes) expect(write).not.toHaveBeenCalled()
    })
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
