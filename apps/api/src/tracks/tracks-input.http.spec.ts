import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuditService } from '../audit/audit.service'
import { AssignmentFactoryService } from '../assignments/assignment-factory.service'
import { TENANT_ACCESS_INTERCEPTOR_PROVIDER } from '../common/guards/tenant-access.guard'
import { PrismaService } from '../prisma/prisma.service'
import { TrackItemsController } from '../track-items/track-items.controller'
import { TrackItemsService } from '../track-items/track-items.service'
import { TracksController } from './tracks.controller'
import { TracksService } from './tracks.service'

/**
 * C8 PR3-1 — mass assignment on tracks and track items.
 *
 * Bodies used to be inline types, which the global ValidationPipe does not validate, and the
 * services wrote `data: params`. Any field reached Prisma: a track could change status, slug or
 * version, and an item could be moved to another track (TrackItem has no orgId column, so the
 * tenant middleware does not scope it). Role rules are out of scope here (PR3-2).
 */

const USERS: Record<string, { userId: string; orgId: string; role: string; personId: string }> = {
  adminA: { userId: 'u-admin-a', orgId: 'org-a', role: 'ADMIN', personId: 'person-admin-a' },
  staffA: { userId: 'u-staff-a', orgId: 'org-a', role: 'STAFF', personId: 'person-a' },
}

type TrackRow = { id: string; orgId: string; status: string; title: string; slug: string; version: number; description: string | null }
type ItemRow = { id: string; trackId: string; title: string; content: string | null; type: string; order: number }

let tracks: TrackRow[]
let items: ItemRow[]

function reset() {
  tracks = [
    { id: 'track-a', orgId: 'org-a', status: 'DRAFT', title: 'Trilha A', slug: 'trilha-a', version: 1, description: null },
    { id: 'track-a-active', orgId: 'org-a', status: 'ACTIVE', title: 'Trilha ativa', slug: 'trilha-ativa', version: 1, description: null },
    { id: 'track-b', orgId: 'org-b', status: 'DRAFT', title: 'Trilha B', slug: 'trilha-b', version: 1, description: null },
  ]
  items = [
    { id: 'item-a1', trackId: 'track-a', title: 'Item A1', content: 'a', type: 'READING', order: 1 },
    { id: 'item-b1', trackId: 'track-b', title: 'Item B1', content: 'b', type: 'READING', order: 1 },
  ]
}

const matchTrack = (row: TrackRow, where: any) =>
  (where.id === undefined || row.id === where.id) &&
  (where.orgId === undefined || row.orgId === where.orgId) &&
  (where.slug === undefined || row.slug === where.slug)
const withItems = (row: TrackRow, include: any) => (include?.items ? { ...row, items: items.filter((i) => i.trackId === row.id) } : { ...row })

