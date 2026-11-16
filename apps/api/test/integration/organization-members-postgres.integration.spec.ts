import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PrismaClient, UserRole } from '@prisma/client'
import { randomUUID } from 'crypto'
import request from 'supertest'
import { OrganizationMembersController } from '../../src/organization-members/organization-members.controller'
import { OrganizationMembersService } from '../../src/organization-members/organization-members.service'
import { JwtStrategy } from '../../src/auth/jwt.strategy'
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { ActiveUserGuard } from '../../src/auth/guards/active-user.guard'
import { PrismaService } from '../../src/prisma/prisma.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Organization member administration with PostgreSQL and HTTP authorization', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const secret = 'member-tests-only-explicit-secret'
  const jwt = new JwtService({ secret })
  const orgIds: string[] = []
  let app: INestApplication
  let orgId: string
  let admin: any, second: any, staff: any
  const headers = (user: any, role = user.role) => ({ Authorization: `Bearer ${jwt.sign({ sub: user.id, orgId: user.orgId, role, personId: user.person?.id, sessionVersion: user.sessionVersion })}` })
  const edit = (actor: any, member: any, change: object) => request(app.getHttpServer())
    .patch(`/auth/organization/members/${member.id}`).set(headers(actor))
    .send({ expectedUpdatedAt: member.updatedAt.toISOString(), ...change })

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule], controllers: [OrganizationMembersController],
      providers: [OrganizationMembersService, JwtStrategy, JwtAuthGuard, RolesGuard, ActiveUserGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'JWT_SECRET' ? secret : undefined } }],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })
  async function organization() {
    const id = randomUUID()
    await prisma.organization.create({ data: { id, name: 'Member test', slug: `member-${id}` } })
    orgIds.push(id)
    return id
  }
  async function member(role: UserRole, tenant = orgId) {
    return prisma.user.create({ data: {
      orgId: tenant, role, email: `${randomUUID()}@members.test`, active: true, password: 'test-password-hash',
      person: { create: { orgId: tenant, name: 'Member', role: 'TECH', active: true } },
    }, include: { person: true } })
  }
  beforeEach(async () => {
    orgId = await organization()
    admin = await member('ADMIN')
    second = await member('ADMIN')
    staff = await member('STAFF')
  })
  afterAll(async () => {
    await app?.close()
    await prisma.auditEvent.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.person.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.$disconnect()
  })

  it('changes access role without changing operational role and writes atomic audit', async () => {
    await edit(admin, staff, { role: 'VIEWER' }).expect(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('VIEWER')
    expect((await prisma.person.findUniqueOrThrow({ where: { id: staff.person.id } })).role).toBe('TECH')
    expect(await prisma.auditEvent.count({ where: { orgId, actorUserId: admin.id, entityId: staff.id, action: 'ORGANIZATION_MEMBER_ACCESS_UPDATED' } })).toBe(1)
  })
  it('blocks an old token immediately after deactivation and permits explicit reactivation', async () => {
    await edit(admin, second, { active: false }).expect(200)
    await edit(second, staff, { active: false }).expect(401)
    const current = await prisma.user.findUniqueOrThrow({ where: { id: second.id } })
    await edit(admin, current, { active: true }).expect(200)
    expect((await prisma.person.findUniqueOrThrow({ where: { id: second.person.id } })).active).toBe(true)
  })
  it('denies administrative access through a stale ADMIN claim after demotion', async () => {
    await edit(admin, second, { role: 'VIEWER' }).expect(200)
    await edit(second, staff, { active: false }).expect(401)
  })
  it('does not trust an ADMIN claim for a persisted staff user', async () => {
    await request(app.getHttpServer()).patch(`/auth/organization/members/${second.id}`)
      .set(headers(staff, 'ADMIN')).send({ active: false, expectedUpdatedAt: second.updatedAt.toISOString() }).expect(401)
  })
  it('isolates other-tenant targets', async () => {
    const other = await member('STAFF', await organization())
    await edit(admin, other, { active: false }).expect(404)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).active).toBe(true)
  })
  it('rejects self-deactivation and self-demotion', async () => {
    await edit(admin, admin, { active: false }).expect(400)
    await edit(admin, admin, { role: 'VIEWER' }).expect(400)
  })
  it('serializes concurrent mutual demotions and preserves an active administrator', async () => {
    const responses = await Promise.all([edit(admin, second, { role: 'STAFF' }), edit(second, admin, { role: 'STAFF' })])
    expect(responses.filter(response => response.status === 200)).toHaveLength(1)
    expect(responses.some(response => [401, 403].includes(response.status))).toBe(true)
    expect(await prisma.user.count({ where: { orgId, active: true, role: 'ADMIN' } })).toBe(1)
  })
  it('rejects stale forms without overwriting the newer access state', async () => {
    await edit(admin, staff, { active: false }).expect(200)
    await edit(admin, staff, { active: true }).expect(409)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).active).toBe(false)
  })
  it('validates roles, booleans and tenant injection at the HTTP boundary', async () => {
    await edit(admin, staff, { role: 'SUPERADMIN' }).expect(400)
    await edit(admin, staff, { active: 'false' }).expect(400)
    await edit(admin, staff, { active: false, orgId: randomUUID() }).expect(400)
  })
  it('does not use access activation to reactivate an offboarded operational person', async () => {
    await prisma.person.update({ where: { id: staff.person.id }, data: { active: false } })
    const updated = await prisma.user.update({ where: { id: staff.id }, data: { active: false } })
    await edit(admin, updated, { active: true }).expect(400)
  })
})
