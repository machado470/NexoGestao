import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { JwtAuthGuard } from './jwt-auth.guard'
import { RolesGuard } from './roles.guard'
import { FinanceController } from '../../finance/finance.controller'
import { FinanceService } from '../../finance/finance.service'
import { TenantOperationsService } from '../../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService } from '../../common/commercial/commercial-policy.service'
import { OperationalStateGuard } from '../../people/operational-state.guard'
import { ServiceOrdersController } from '../../service-orders/service-orders.controller'
import { ServiceOrdersService } from '../../service-orders/service-orders.service'
import { QuotasService } from '../../quotas/quotas.service'
import { ServiceOrderTenantAccessGuard } from '../../service-orders/service-order-tenant-access.guard'

describe('canonical operational roles over HTTP', () => {
  let app: INestApplication
  const finance = { listCharges: jest.fn().mockResolvedValue({ items: [], meta: {} }), ensureChargeForServiceOrderDone: jest.fn().mockResolvedValue({ id: 'charge' }) }
  const orders = { get: jest.fn().mockResolvedValue({ id: 'order', customerId: 'customer', amountCents: 100, status: 'DONE' }), list: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({ id: 'order' }) }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController, ServiceOrdersController],
      providers: [RolesGuard,
        { provide: FinanceService, useValue: finance }, { provide: ServiceOrdersService, useValue: orders },
        { provide: TenantOperationsService, useValue: {} }, { provide: CommercialPolicyService, useValue: {} }, { provide: QuotasService, useValue: {} },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: context => {
      const req = context.switchToHttp().getRequest()
      req.user = { sub: 'user', userId: 'user', orgId: 'org', role: req.headers['x-test-role'] }
      return true
    } }).overrideGuard(OperationalStateGuard).useValue({ canActivate: () => true })
      .overrideGuard(ServiceOrderTenantAccessGuard).useValue({ canActivate: () => true }).compile()
    app = module.createNestApplication()
    await app.init()
  })
  afterAll(async () => app?.close())
  beforeEach(() => jest.clearAllMocks())
  it.each(['ADMIN', 'MANAGER'])('permits declared financial access and charge generation for %s', async role => {
    await request(app.getHttpServer()).get('/finance/charges').set('x-test-role', role).expect(200)
    await request(app.getHttpServer()).post('/service-orders/order/generate-charge').set('x-test-role', role).expect(200)
    expect(finance.ensureChargeForServiceOrderDone).toHaveBeenCalledTimes(1)
  })
  it.each(['STAFF', 'VIEWER'])('rejects undeclared financial access and charge generation for %s before business logic', async role => {
    await request(app.getHttpServer()).get('/finance/charges').set('x-test-role', role).expect(403)
    await request(app.getHttpServer()).post('/service-orders/order/generate-charge').set('x-test-role', role).expect(403)
    expect(finance.listCharges).not.toHaveBeenCalled()
    expect(finance.ensureChargeForServiceOrderDone).not.toHaveBeenCalled()
  })
  it.each(['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'])('preserves declared service-order reads for %s', async role => {
    await request(app.getHttpServer()).get('/service-orders').set('x-test-role', role).expect(200)
  })
  it('permits STAFF to update an order while VIEWER remains read-only', async () => {
    await request(app.getHttpServer()).patch('/service-orders/order').set('x-test-role', 'STAFF').send({ title: 'Updated' }).expect(200)
    await request(app.getHttpServer()).patch('/service-orders/order').set('x-test-role', 'VIEWER').send({ title: 'Forbidden' }).expect(403)
    expect(orders.update).toHaveBeenCalledTimes(1)
  })
})