const prisma: any = {
  track: {
    findFirst: jest.fn(async ({ where, include }: any) => {
      const row = tracks.find((t) => matchTrack(t, where))
      return row ? withItems(row, include) : null
    }),
    findFirstOrThrow: jest.fn(async ({ where }: any) => {
      const row = tracks.find((t) => matchTrack(t, where))
      if (!row) throw new Error('not found')
      return row
    }),
    create: jest.fn(async ({ data }: any) => ({ id: 'track-new', ...data })),
    update: jest.fn(async ({ where, data }: any) => {
      const row = tracks.find((t) => t.id === where.id)!
      Object.assign(row, data)
      return { ...row }
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
    create: jest.fn(async ({ data }: any) => ({ id: 'item-new', ...data })),
    update: jest.fn(async ({ where, data }: any) => {
      const item = items.find((i) => i.id === where.id)!
      Object.assign(item, data)
      return { ...item }
    }),
    aggregate: jest.fn(async ({ where }: any) => ({ _max: { order: Math.max(0, ...items.filter((i) => i.trackId === where.trackId).map((i) => i.order)) } })),
  },
  $transaction: jest.fn(async (fn: any) => fn(prisma)),
}
const audit = { log: jest.fn().mockResolvedValue(undefined) }
const assignmentFactory = { assignPeopleToTrack: jest.fn(async ({ personIds }: any) => ({ assigned: personIds.length })) }

describe('C8 PR3-1: tracks and track items accept only explicit fields', () => {
  let app: INestApplication
  const as = (key: keyof typeof USERS) => ({ 'x-test-user': key })
  const http = () => request(app.getHttpServer())

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TracksController, TrackItemsController],
      providers: [
        TENANT_ACCESS_INTERCEPTOR_PROVIDER,
        TracksService,
        TrackItemsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
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
    // Same options as apps/api/src/main.ts.
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

  describe('internal fields are rejected before any write', () => {
    it.each([
      ['status', { status: 'ACTIVE' }],
      ['slug', { slug: 'outra' }],
      ['version', { version: 9 }],
      ['createdAt', { createdAt: '2020-01-01T00:00:00.000Z' }],
      ['id', { id: 'track-b' }],
      ['items', { items: [] }],
    ])('PATCH /tracks/:id with %s → 400', async (_field, extra) => {
      await http().patch('/tracks/track-a').set(as('adminA')).send({ title: 'Novo', ...extra }).expect(400)
      expect(prisma.track.update).not.toHaveBeenCalled()
      expect(tracks.find((t) => t.id === 'track-a')).toMatchObject({ status: 'DRAFT', slug: 'trilha-a', version: 1, title: 'Trilha A' })
    })

    it('a track cannot change organization through the body', async () => {
      // Another organization: the global tenant interceptor refuses it.
      await http().patch('/tracks/track-a').set(as('adminA')).send({ orgId: 'org-b', title: 'x' }).expect(403)
      // Even the caller's own organization id is not an accepted field.
      await http().patch('/tracks/track-a').set(as('adminA')).send({ orgId: 'org-a', title: 'x' }).expect(400)
      await http().post('/tracks').set(as('adminA')).send({ title: 'Nova', orgId: 'org-a' }).expect(400)
      expect(prisma.track.update).not.toHaveBeenCalled()
      expect(prisma.track.create).not.toHaveBeenCalled()
      expect(tracks.find((t) => t.id === 'track-a')!.orgId).toBe('org-a')
    })

    it.each([
      ['status', { status: 'ACTIVE' }],
      ['slug', { slug: 'x' }],
      ['version', { version: 3 }],
    ])('POST /tracks with %s → 400', async (_field, extra) => {
      await http().post('/tracks').set(as('adminA')).send({ title: 'Nova', ...extra }).expect(400)
      expect(prisma.track.create).not.toHaveBeenCalled()
    })

    it.each([
      ['trackId', { trackId: 'track-b' }],
      ['order', { order: 9 }],
      ['type', { type: 'ACTION' }],
      ['id', { id: 'item-b1' }],
    ])('PATCH /track-items/:itemId with %s → 400 (an item cannot move to another track)', async (_field, extra) => {
      await http().patch('/track-items/item-a1').set(as('adminA')).send({ title: 'Novo', ...extra }).expect(400)
      expect(prisma.trackItem.update).not.toHaveBeenCalled()
      expect(items.find((i) => i.id === 'item-a1')).toMatchObject({ trackId: 'track-a', order: 1, type: 'READING', title: 'Item A1' })
    })

    it('creating items cannot target another track or set the order', async () => {
      await http().post('/track-items/track/track-a').set(as('adminA')).send({ type: 'READING', title: 'x', trackId: 'track-b' }).expect(400)
      await http().post('/track-items/track/track-a').set(as('adminA')).send({ type: 'READING', title: 'x', order: 1 }).expect(400)
      await http().post('/tracks/track-a/items').set(as('adminA')).send({ type: 'READING', title: 'x', trackId: 'track-b' }).expect(400)
      await http().post('/tracks/track-a/items').set(as('adminA')).send({ type: 'READING', title: 'x', order: 1 }).expect(400)
      expect(prisma.trackItem.create).not.toHaveBeenCalled()
    })
  })

  describe('invalid input is a 400, not a 500', () => {
    it.each([
      ['POST /tracks without title', () => http().post('/tracks').send({})],
      ['POST /tracks with blank title', () => http().post('/tracks').send({ title: '   ' })],
      ['POST /tracks with too long title', () => http().post('/tracks').send({ title: 'x'.repeat(201) })],
      ['PATCH /tracks with blank title', () => http().patch('/tracks/track-a').send({ title: '' })],
      ['POST /tracks/:id/items with unknown type', () => http().post('/tracks/track-a/items').send({ type: 'VIDEO', title: 'x' })],
      ['POST /tracks/:id/items without title', () => http().post('/tracks/track-a/items').send({ type: 'READING' })],
      ['POST /track-items/track/:id with unknown type', () => http().post('/track-items/track/track-a').send({ type: 'CONTENT', title: 'x' })],
      ['POST /tracks/:id/assign with a string instead of a list', () => http().post('/tracks/track-a/assign').send({ personIds: 'person-a' })],
      ['POST /tracks/:id/assign with non-string ids', () => http().post('/tracks/track-a/assign').send({ personIds: [1, 2] })],
      ['POST /tracks/:id/assign with duplicated ids', () => http().post('/tracks/track-a/assign').send({ personIds: ['p', 'p'] })],
      ['POST /tracks/:id/unassign with a string instead of a list', () => http().post('/tracks/track-a/unassign').send({ personIds: 'person-a' })],
    ])('%s → 400', async (_label, call) => {
      await call().set(as('adminA')).expect(400)
      expect(prisma.track.create).not.toHaveBeenCalled()
      expect(prisma.track.update).not.toHaveBeenCalled()
      expect(prisma.trackItem.create).not.toHaveBeenCalled()
      expect(assignmentFactory.assignPeopleToTrack).not.toHaveBeenCalled()
    })
  })

  describe('legitimate operations still work', () => {
    it('creates a track with a trimmed title and optional description', async () => {
      await http().post('/tracks').set(as('adminA')).send({ title: '  Nova trilha  ', description: 'Descrição' }).expect(201)
      expect(prisma.track.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: 'Nova trilha', description: 'Descrição', orgId: 'org-a', status: 'DRAFT', slug: 'nova-trilha', version: 1 }),
      })
    })

    it('updates only title and description', async () => {
      await http().patch('/tracks/track-a').set(as('staffA')).send({ title: 'Renomeada' }).expect(200)
      expect(prisma.track.update).toHaveBeenLastCalledWith({ where: { id: 'track-a' }, data: { title: 'Renomeada' } })
      await http().patch('/tracks/track-a').set(as('adminA')).send({ description: '' }).expect(200)
      expect(prisma.track.update).toHaveBeenLastCalledWith({ where: { id: 'track-a' }, data: { description: '' } })
    })

    it('an empty update is a no-op that returns the track', async () => {
      const res = await http().patch('/tracks/track-a').set(as('adminA')).send({}).expect(200)
      expect(res.body).toMatchObject({ id: 'track-a', title: 'Trilha A' })
      expect(prisma.track.update).not.toHaveBeenCalled()
    })

    it('adds items through both routes (CONTENT keeps mapping to READING)', async () => {
      await http().post('/tracks/track-a/items').set(as('adminA')).send({ type: 'CONTENT', title: ' Leitura ', content: 'texto' }).expect(201)
      expect(prisma.trackItem.create).toHaveBeenLastCalledWith({ data: { trackId: 'track-a', order: 2, type: 'READING', title: 'Leitura', content: 'texto' } })
      await http().post('/track-items/track/track-a').set(as('adminA')).send({ type: 'ACTION', title: 'Ação' }).expect(201)
      expect(prisma.trackItem.create).toHaveBeenLastCalledWith({ data: { trackId: 'track-a', title: 'Ação', content: undefined, type: 'ACTION', order: 2 } })
    })

    it('updates only title and content of an item', async () => {
      await http().patch('/track-items/item-a1').set(as('adminA')).send({ title: 'Novo título', content: 'novo' }).expect(200)
      expect(prisma.trackItem.update).toHaveBeenCalledWith({ where: { id: 'item-a1' }, data: { title: 'Novo título', content: 'novo' } })
    })

    it('assigns people with a valid list, and keeps a missing list as a no-op', async () => {
      await http().post('/tracks/track-a/assign').set(as('adminA')).send({ personIds: ['person-a', 'person-c'] }).expect(201)
      expect(assignmentFactory.assignPeopleToTrack).toHaveBeenLastCalledWith({ trackId: 'track-a', personIds: ['person-a', 'person-c'], orgId: 'org-a' })
      await http().post('/tracks/track-a/assign').set(as('adminA')).send({}).expect(201)
      expect(assignmentFactory.assignPeopleToTrack).toHaveBeenLastCalledWith({ trackId: 'track-a', personIds: [], orgId: 'org-a' })
    })

    it('existing domain rules still apply (only DRAFT tracks are editable)', async () => {
      await http().patch('/tracks/track-a-active').set(as('adminA')).send({ title: 'x' }).expect(400)
      expect(prisma.track.update).not.toHaveBeenCalled()
    })
  })

  describe('organization isolation', () => {
    it('a track of another organization is not found (read and write)', async () => {
      await http().patch('/tracks/track-b').set(as('adminA')).send({ title: 'x' }).expect(404)
      await http().post('/tracks/track-b/items').set(as('adminA')).send({ type: 'READING', title: 'x' }).expect(404)
      await http().post('/track-items/track/track-b').set(as('staffA')).send({ type: 'READING', title: 'x' }).expect(404)
      expect(prisma.track.update).not.toHaveBeenCalled()
      expect(prisma.trackItem.create).not.toHaveBeenCalled()
      expect(tracks.find((t) => t.id === 'track-b')).toMatchObject({ orgId: 'org-b', title: 'Trilha B' })
    })

    it('an item of another organization is not found', async () => {
      await http().patch('/track-items/item-b1').set(as('adminA')).send({ title: 'x' }).expect(404)
      expect(prisma.trackItem.update).not.toHaveBeenCalled()
      expect(items.find((i) => i.id === 'item-b1')).toMatchObject({ trackId: 'track-b', title: 'Item B1' })
    })
  })
})

