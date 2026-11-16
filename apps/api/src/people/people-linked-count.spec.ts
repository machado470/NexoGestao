import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PeopleService } from './people.service'
import { PeopleController } from './people.controller'
import { PeopleOperationalSummaryService } from './people-operational-summary.service'
import { PersonAvailabilityExceptionsService } from './person-availability-exceptions.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('linked person count tenant boundary', () => {
  const count = jest.fn(async ({ where }: any) => where.orgId === 'org-a' ? 2 : 3)
  const service = new PeopleService({ person: { count } } as any, {} as any, {} as any)
  let app: INestApplication
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PeopleController],
      providers: [RolesGuard, { provide: PeopleService, useValue: service }, { provide: PeopleOperationalSummaryService, useValue: {} }, { provide: PersonAvailabilityExceptionsService, useValue: {} }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      const req = context.switchToHttp().getRequest()
      req.user = { orgId: 'org-a', role: req.headers['x-test-role'] || 'ADMIN' }
      return true
    } }).compile()
    app = module.createNestApplication()
    await app.init()
  })
  beforeEach(() => count.mockClear())
  afterAll(async () => app?.close())

  it.each([['org-a', 2], ['org-b', 3]])('counts linked people only in %s', async (orgId, expected) => {
    expect(await service.countUsersWithPerson(String(orgId))).toBe(expected)
    expect(count).toHaveBeenCalledWith({ where: { orgId, userId: { not: null } } })
  })
  it.each(['', undefined])('rejects missing organization %j before querying', async orgId => {
    await expect(service.countUsersWithPerson(orgId as any)).rejects.toThrow('orgId')
    expect(count).not.toHaveBeenCalled()
  })
  it('derives the organization from the session despite a different query organization', async () => {
    const response = await request(app.getHttpServer()).get('/people/stats/linked?orgId=org-b').expect(200)
    expect(response.body).toEqual({ count: 2 })
    expect(count).toHaveBeenCalledWith({ where: { orgId: 'org-a', userId: { not: null } } })
  })
  it.each(['MANAGER', 'STAFF', 'VIEWER'])('keeps the administrative metric unavailable to %s', async role => {
    await request(app.getHttpServer()).get('/people/stats/linked').set('x-test-role', role).expect(403)
    expect(count).not.toHaveBeenCalled()
  })
})
