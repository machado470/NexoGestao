import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'

import { AssignmentFactoryService } from '../../src/assignments/assignment-factory.service'
import { AuditService } from '../../src/audit/audit.service'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { JwtStrategy } from '../../src/auth/jwt.strategy'
import { ApiExceptionFilter } from '../../src/common/http/api-exception.filter'
import { PrismaService } from '../../src/prisma/prisma.service'
import { TrackItemsController } from '../../src/track-items/track-items.controller'
import { TrackItemsService } from '../../src/track-items/track-items.service'
import { TracksController } from '../../src/tracks/tracks.controller'
import { TracksService } from '../../src/tracks/tracks.service'
import { describeRealIntegration } from './infra-guards'

/**
 * C8 PR3-2 / PR3-2B — track roles with the real session validation (JwtStrategy + persisted session) and
 * PostgreSQL: active ADMIN is authorized, other roles get 403, inactive users/people, a revoked
 * session and missing credentials get 401 — always before any write.
 */
describeRealIntegration('Track routes: roles and real session validation with PostgreSQL', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const secret = 'tracks-roles-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  let app: INestApplication
  let orgId: string

  const token = (user: any) =>
    `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role: user.role, personId: user.person?.id, sessionVersion: user.sessionVersion })}`

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [TracksController, TrackItemsController],
      providers: [
        TracksService,
        TrackItemsService,
        AuditService,
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        { provide: AssignmentFactoryService, useValue: { assignPeopleToTrack: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'JWT_SECRET' ? secret : undefined) } },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new ApiExceptionFilter())
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })

  async function member(role: UserRole) {
    return prisma.user.create({
      data: {
        orgId,
        role,
        email: `${randomUUID()}@tracks-roles.test`,
        active: true,
        password: 'test-password-hash',
        person: { create: { orgId, name: `Pessoa ${role}`, role: 'TECH', active: true } },
      },
      include: { person: true },
    })
  }

  beforeEach(async () => {
    orgId = randomUUID()
    await prisma.organization.create({ data: { id: orgId, name: 'Tracks roles test', slug: `tracks-roles-${orgId}` } })
    orgIds.push(orgId)
  })

  afterAll(async () => {
    await app?.close()
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.track.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.person.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  const http = () => request(app.getHttpServer())
  const tracksOf = () => prisma.track.count({ where: { orgId } })

  it('an active ADMIN is authorized (session validated against the database)', async () => {
    const admin = await member('ADMIN')
    await http().get('/tracks').set('Authorization', token(admin)).expect(200)
    const created = await http().post('/tracks').set('Authorization', token(admin)).send({ title: 'Trilha real' }).expect(201)
    expect(await tracksOf()).toBe(1)
    expect(await prisma.auditEvent.count({ where: { orgId, action: 'TRACK_CREATED', entityId: created.body.id, actorUserId: admin.id } })).toBe(1)
  })

  it.each(['MANAGER', 'STAFF', 'VIEWER'] as UserRole[])('an active %s gets 403 on read and write, before any write', async (role) => {
    const user = await member(role)
    await http().get('/tracks').set('Authorization', token(user)).expect(403)
    await http().post('/tracks').set('Authorization', token(user)).send({ title: 'x' }).expect(403)
    await http().get('/track-items/track/any').set('Authorization', token(user)).expect(403)
    expect(await tracksOf()).toBe(0)
    expect(await prisma.auditEvent.count({ where: { orgId } })).toBe(0)
  })

  it('an inactive ADMIN user gets 401 before any write', async () => {
    const admin = await member('ADMIN')
    await prisma.user.update({ where: { id: admin.id }, data: { active: false } })
    await http().get('/tracks').set('Authorization', token(admin)).expect(401)
    await http().post('/tracks').set('Authorization', token(admin)).send({ title: 'x' }).expect(401)
    expect(await tracksOf()).toBe(0)
  })

  it('an ADMIN whose person was deactivated gets 401', async () => {
    const admin = await member('ADMIN')
    await prisma.person.update({ where: { id: admin.person!.id }, data: { active: false } })
    await http().post('/tracks').set('Authorization', token(admin)).send({ title: 'x' }).expect(401)
    expect(await tracksOf()).toBe(0)
  })

  it('a revoked session (sessionVersion bumped) and a demoted ADMIN get 401', async () => {
    const admin = await member('ADMIN')
    const stale = token(admin)
    await prisma.user.update({ where: { id: admin.id }, data: { sessionVersion: { increment: 1 } } })
    await http().post('/tracks').set('Authorization', stale).send({ title: 'x' }).expect(401)
    const other = await member('ADMIN')
    const adminToken = token(other)
    await prisma.user.update({ where: { id: other.id }, data: { role: 'STAFF' } })
    await http().post('/tracks').set('Authorization', adminToken).send({ title: 'x' }).expect(401)
    expect(await tracksOf()).toBe(0)
  })

  // C8 PR3-2B: a track that does not exist or belongs to another organization is 404 (was 500).
  describe('missing or other-organization track on GET /tracks/:id, GET /tracks/:id/items, POST /tracks/:id/unassign', () => {
    async function foreignTrack() {
      const ownerOrg = randomUUID()
      orgIds.push(ownerOrg)
      await prisma.organization.create({ data: { id: ownerOrg, name: 'Tracks owner org', slug: `tracks-owner-${ownerOrg}` } })
      const person = await prisma.person.create({ data: { orgId: ownerOrg, name: 'Pessoa Estrangeira', role: 'TECH', active: true } })
      const track = await prisma.track.create({
        data: { orgId: ownerOrg, slug: `foreign-${ownerOrg}`, title: 'Trilha Estrangeira', status: 'DRAFT', version: 1, items: { create: { title: 'Item Estrangeiro', content: 'conteudo', type: 'READING', order: 1 } } },
      })
      await prisma.assignment.create({ data: { personId: person.id, trackId: track.id, progress: 30 } })
      return { ownerOrg, person, track }
    }
    const routes = (personId: string) => [
      { name: 'GET /tracks/:id', send: (id: string, auth: string) => http().get(`/tracks/${id}`).set('Authorization', auth) },
      { name: 'GET /tracks/:id/items', send: (id: string, auth: string) => http().get(`/tracks/${id}/items`).set('Authorization', auth) },
      { name: 'POST /tracks/:id/unassign', send: (id: string, auth: string) => http().post(`/tracks/${id}/unassign`).set('Authorization', auth).send({ personIds: [personId] }) },
    ]
    const comparable = ({ path: _path, ...rest }: any) => rest

    afterAll(async () => {
      await prisma.assignment.deleteMany({ where: { track: { orgId: { in: orgIds } } } })
      await prisma.trackItem.deleteMany({ where: { track: { orgId: { in: orgIds } } } })
    })

    it('an ADMIN gets the same 404 for a missing id and for another organization’s track, with no data, no deletion and no audit', async () => {
      const admin = await member('ADMIN')
      const { ownerOrg, person, track } = await foreignTrack()
      const auth = token(admin)
      for (const route of routes(person.id)) {
        const missing = await route.send(randomUUID(), auth)
        const foreign = await route.send(track.id, auth)
        for (const res of [missing, foreign]) {
          expect([route.name, res.status, res.body.code]).toEqual([route.name, 404, null])
          expect(res.body).toMatchObject({ success: false, error: 'Trilha não encontrada', data: null })
          const text = JSON.stringify(res.body)
          for (const fragment of ['Trilha Estrangeira', 'Item Estrangeiro', 'Pessoa Estrangeira', ownerOrg, person.id]) expect(text).not.toContain(fragment)
        }
        expect(comparable(foreign.body)).toEqual(comparable(missing.body))
      }
      expect(await prisma.assignment.count({ where: { trackId: track.id, personId: person.id, progress: 30 } })).toBe(1)
      expect(await prisma.auditEvent.count({ where: { orgId: { in: [orgId, ownerOrg] } } })).toBe(0)
    })

    it('the ADMIN of the owning organization still reads the track and its items and unassigns', async () => {
      const { ownerOrg, person, track } = await foreignTrack()
      orgId = ownerOrg
      const owner = await member('ADMIN')
      const auth = token(owner)
      const read = await http().get(`/tracks/${track.id}`).set('Authorization', auth).expect(200)
      expect(read.body).toMatchObject({ id: track.id, title: 'Trilha Estrangeira', assignments: [expect.objectContaining({ personId: person.id })] })
      // Pre-existing: this route returns the same payload as GET /tracks/:id (not changed here).
      const items = await http().get(`/tracks/${track.id}/items`).set('Authorization', auth).expect(200)
      expect(items.body).toMatchObject({ id: track.id })
      const unassigned = await http().post(`/tracks/${track.id}/unassign`).set('Authorization', auth).send({ personIds: [person.id] }).expect(201)
      expect(unassigned.body).toEqual({ unassigned: 1 })
      expect(await prisma.assignment.count({ where: { trackId: track.id } })).toBe(0)
    })

    it.each(['MANAGER', 'STAFF', 'VIEWER'] as UserRole[])('%s still gets 403 on these routes, before any lookup or deletion', async (role) => {
      const user = await member(role)
      const { person, track } = await foreignTrack()
      for (const route of routes(person.id)) await route.send(track.id, token(user)).expect(403)
      expect(await prisma.assignment.count({ where: { trackId: track.id } })).toBe(1)
    })

    it('no credentials still get 401 on these routes', async () => {
      const { person, track } = await foreignTrack()
      await http().get(`/tracks/${track.id}`).expect(401)
      await http().get(`/tracks/${track.id}/items`).expect(401)
      await http().post(`/tracks/${track.id}/unassign`).send({ personIds: [person.id] }).expect(401)
      expect(await prisma.assignment.count({ where: { trackId: track.id } })).toBe(1)
    })
  })

  it('missing or invalid credentials get 401', async () => {
    await http().get('/tracks').expect(401)
    await http().post('/tracks').set('Authorization', 'Bearer not-a-jwt').send({ title: 'x' }).expect(401)
    expect(await tracksOf()).toBe(0)
  })
})
