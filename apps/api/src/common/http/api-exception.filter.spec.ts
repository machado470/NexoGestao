import {
  ConflictException,
  Controller,
  Body,
  ExecutionContext,
  ForbiddenException,
  Get,
  NotFoundException,
  HttpException,
  INestApplication,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { Throttle, ThrottlerModule } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import { IsEmail } from 'class-validator'
import { ValidationPipe } from '@nestjs/common'
import request from 'supertest'
import { ApiExceptionFilter, INTERNAL_ERROR_MESSAGE } from './api-exception.filter'
import { DEFAULT_THROTTLER, MINUTE_MS, NexoThrottlerGuard, SensitiveThrottle, THROTTLERS } from '../throttling/throttling'
import { NexoThrottlerStorage } from '../throttling/redis-throttler.storage'
import { PaymentsController } from '../../payments/payments.controller'
import { PaymentsService } from '../../payments/payments.service'
import { ManualPaymentsService } from '../../finance/manual-payments.service'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtAuthGuard as LegacyJwtAuthGuard } from '../../auth/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { OperationalStateGuard } from '../../people/operational-state.guard'

// C7.2a: the response contract for 429/503 (stable code + Retry-After) and the guarantee that
// unexpected errors never leak internal text. Before, every `code` was dropped and raw
// Error messages (e.g. Prisma) were returned to the client.
const SECRET = 'c7-2a-filter-secret'
const jwt = new JwtService({ secret: SECRET })

class EmailDto { @IsEmail() email!: string }

@Controller('probe')
class ProbeController {
  @Get('forbidden') forbidden() { throw new ForbiddenException('Acesso negado. Apenas administradores podem realizar esta ação.') }
  @Get('missing') missing() { throw new NotFoundException('Charge não encontrada') }
  @Post('validate') validate(@Body() _body: EmailDto) { return { ok: true } }
  @Post('limited') @Throttle({ [DEFAULT_THROTTLER]: { limit: 1, ttl: MINUTE_MS } }) limited() { return { ok: true } }
  @Post('sensitive') @SensitiveThrottle() sensitive() { return { ok: true } }
  @Get('email-down') emailDown() { throw new ServiceUnavailableException('Serviço de e-mail indisponível no momento. Tente novamente mais tarde.') }
  @Get('coded-conflict') conflict() { throw new ConflictException({ message: 'Cobrança alterada por outra ação', code: 'CHARGE_CONCURRENT_MODIFICATION' }) }
  @Get('not-verified') notVerified() { throw new UnauthorizedException({ message: 'E-mail ainda não verificado.', code: 'EMAIL_NOT_VERIFIED', email: 'a@b.test' }) }
  @Get('invalid-login') invalidLogin() { throw new UnauthorizedException('Senha inválida') }
  @Get('unsafe-code') unsafeCode() { throw new HttpException({ message: 'x', code: 'drop table users; <script>' }, 429) }
  @Get('lower-code') lowerCode() { throw new HttpException({ message: 'x', code: 'not_upper' }, 400) }
  @Get('crash') crash() { throw new Error('PrismaClientKnownRequestError: relation "users" password=hunter2 at db.internal:5432') }
  @Get('throw-string') throwString() { throw 'raw string with secret=abc' }
}

class FailingRedis {
  status = 'ready'
  defineCommand() {}
  on() { return this }
  once() { return this }
  removeListener() { return this }
  async connect() {}
  async quit() { return 'OK' }
  disconnect() {}
  async nexoThrottleHit() { throw new Error('ECONNREFUSED') }
}

