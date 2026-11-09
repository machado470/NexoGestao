import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { PeopleController } from '../../src/people/people.controller'
import { PeopleService } from '../../src/people/people.service'
import { PeopleOperationalSummaryService } from '../../src/people/people-operational-summary.service'
import { PersonAvailabilityExceptionsService } from '../../src/people/person-availability-exceptions.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { AuditService } from '../../src/audit/audit.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Assignee privacy with HTTP roles and PostgreSQL', () => {
  const db = new PrismaClient()
  const orgId = randomUUID(), otherOrgId = randomUUID()
  let app: INestApplication, person: any
  beforeAll(async () => {
    for (const id of [orgId, otherOrgId]) await db.organization.create({ data: { id, name: 'Privacy test', slug: `privacy-${id}` } })
    person = await db.person.create({ data: { orgId, name: 'Own active', role: 'TECH', email: 'private@example.test', workloadNotes: 'Private note', riskScore: 90 } })
    await db.person.create({ data: { orgId, name: 'Inactive', role: 'TECH', active: false } })
    await db.person.create({ data: { orgId: otherOrgId, name: 'Foreign', role: 'TECH' } })
    const module = await Test.createTestingModule({ controllers: [PeopleController], providers: [
      PeopleService, RolesGuard, { provide: PrismaService, useValue: db },
      { provide: AuditService, useValue: {} }, { provide: TimelineService, useValue: {} },
      { provide: PeopleOperationalSummaryService, useValue: {} }, { provide: PersonAvailabilityExceptionsService, useValue: {} },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      const req = context.switchToHttp().getRequest()
      req.user = { orgId, role: req.headers['x-test-role'] }
      return true
    } }).compile()
    app = module.createNestApplication(); await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.person.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] } } })
    await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
    await db.$disconnect()
  })
  it.each(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'])('returns only active tenant IDs/names for %s', async role => {
    const response = await request(app.getHttpServer()).get('/people/assignees').set('x-test-role', role).expect(200)
    expect(response.body).toEqual([{ id: person.id, name: person.name }])
  })
  it('keeps the complete directory restricted to administrators', async () => {
    await request(app.getHttpServer()).get('/people').set('x-test-role', 'VIEWER').expect(403)
    const response = await request(app.getHttpServer()).get('/people').set('x-test-role', 'ADMIN').expect(200)
    expect(response.body[0]).toMatchObject({ email: 'private@example.test', workloadNotes: 'Private note', riskScore: 90 })
  })
})
