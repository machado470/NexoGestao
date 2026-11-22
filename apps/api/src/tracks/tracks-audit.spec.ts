import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuditService } from '../audit/audit.service'
import { AssignmentFactoryService } from '../assignments/assignment-factory.service'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { PrismaService } from '../prisma/prisma.service'
import { TracksController } from './tracks.controller'
import { TracksService } from './tracks.service'

/**
 * C8 PR3-4 — track audit events.
 *
 * The four track audit calls passed only `{ action, context }`. AuditService.log resolves the
 * organization first and throws 400 "orgId é obrigatório" without orgId/personId, after the domain
 * write: the operation was persisted and the client got a 400 (retries duplicated tracks/items) and
 * no track audit event was ever written. The real AuditService is used here (not a mock).
 */

const USERS: Record<string, { userId: string; orgId: string; role: string; personId: string }> = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'person-staff-a' },
  adminB: { userId: 'u-admin-b', orgId: 'org-b', role: 'ADMIN', personId: 'person-admin-b' },
}

type State = {
  tracks: Array<{ id: string; orgId: string; status: string; title: string; slug: string; version: number; description: string | null }>
  items: Array<{ id: string; trackId: string; title: string; content: string; type: string; order: number }>
  assignments: Array<{ id: string; trackId: string; personId: string; progress: number }>
  auditEvents: Array<Record<string, any>>
}

let state: State
const failures = { trackUpdateInTransaction: false, auditCreate: false }

function reset() {
  state = {
    tracks: [
      { id: 'track-a', orgId: 'org-a', status: 'DRAFT', title: 'Trilha A', slug: 'trilha-a', version: 1, description: null },
      { id: 'track-a-empty', orgId: 'org-a', status: 'DRAFT', title: 'Sem itens', slug: 'sem-itens', version: 1, description: null },
      { id: 'track-b', orgId: 'org-b', status: 'DRAFT', title: 'Trilha B', slug: 'trilha-b', version: 1, description: null },
    ],
    items: [
      { id: 'item-a1', trackId: 'track-a', title: 'Item A1', content: '', type: 'READING', order: 1 },
      { id: 'item-b1', trackId: 'track-b', title: 'Item B1', content: '', type: 'READING', order: 1 },
    ],
    assignments: [
      { id: 'asg-1', trackId: 'track-a', personId: 'person-1', progress: 40 },
      { id: 'asg-2', trackId: 'track-a', personId: 'person-2', progress: 100 },
      { id: 'asg-b', trackId: 'track-b', personId: 'person-b', progress: 10 },
    ],
    auditEvents: [],
  }
  failures.trackUpdateInTransaction = false
  failures.auditCreate = false
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
let inTransaction = false

const prisma: any = {
  track: {
    findFirst: jest.fn(async ({ where }: any) => {
      const row = state.tracks.find((t) => (where.id === undefined || t.id === where.id) && (where.orgId === undefined || t.orgId === where.orgId) && (where.slug === undefined || t.slug === where.slug))
      return row ? { ...row } : null
    }),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `track-new-${state.tracks.length}`, description: null, ...data }
      state.tracks.push(row)
      return { ...row }
    }),
    update: jest.fn(async ({ where, data }: any) => {
      if (inTransaction && failures.trackUpdateInTransaction) throw new Error('simulated track update failure')
      // Same semantics as Prisma: a non-matching where (id + orgId) is "Record to update not found".
      const row = state.tracks.find((t) => t.id === where.id && (where.orgId === undefined || t.orgId === where.orgId))
      if (!row) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
      Object.assign(row, data)
      return { ...row }
    }),
  },
  trackItem: {
    aggregate: jest.fn(async ({ where }: any) => ({ _max: { order: Math.max(0, ...state.items.filter((i) => i.trackId === where.trackId).map((i) => i.order)) } })),
    create: jest.fn(async ({ data }: any) => {
      const row = { id: `item-new-${state.items.length}`, ...data }
      state.items.push(row)
      return { ...row }
    }),
    count: jest.fn(async ({ where }: any) => state.items.filter((i) => i.trackId === where.trackId).length),
  },
  assignment: {
    updateMany: jest.fn(async ({ where, data }: any) => {
      const orgOfTrack = (trackId: string) => state.tracks.find((t) => t.id === trackId)?.orgId
      const rows = state.assignments.filter(
        (a) => a.trackId === where.trackId && a.progress < where.progress.lt && (where.track?.orgId === undefined || orgOfTrack(a.trackId) === where.track.orgId),
      )
      rows.forEach((a) => Object.assign(a, data))
      return { count: rows.length }
    }),
  },
  auditEvent: {
    create: jest.fn(async ({ data }: any) => {
      if (failures.auditCreate) throw new Error('simulated audit storage failure')
      state.auditEvents.push(data)
      return { id: `audit-${state.auditEvents.length}`, ...data }
    }),
  },
  person: { findUnique: jest.fn(async () => null) },
  // Interactive transaction with rollback: any error restores the state and is rethrown.
  $transaction: jest.fn(async (fn: any) => {
    const snapshot = clone(state)
    inTransaction = true
    try {
      return await fn(prisma)
    } catch (error) {
      state = snapshot
      throw error
    } finally {
      inTransaction = false
    }
  }),
}