describe('C7.2a: ApiExceptionFilter contract over HTTP', () => {
  let app: INestApplication
  const manualPayments = { pay: jest.fn().mockResolvedValue({ id: 'payment-1' }) }
  const previousSecret = process.env.JWT_SECRET
  const http = () => request(app.getHttpServer())

  const start = async (storage?: NexoThrottlerStorage) => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(storage ? { throttlers: THROTTLERS, storage } : THROTTLERS)],
      controllers: [ProbeController, PaymentsController],
      providers: [
        { provide: APP_GUARD, useClass: NexoThrottlerGuard },
        { provide: PaymentsService, useValue: {} },
        { provide: ManualPaymentsService, useValue: manualPayments },
        { provide: PrismaService, useValue: { charge: { findFirst: async () => ({ amountCents: 1_000 }) } } },
      ],
    })
      .overrideGuard(LegacyJwtAuthGuard).useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest()
          req.user = jwt.verify(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
          return true
        },
      })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(OperationalStateGuard).useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    app.useGlobalFilters(new ApiExceptionFilter())
    await app.init()
  }

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
  })
  afterAll(() => {
    jest.restoreAllMocks()
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })
  beforeEach(() => manualPayments.pay.mockClear())
  afterEach(async () => app?.close())

  it('429 from the throttler keeps Retry-After and gets the stable code RATE_LIMITED', async () => {
    await start()
    await http().post('/probe/limited').expect(201)
    const res = await http().post('/probe/limited').expect(429)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect(res.body).toMatchObject({ success: false, code: 'RATE_LIMITED', data: null })
  })

  it('503 from the fail-closed throttler keeps Retry-After: 5 and the code RATE_LIMIT_UNAVAILABLE', async () => {
    await start(new NexoThrottlerStorage({ mode: 'redis', client: new FailingRedis() as any, sensitiveFailure: 'closed' }))
    const res = await http().post('/probe/sensitive').expect(503)
    expect(res.headers['retry-after']).toBe('5')
    expect(res.body).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE', message: expect.stringContaining('temporariamente indisponível') })
  })

  it('503 without Retry-After gets SERVICE_UNAVAILABLE and no header', async () => {
    await start()
    const res = await http().get('/probe/email-down').expect(503)
    expect(res.headers['retry-after']).toBeUndefined()
    expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'Serviço de e-mail indisponível no momento. Tente novamente mais tarde.' })
  })

  it('keeps existing domain codes and messages (409, 401)', async () => {
    await start()
    expect((await http().get('/probe/coded-conflict').expect(409)).body)
      .toMatchObject({ code: 'CHARGE_CONCURRENT_MODIFICATION', message: 'Cobrança alterada por outra ação' })
    const notVerified = (await http().get('/probe/not-verified').expect(401)).body
    expect(notVerified).toMatchObject({ code: 'EMAIL_NOT_VERIFIED', message: 'E-mail ainda não verificado.' })
    expect(notVerified).not.toHaveProperty('email')
    expect((await http().get('/probe/invalid-login').expect(401)).body).toMatchObject({ code: null, message: 'Senha inválida' })
  })

  it('keeps permission (403), not found (404) and validation (400) status and messages', async () => {
    await start()
    expect((await http().get('/probe/forbidden').expect(403)).body)
      .toMatchObject({ code: null, message: 'Acesso negado. Apenas administradores podem realizar esta ação.' })
    expect((await http().get('/probe/missing').expect(404)).body).toMatchObject({ code: null, message: 'Charge não encontrada' })
    const invalid = (await http().post('/probe/validate').send({ email: 'not-an-email', extra: 1 }).expect(400)).body
    expect(invalid.code).toBeNull()
    expect(invalid.message).toMatch(/email/)
  })

  it('drops codes that are not uppercase identifiers', async () => {
    await start()
    expect((await http().get('/probe/unsafe-code').expect(429)).body.code).toBe('RATE_LIMITED')
    expect((await http().get('/probe/lower-code').expect(400)).body.code).toBeNull()
  })

  it.each(['/probe/crash', '/probe/throw-string'])('never returns the text of unexpected errors (%s)', async (path) => {
    await start()
    const res = await http().get(path).expect(500)
    expect(res.body).toMatchObject({ message: INTERNAL_ERROR_MESSAGE, error: INTERNAL_ERROR_MESSAGE, code: 'INTERNAL_ERROR' })
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|db\.internal|Prisma|secret=abc|stack/)
  })

  describe('payments', () => {
    const bearer = () => `Bearer ${jwt.sign({ sub: 'user-a', orgId: 'org-a', role: 'ADMIN' })}`
    const pay = (key: string) => http().post('/payments/charges/charge-1/pay').set('Authorization', bearer()).set('Idempotency-Key', key).send({ method: 'PIX' })

    it('the 8/min limit is unchanged and its 429 carries Retry-After + RATE_LIMITED', async () => {
      await start()
      for (let i = 0; i < 8; i++) await pay(`key-${i}`).expect(201)
      const res = await pay('key-new').expect(429)
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
      expect(res.body.code).toBe('RATE_LIMITED')
      expect(manualPayments.pay).toHaveBeenCalledTimes(8)
      expect(manualPayments.pay.mock.calls.map((call) => call[4])).toEqual(Array.from({ length: 8 }, (_v, i) => `key-${i}`))
    })

    it('with Redis down the payment is refused with 503 + Retry-After and never executed', async () => {
      await start(new NexoThrottlerStorage({ mode: 'redis', client: new FailingRedis() as any, sensitiveFailure: 'closed' }))
      const res = await pay('key-down').expect(503)
      expect(res.headers['retry-after']).toBe('5')
      expect(res.body.code).toBe('RATE_LIMIT_UNAVAILABLE')
      expect(manualPayments.pay).not.toHaveBeenCalled()
    })
  })
})
