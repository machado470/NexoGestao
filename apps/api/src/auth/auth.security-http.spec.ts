import { Controller, Get, Req, UseGuards, ValidationPipe, INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { APP_GUARD } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { PassportModule } from '@nestjs/passport'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import request from 'supertest'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { GoogleIdTokenVerifier } from './google-id-token-verifier'
import { JwtStrategy } from './jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { Roles } from './decorators/roles.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Controller('security-test')
@UseGuards(JwtAuthGuard, RolesGuard)
class ProtectedController {
  @Get()
  @Roles('ADMIN', 'MANAGER')
  identity(@Req() req: any) { return req.user }
}

describe('Authentication HTTP security regressions', () => {
  let app: INestApplication
  let persisted: any
  const jwt = new JwtService({ secret: 'local-http-test-secret' })
  const auth = { validateGoogleUser: jest.fn(), login: jest.fn().mockResolvedValue({ success: true }) }
  const makeToken = (overrides = {}) => jwt.sign({ sub: 'user', orgId: 'org', personId: 'person', role: 'ADMIN', sessionVersion: 0, ...overrides }, { expiresIn: '1h' })
  beforeEach(async () => {
    jest.clearAllMocks()
    persisted = { id: 'user', orgId: 'org', role: 'ADMIN', active: true, sessionVersion: 0,
      person: { id: 'person', active: true } }
    const module = await Test.createTestingModule({
      imports: [PassportModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [AuthController, ProtectedController],
      providers: [JwtStrategy, GoogleIdTokenVerifier, RolesGuard,
        { provide: ConfigService, useValue: { get: (key: string) => ({ JWT_SECRET: 'local-http-test-secret', NODE_ENV: 'test', GOOGLE_CLIENT_ID: 'test-client' } as any)[key] } },
        { provide: AuthService, useValue: auth },
        { provide: PrismaService, useValue: { user: { findUnique: async () => persisted } } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
  })
  afterEach(async () => { await app.close() })

  it('rejects the original email-only impersonation request', async () => {
    await request(app.getHttpServer()).post('/auth/google/bff-login').send({ email: 'admin@example.invalid' }).expect(400)
    expect(auth.validateGoogleUser).not.toHaveBeenCalled()
  })
  it('rejects an invalid Google token without issuing a session', async () => {
    await request(app.getHttpServer()).post('/auth/google/bff-login').send({ idToken: 'forged-token' }).expect(401)
    expect(auth.validateGoogleUser).not.toHaveBeenCalled()
  })
  it('accepts an active session then rejects it immediately after password revocation', async () => {
    const token = makeToken()
    await request(app.getHttpServer()).get('/security-test').auth(token, { type: 'bearer' }).expect(200)
    persisted.sessionVersion++
    await request(app.getHttpServer()).get('/security-test').auth(token, { type: 'bearer' }).expect(401)
  })
  it('rejects a disabled account and a legacy session', async () => {
    persisted.active = false
    await request(app.getHttpServer()).get('/security-test').auth(makeToken(), { type: 'bearer' }).expect(401)
    persisted.active = true
    await request(app.getHttpServer()).get('/security-test').auth(makeToken({ sessionVersion: undefined }), { type: 'bearer' }).expect(401)
  })
  it('rejects a stale admin token after demotion and denies a valid STAFF token manager access', async () => {
    const adminToken = makeToken()
    persisted.role = 'STAFF'
    await request(app.getHttpServer()).get('/security-test').auth(adminToken, { type: 'bearer' }).expect(401)
    await request(app.getHttpServer()).get('/security-test').auth(makeToken({ role: 'STAFF' }), { type: 'bearer' }).expect(403)
  })
  it('applies the five-attempt login limit, returning 429 on attempt six', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).post('/auth/login').send({ email: 'test@example.invalid', password: 'test' }).expect(201)
    }
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'test@example.invalid', password: 'test' }).expect(429)
    expect(auth.login).toHaveBeenCalledTimes(5)
  })
})
