import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import request from 'supertest'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { GoogleIdTokenVerifier } from './google-id-token-verifier'

describe('Public auth DTO boundaries', () => {
  let app: INestApplication
  const auth = Object.fromEntries(['register', 'login', 'forgotPassword', 'resetPassword', 'verifyEmail', 'resendEmailVerification'].map(name => [name, jest.fn().mockResolvedValue({ success: true })]))
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [
      { provide: AuthService, useValue: auth }, { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: GoogleIdTokenVerifier, useValue: { verify: jest.fn() } },
    ] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })
  beforeEach(() => jest.clearAllMocks())
  afterAll(() => app.close())
  const valid = { orgName: 'Company', adminName: 'Admin', email: 'valid@test.invalid', password: 'Password123!' }
  it.each([
    ['register', { ...valid, orgName: 123 }, 'register'],
    ['register', { ...valid, orgName: ' '.repeat(3) }, 'register'],
    ['register', { ...valid, adminName: ['Admin'] }, 'register'],
    ['register', { ...valid, email: 'invalid' }, 'register'],
    ['register', { ...valid, password: {} }, 'register'],
    ['register', { ...valid, password: 12345678 }, 'register'],
    ['register', { ...valid, password: 'a'.repeat(1025) }, 'register'],
    ['register', { ...valid, role: 'ADMIN' }, 'register'],
    ['login', { email: ['valid@test.invalid'], password: 'pass' }, 'login'],
    ['login', { email: valid.email, password: 12345678 }, 'login'],
    ['forgot-password', { email: 123 }, 'forgotPassword'],
    ['resend-email-verification', { email: null }, 'resendEmailVerification'],
    ['reset-password', { token: {}, password: 'Password123!' }, 'resetPassword'],
    ['reset-password', { token: 'token', password: 'short' }, 'resetPassword'],
    ['verify-email', { token: ' '.repeat(3) }, 'verifyEmail'],
    ['verify-email', { token: 123 }, 'verifyEmail'],
    ['verify-email', { token: 'a'.repeat(257) }, 'verifyEmail'],
  ])('rejects invalid %s input before service execution', async (route, body, method) => {
    await request(app.getHttpServer()).post(`/auth/${route}`).send(body).expect(400)
    expect(auth[method as string]).not.toHaveBeenCalled()
  })
  it('trims names and email while preserving password whitespace', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({ ...valid, orgName: ' Company ', adminName: ' Admin ', email: ' valid@test.invalid ', password: ' Password123! ' }).expect(201)
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({ orgName: 'Company', adminName: 'Admin', email: 'valid@test.invalid', password: ' Password123! ' }))
  })
  it('retains compatibility with short passwords on existing-account login', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: valid.email, password: 'old' }).expect(201)
    expect(auth.login).toHaveBeenCalledWith(valid.email, 'old')
  })
})