const assignmentFactory = { assignPeopleToTrack: jest.fn() }

describe('C8 PR3-4: track operations write one complete audit event', () => {
  let app: INestApplication
  const as = (key: keyof typeof USERS) => ({ 'x-test-user': key })
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TracksController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        TracksService,
        AuditService, // real service: organization resolution and error propagation unchanged
        { provide: PrismaService, useValue: prisma },
        { provide: AssignmentFactoryService, useValue: assignmentFactory },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest()
          const user = USERS[req.headers['x-test-user']]
          if (!user) throw new UnauthorizedException()
          req.user = { sub: user.userId, ...user }
          return true
        },
      })
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

  const adminActor = { orgId: 'org-a', actorUserId: 'u-admin-a', actorPersonId: 'person-admin-a' }

  it('create track: 201 and one TRACK_CREATED event with organization, actor and entity', async () => {
    const res = await http().post('/tracks').set(as('adminA')).send({ title: 'Nova trilha' }).expect(201)
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        ...adminActor,
        action: 'TRACK_CREATED',
        entityType: 'TRACK',
        entityId: res.body.id,
        metadata: { trackId: res.body.id, slug: 'nova-trilha', version: 1 },
      }),
    ])
  })

  it('add item: 201 and one TRACK_ITEM_CREATED event', async () => {
    const res = await http().post('/tracks/track-a/items').set(as('adminA')).send({ type: 'ACTION', title: 'Executar' }).expect(201)
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        ...adminActor,
        action: 'TRACK_ITEM_CREATED',
        entityType: 'TRACK_ITEM',
        entityId: res.body.id,
        metadata: { trackId: 'track-a', itemId: res.body.id, order: 2, type: 'ACTION', trackVersion: 1 },
      }),
    ])
  })

  it('publish: 201 and one TRACK_PUBLISHED event', async () => {
    await http().post('/tracks/track-a/publish').set(as('adminA')).expect(201)
    expect(state.tracks.find((t) => t.id === 'track-a')!.status).toBe('ACTIVE')
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        ...adminActor,
        action: 'TRACK_PUBLISHED',
        entityType: 'TRACK',
        entityId: 'track-a',
        metadata: { trackId: 'track-a', version: 1, previousStatus: 'DRAFT', status: 'ACTIVE', itemsCount: 1 },
      }),
    ])
  })

  it('archive: 201, both writes applied in one transaction, and one TRACK_ARCHIVED event', async () => {
    await http().post('/tracks/track-a/archive').set(as('adminA')).expect(201)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(state.tracks.find((t) => t.id === 'track-a')!.status).toBe('ARCHIVED')
    // Semantics unchanged: open assignments of the track go to 100; other tracks untouched.
    expect(state.assignments).toEqual([
      { id: 'asg-1', trackId: 'track-a', personId: 'person-1', progress: 100 },
      { id: 'asg-2', trackId: 'track-a', personId: 'person-2', progress: 100 },
      { id: 'asg-b', trackId: 'track-b', personId: 'person-b', progress: 10 },
    ])
    expect(state.auditEvents).toEqual([
      expect.objectContaining({
        ...adminActor,
        action: 'TRACK_ARCHIVED',
        entityType: 'TRACK',
        entityId: 'track-a',
        metadata: { trackId: 'track-a', version: 1, previousStatus: 'DRAFT', status: 'ARCHIVED', closedAssignments: 1 },
      }),
    ])
  })

  it('both archive writes carry explicit organization filters', async () => {
    await http().post('/tracks/track-a/archive').set(as('adminA')).expect(201)
    expect(prisma.assignment.updateMany).toHaveBeenCalledWith({
      where: { trackId: 'track-a', track: { orgId: 'org-a' }, progress: { lt: 100 } },
      data: { progress: 100 },
    })
    expect(prisma.track.update).toHaveBeenCalledWith({ where: { id: 'track-a', orgId: 'org-a' }, data: { status: 'ARCHIVED' } })
  })

  it('archiving in one organization never changes the other organization', async () => {
    await http().post('/tracks/track-b/archive').set(as('adminB')).expect(201)
    expect(state.tracks.find((t) => t.id === 'track-b')!.status).toBe('ARCHIVED')
    expect(state.assignments.find((a) => a.id === 'asg-b')!.progress).toBe(100)
    // org-a records untouched
    expect(state.tracks.find((t) => t.id === 'track-a')!.status).toBe('DRAFT')
    expect(state.assignments.filter((a) => a.trackId === 'track-a').map((a) => a.progress)).toEqual([40, 100])
    expect(state.auditEvents).toEqual([expect.objectContaining({ orgId: 'org-b', action: 'TRACK_ARCHIVED', entityId: 'track-b', actorUserId: 'u-admin-b' })])
  })

  it('the actor is the authenticated user, never a value from the body', async () => {
    await http().post('/tracks/track-a/publish').set(as('staffA')).send({ actorUserId: 'forged', actorPersonId: 'forged' }).expect(201)
    expect(state.auditEvents).toEqual([expect.objectContaining({ orgId: 'org-a', actorUserId: 'u-staff-a', actorPersonId: 'person-staff-a' })])
    await http().post('/tracks').set(as('staffA')).send({ title: 'x', actorUserId: 'forged' }).expect(400)
    expect(state.auditEvents).toHaveLength(1)
  })

  it('tracks of another organization are 404 and generate no audit event or write', async () => {
    const before = clone(state)
    await http().post('/tracks/track-b/items').set(as('adminA')).send({ type: 'READING', title: 'x' }).expect(404)
    await http().post('/tracks/track-b/publish').set(as('adminA')).expect(404)
    await http().post('/tracks/track-b/archive').set(as('adminA')).expect(404)
    expect(state).toEqual(before)
    expect(prisma.auditEvent.create).not.toHaveBeenCalled()
  })

  it('a domain rule failure generates no audit event', async () => {
    await http().post('/tracks/track-a-empty/publish').set(as('adminA')).expect(400)
    expect(state.auditEvents).toEqual([])
  })

  it('archive rolls back both writes when one of them fails', async () => {
    failures.trackUpdateInTransaction = true
    await http().post('/tracks/track-a/archive').set(as('adminA')).expect(500)
    expect(prisma.assignment.updateMany).toHaveBeenCalledTimes(1) // it ran inside the transaction…
    expect(state.assignments.find((a) => a.id === 'asg-1')!.progress).toBe(40) // …and was reverted
    expect(state.tracks.find((t) => t.id === 'track-a')!.status).toBe('DRAFT')
    expect(state.auditEvents).toEqual([])
  })

  it('a real audit failure stays visible (not masked)', async () => {
    failures.auditCreate = true
    await http().post('/tracks/track-a/publish').set(as('adminA')).expect(500)
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1)
  })
})