describe('C8 PR3-1: services map fields explicitly (defense in depth)', () => {
  beforeEach(() => {
    reset()
    jest.clearAllMocks()
  })

  it('TracksService.update ignores internal fields even if a caller passes them', async () => {
    const service = new TracksService(prisma, audit as any, assignmentFactory as any)
    await service.update('track-a', 'org-a', { title: 'T', status: 'ACTIVE', orgId: 'org-b', slug: 'x', version: 7 } as any)
    expect(prisma.track.update).toHaveBeenCalledWith({ where: { id: 'track-a' }, data: { title: 'T' } })
    expect(tracks.find((t) => t.id === 'track-a')).toMatchObject({ orgId: 'org-a', status: 'DRAFT', slug: 'trilha-a', version: 1 })
  })

  it('TrackItemsService.update cannot move an item to another track', async () => {
    const service = new TrackItemsService(prisma)
    await service.update('item-a1', 'org-a', { content: 'c', trackId: 'track-b', order: 5, type: 'ACTION' } as any)
    expect(prisma.trackItem.update).toHaveBeenCalledWith({ where: { id: 'item-a1' }, data: { content: 'c' } })
    expect(items.find((i) => i.id === 'item-a1')).toMatchObject({ trackId: 'track-a', order: 1, type: 'READING' })
  })

  it('TrackItemsService.update with nothing to change returns the item without writing', async () => {
    const service = new TrackItemsService(prisma)
    const result = await service.update('item-a1', 'org-a', {} as any)
    expect(result).toEqual({ id: 'item-a1', trackId: 'track-a', title: 'Item A1', content: 'a', type: 'READING', order: 1 })
    expect(prisma.trackItem.update).not.toHaveBeenCalled()
  })
})
