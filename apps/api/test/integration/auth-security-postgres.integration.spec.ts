import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomUUID } from 'crypto'
import request from 'supertest'
import { ConfigModule } from '@nestjs/config'
import { ClsModule } from 'nestjs-cls'
import { AuthModule } from '../../src/auth/auth.module'
import { PrismaModule } from '../../src/prisma/prisma.module'
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'
import { Roles } from '../../src/auth/decorators/roles.decorator'
import { AuthService } from '../../src/auth/auth.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { describeRealIntegration } from './infra-guards'


@Controller('security-identity')
@UseGuards(JwtAuthGuard, RolesGuard)
class SecurityIdentityController {
  @Get()
  @Roles('ADMIN', 'MANAGER')
  identity() { return { authenticated: true } }
}

describeRealIntegration('Security audit authentication regressions (real PostgreSQL)', () => {
  jest.setTimeout(90000)
  let app: INestApplication
  let prisma: PrismaService
  let auth: AuthService
  const orgId = randomUUID(), userId = randomUUID(), personId = randomUUID()
  let token: string
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), ClsModule.forRoot({ global: true, middleware: { mount: true } }), PrismaModule, AuthModule], controllers: [SecurityIdentityController], providers: [RolesGuard] }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    await app.init()
    prisma = app.get(PrismaService)
    auth = app.get(AuthService)
    await prisma.organization.create({ data: { id: orgId, name: 'Security regression', slug: `security-${orgId}` } })
    await prisma.user.create({ data: { id: userId, orgId, email: `${userId}@test.invalid`, role: 'ADMIN', active: true,
      person: { create: { id: personId, orgId, name: 'Security test admin', role: 'ADMIN', active: true } },
    } })
  })
  beforeEach(async () => {
    const user = await prisma.user.update({ where: { id: userId }, data: { active: true, role: 'ADMIN', sessionVersion: { increment: 1 } }, include: { person: true } })
    token = auth.createSessionPayload(user).token
  })
  afterAll(async () => {
    await prisma?.person.deleteMany({ where: { orgId } })
    await prisma?.user.deleteMany({ where: { orgId } })
    await prisma?.organization.deleteMany({ where: { id: orgId } })
    await app?.close()
  })
  const me = () => request(app.getHttpServer()).get('/security-identity').auth(token, { type: 'bearer' })

  it('rejects email-only Google impersonation over the real authentication module', async () => {
    await request(app.getHttpServer()).post('/auth/google/bff-login').send({ email: `${userId}@test.invalid` }).expect(400)
  })
  it('revokes access immediately after a persisted account is disabled', async () => {
    await me().expect(200)
    await prisma.user.update({ where: { id: userId }, data: { active: false } })
    await me().expect(401)
    await prisma.user.update({ where: { id: userId }, data: { active: true } })
    await me().expect(401)
  })
  it('rejects an old ADMIN session after demotion and denies STAFF a manager operation', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'STAFF' } })
    await me().expect(401)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { person: true } })
    const staffToken = auth.createSessionPayload(user).token
    await request(app.getHttpServer()).get('/security-identity').auth(staffToken, { type: 'bearer' }).expect(403)
  })
  it('password reset invalidates an existing JWT and the reset token cannot be reused', async () => {
    await prisma.user.update({ where: { id: userId }, data: {
      resetToken: createHash('sha256').update('security-reset-token').digest('hex'),
      resetTokenExpiresAt: new Date(Date.now() + 3600000),
    } })
    await request(app.getHttpServer()).post('/auth/reset-password').send({ token: 'security-reset-token', password: 'updated-local-test-password' }).expect(201)
    await me().expect(401)
    await request(app.getHttpServer()).post('/auth/reset-password').send({ token: 'security-reset-token', password: 'another-local-test-password' }).expect(401)
  })
  it('rejects an otherwise valid legacy JWT without a session version', async () => {
    token = app.get(JwtService).sign({ sub: userId, orgId, personId, role: 'ADMIN' })
    await me().expect(401)
  })
})