describe('C8 PR3-4: TracksService passes organization and actor to the real AuditService', () => {
  beforeEach(() => {
    reset()
    jest.clearAllMocks()
  })

  it('create, addItem, publish and archive each persist exactly one event of the right organization', async () => {
    const service = new TracksService(prisma, new AuditService(prisma), assignmentFactory as any)
    const actor = { userId: 'u-1', personId: 'p-1' }
    const track = await service.create({ title: 'T', orgId: 'org-a', actor })
    await service.addItem({ trackId: track.id, orgId: 'org-a', type: 'READING', title: 'I', content: '', actor })
    await service.publish(track.id, 'org-a', actor)
    await service.archive(track.id, 'org-a', actor)
    expect(state.auditEvents.map((e) => [e.action, e.orgId, e.actorUserId, e.actorPersonId])).toEqual([
      ['TRACK_CREATED', 'org-a', 'u-1', 'p-1'],
      ['TRACK_ITEM_CREATED', 'org-a', 'u-1', 'p-1'],
      ['TRACK_PUBLISHED', 'org-a', 'u-1', 'p-1'],
      ['TRACK_ARCHIVED', 'org-a', 'u-1', 'p-1'],
    ])
    expect(prisma.person.findUnique).not.toHaveBeenCalled() // organization is explicit, not inferred
  })
})
