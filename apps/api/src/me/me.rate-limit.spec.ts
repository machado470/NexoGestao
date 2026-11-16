import { Controller, Get, INestApplication } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import request from 'supertest'
import { MeController } from './me.controller'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('limited')
class LimitedController { @Get() get() { return { ok: true } } }

describe('session validation request budget', () => {
  let app: INestApplication
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [MeController, LimitedController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: PrismaService, useValue: {
          user: { findUnique: jest.fn().mockResolvedValue({ id: 'user', orgId: 'org', role: 'ADMIN', active: true }) },
          organization: { findUnique: jest.fn().mockResolvedValue({ name: 'Test', slug: 'test', requiresOnboarding: false }) },
        } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      context.switchToHttp().getRequest().user = { sub: 'user', orgId: 'org' }
      return true
    } }).compile()
    app = module.createNestApplication()
    await app.init()
  })
  afterAll(async () => app?.close())
  it('allows the BFF to validate a session across multiple page queries', async () => {
    for (let index = 0; index < 12; index++) await request(app.getHttpServer()).get('/me').expect(200)
  })
  it('preserves the global request budget for other endpoints', async () => {
    for (let index = 0; index < 10; index++) await request(app.getHttpServer()).get('/limited').expect(200)
    await request(app.getHttpServer()).get('/limited').expect(429)
  })
})
