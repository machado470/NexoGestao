import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JwtStrategy } from '../auth/jwt.strategy'
import { PLATFORM_ADMIN_USER_IDS_ENV } from '../auth/guards/platform-admin.guard'
import { PrismaService } from '../prisma/prisma.service'
import { PlatformAccessController } from './platform-access.controller'

// C7.2c: the BFF diagnostic is authorized here. Only a verified session of an active ADMIN whose
// id is in PLATFORM_ADMIN_USER_IDS passes; an organization ADMIN alone is refused.
const SECRET = 'c7-2c-platform-access-secret'
const jwt = new JwtService({ secret: SECRET })

type U = { id: string; orgId: string; role: string; active: boolean; sessionVersion: number; person: { id: string; active: boolean } }
const persisted = (id: string, orgId: string, role = 'ADMIN', active = true): U =>
  ({ id, orgId, role, active, sessionVersion: 0, person: { id: `person-${id}`, active: true } })
const users: Record<string, U> = {
  platform: persisted('platform', 'org-a'),
  orgAdmin: persisted('orgAdmin', 'org-b'),
  staff: persisted('staff', 'org-a', 'STAFF'),
  inactive: persisted('inactive', 'org-a', 'ADMIN', false),
}
const token = (u: U) => jwt.sign({ sub: u.id, orgId: u.orgId, role: u.role, personId: u.person.id, sessionVersion: 0 })

describe('C7.2c: GET /admin/platform-access', () => {
  let app: INestApplication
  const previousAllowlist = process.env[PLATFORM_ADMIN_USER_IDS_ENV]
  const previousSecret = process.env.JWT_SECRET

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PlatformAccessController],
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_SECRET: SECRET, NODE_ENV: 'test' } as Record<string, string>)[key] } },
        { provide: PrismaService, useValue: { user: {
          findUnique: async ({ where }: any) => users[where.id] ?? null,
          findFirst: async ({ where }: any) => {
            const u = users[where.id]
            return u && u.orgId === where.orgId && u.active === where.active ? { id: u.id } : null
          },
        } } },
      ],
    }).compile()
    app = module.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
    if (previousAllowlist === undefined) delete process.env[PLATFORM_ADMIN_USER_IDS_ENV]
    else process.env[PLATFORM_ADMIN_USER_IDS_ENV] = previousAllowlist
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })

  beforeEach(() => { process.env[PLATFORM_ADMIN_USER_IDS_ENV] = 'platform, staff, inactive' })
  const call = (bearer?: string) => {
    const req = request(app.getHttpServer()).get('/admin/platform-access')
    return bearer ? req.set('Authorization', `Bearer ${bearer}`) : req
  }

  it('allows an allowlisted, active ADMIN and returns no data beyond the decision', async () => {
    const res = await call(token(users.platform)).expect(200)
    expect(res.body).toEqual({ platformAdmin: true })
  })

  it('refuses an organization ADMIN that is not a platform operator, without revealing identifiers', async () => {
    const res = await call(token(users.orgAdmin)).expect(403)
    expect(JSON.stringify(res.body)).not.toMatch(/orgAdmin|org-b|platform"|PLATFORM_ADMIN_USER_IDS|person-/)
  })

  it('the allow response carries no identifiers, roles or allowlist data', async () => {
    const res = await call(token(users.platform)).expect(200)
    expect(Object.keys(res.body)).toEqual(['platformAdmin'])
    expect(JSON.stringify(res.body)).not.toMatch(/org-a|person-|ADMIN|staff|inactive/)
  })

  it('refuses allowlisted ids without the ADMIN role or no longer active', async () => {
    await call(token(users.staff)).expect(403)
    await call(token(users.inactive)).expect(401)
  })

  it('denies everyone when the allowlist is empty', async () => {
    process.env[PLATFORM_ADMIN_USER_IDS_ENV] = ''
    await call(token(users.platform)).expect(403)
  })

  it('refuses anonymous, forged and other-secret tokens', async () => {
    await call().expect(401)
    await call('not-a-jwt').expect(401)
    await call(new JwtService({ secret: 'attacker' }).sign({ sub: 'platform', orgId: 'org-a', role: 'ADMIN', sessionVersion: 0 })).expect(401)
  })

  it('an organization claim in the token cannot borrow another tenant identity', async () => {
    const forgedOrg = jwt.sign({ sub: 'platform', orgId: 'org-b', role: 'ADMIN', personId: 'person-platform', sessionVersion: 0 })
    const res = await call(forgedOrg)
    expect([401, 403]).toContain(res.status)
  })
})
