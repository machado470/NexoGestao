import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { OrganizationSettingsController } from './organization-settings.controller'
import { OrganizationSettingsService } from './organization-settings.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('organization settings HTTP validation', () => {
  let app: INestApplication
  const update = jest.fn()
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganizationSettingsController],
      providers: [{ provide: OrganizationSettingsService, useValue: { updateOrganizationSettings: update } }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
        context.switchToHttp().getRequest().user = { orgId: 'authenticated-org' }
        return true
      } })
      .overrideGuard(ActiveUserGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })
  beforeEach(() => { update.mockReset(); update.mockImplementation(async (_org, dto) => dto) })
  afterAll(async () => app?.close())

  it.each([
    { name: '  ' }, { name: null }, { timezone: 'Mars/Olympus' },
    { timezone: '+03:00' }, { timezone: '' }, { timezone: null },
    { currency: null }, { currency: 'GBP' }, { orgId: 'other-org' },
  ])('rejects %j before reaching persistence', async input => {
    await request(app.getHttpServer()).patch('/organization-settings').send(input).expect(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('passes trimmed values and the authenticated tenant to persistence', async () => {
    const response = await request(app.getHttpServer()).patch('/organization-settings')
      .send({ name: '  Oficina  ', timezone: ' UTC ', currency: 'BRL' }).expect(200)
    expect(response.body).toEqual({ name: 'Oficina', timezone: 'UTC', currency: 'BRL' })
    expect(update).toHaveBeenCalledWith('authenticated-org', expect.objectContaining(response.body))
  })

  it('preserves partial updates without inventing missing fields', async () => {
    await request(app.getHttpServer()).patch('/organization-settings').send({ timezone: 'America/Sao_Paulo' }).expect(200)
    const dto = update.mock.calls[0][1]
    expect(dto.timezone).toBe('America/Sao_Paulo')
    expect(dto.name).toBeUndefined()
    expect(dto.currency).toBeUndefined()
  })
})
