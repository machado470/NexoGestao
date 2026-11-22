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
 * C8 PR3-2 — track roles with the real session validation (JwtStrategy + persisted session) and
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

  it('missing or invalid credentials get 401', async () => {
    await http().get('/tracks').expect(401)
    await http().post('/tracks').set('Authorization', 'Bearer not-a-jwt').send({ title: 'x' }).expect(401)
    expect(await tracksOf()).toBe(0)
  })
})
