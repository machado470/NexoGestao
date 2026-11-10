import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'
import { LaunchesController } from '../launches/launches.controller'
import { LaunchesService } from '../launches/launches.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

describe('Expense and launch financial input over HTTP', () => {
  let app: INestApplication
  const expense = { create: jest.fn(), update: jest.fn() }
  const launch = { create: jest.fn(), update: jest.fn() }
  const cases = [
    { path: '/expenses', service: expense, valid: { title: 'Aluguel', amountCents: 100, category: 'HOUSING', type: 'FIXED', occurredAt: '2026-11-01T12:00:00Z' }, text: 'title', date: 'occurredAt' },
    { path: '/launches', service: launch, valid: { description: 'Receita', amountCents: 100, category: 'Serviços', type: 'INCOME', date: '2026-11-01T12:00:00Z' }, text: 'description', date: 'date' },
  ]
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ExpensesController, LaunchesController], providers: [
      RolesGuard, { provide: ExpensesService, useValue: expense }, { provide: LaunchesService, useValue: launch },
    ] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      context.switchToHttp().getRequest().user = { sub: 'actor', orgId: 'org', role: 'ADMIN' }
      return true
    } }).compile()
    app = module.createNestApplication()
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, transformOptions: { enableImplicitConversion: true } }))
    await app.init()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    for (const c of cases) { c.service.create.mockResolvedValue({ id: 'record' }); c.service.update.mockResolvedValue({ id: 'record' }) }
  })
  afterAll(async () => app.close())
  describe.each(cases)('$path', c => {
    it.each([0, -1, 1.5, 2_147_483_648, 'invalid-amount', null])('rejects invalid cents %p for creation and update', async amountCents => {
      await request(app.getHttpServer()).post(c.path).send({ ...c.valid, amountCents }).expect(400)
      await request(app.getHttpServer()).patch(`${c.path}/record`).send({ amountCents }).expect(400)
      expect(c.service.create).not.toHaveBeenCalled(); expect(c.service.update).not.toHaveBeenCalled()
    })
    it.each([1, 2_147_483_647])('accepts integer cents %p and partial updates', async amountCents => {
      await request(app.getHttpServer()).post(c.path).send({ ...c.valid, amountCents }).expect(201)
      await request(app.getHttpServer()).patch(`${c.path}/record`).send({ amountCents }).expect(200)
      expect(c.service.update).toHaveBeenCalledWith('org', 'record', ...(c.path === '/expenses' ? ['actor'] : []), { amountCents })
    })
    it.each(['', '   ', null])('rejects blank or null required text %p', async value => {
      await request(app.getHttpServer()).post(c.path).send({ ...c.valid, [c.text]: value }).expect(400)
      await request(app.getHttpServer()).patch(`${c.path}/record`).send({ [c.text]: value }).expect(400)
      expect(c.service.update).not.toHaveBeenCalled()
    })
    it.each([{ type: 'unknown' }, { type: null }, { orgId: 'other' }, { category: '' }])('validates PATCH metadata %p', async body => {
      await request(app.getHttpServer()).patch(`${c.path}/record`).send(body).expect(400)
      expect(c.service.update).not.toHaveBeenCalled()
    })
    it('rejects invalid or null dates on PATCH', async () => {
      for (const value of ['invalid-date', null]) {
        await request(app.getHttpServer()).patch(`${c.path}/record`).send({ [c.date]: value }).expect(400)
      }
      expect(c.service.update).not.toHaveBeenCalled()
    })
    it('still accepts a notes-only edit', async () => {
      await request(app.getHttpServer()).patch(`${c.path}/record`).send({ notes: 'Observação' }).expect(200)
      expect(c.service.update).toHaveBeenCalledTimes(1)
    })
  })
  it.each([{ recurrence: null }, { isActive: null }, { recurrence: 'unknown' }])('rejects invalid non-null expense fields %p', async body => {
    await request(app.getHttpServer()).post('/expenses').send({ ...cases[0].valid, ...body }).expect(400)
    await request(app.getHttpServer()).patch('/expenses/record').send(body).expect(400)
    expect(expense.create).not.toHaveBeenCalled(); expect(expense.update).not.toHaveBeenCalled()
  })
  it.each([1.5, 0, 32])('rejects invalid expense due day %p', async dueDay => {
    await request(app.getHttpServer()).post('/expenses').send({ ...cases[0].valid, dueDay }).expect(400)
    await request(app.getHttpServer()).patch('/expenses/record').send({ dueDay }).expect(400)
    expect(expense.update).not.toHaveBeenCalled()
  })
})
