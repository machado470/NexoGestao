import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { WhatsAppController } from '../../src/whatsapp/whatsapp.controller'
import { WhatsAppService } from '../../src/whatsapp/whatsapp.service'
import { QuotasService } from '../../src/quotas/quotas.service'
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service'
import { JwtAuthGuard } from '../../src/auth/jwt-auth.guard'
import { RolesGuard } from '../../src/auth/guards/roles.guard'

describe('WhatsAppController integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppService, useValue: { health: jest.fn(), listConversations: jest.fn().mockResolvedValue([]) } },
        { provide: QuotasService, useValue: {} },
        { provide: IdempotencyService, useValue: {} },
      ],
    })
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    moduleBuilder.overrideGuard(RolesGuard).useValue({ canActivate: () => true })
    const moduleRef = await moduleBuilder.compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /whatsapp/conversations returns successful payload', async () => {
    await request(app.getHttpServer())
      .get('/whatsapp/conversations')
      .expect(200)
  })
})
