import { Test, TestingModule } from '@nestjs/testing'
import { DashboardService } from './dashboard.service'
import { PrismaService } from '../prisma/prisma.service'
import { MemoryCacheService } from '../common/cache/memory-cache.service'
import { GovernanceReadService } from '../governance/governance-read.service'

const mockGovernanceReadService = {
  getAutoScore: jest.fn().mockResolvedValue({ score: 0, level: 'LOW' }),
}

const mockPrisma = {
  customer: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  serviceOrder: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  payment: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  charge: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  appointment: {
    findMany: jest.fn(),
  },
  correctiveAction: {
    count: jest.fn(),
  },
  whatsAppMessage: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  whatsAppConversation: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
}

describe('DashboardService', () => {
  let service: DashboardService
  let cache: MemoryCacheService
  let module: TestingModule

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        DashboardService,
        MemoryCacheService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GovernanceReadService, useValue: mockGovernanceReadService },
      ],
    }).compile()

    service = module.get<DashboardService>(DashboardService)
    cache = module.get<MemoryCacheService>(MemoryCacheService)
    jest.clearAllMocks()
    cache.clear()
    mockPrisma.customer.count.mockResolvedValue(0)
    mockPrisma.customer.findMany.mockResolvedValue([])
    mockPrisma.serviceOrder.count.mockResolvedValue(0)
    mockPrisma.serviceOrder.findMany.mockResolvedValue([])
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    mockPrisma.payment.count.mockResolvedValue(0)
    mockPrisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    mockPrisma.charge.count.mockResolvedValue(0)
    mockPrisma.charge.findMany.mockResolvedValue([])
    mockPrisma.appointment.findMany.mockResolvedValue([])
    mockPrisma.correctiveAction.count.mockResolvedValue(0)
    mockPrisma.whatsAppMessage.count.mockResolvedValue(0)
    mockPrisma.whatsAppMessage.findMany.mockResolvedValue([])
    mockPrisma.whatsAppConversation.count.mockResolvedValue(0)
    mockPrisma.whatsAppConversation.findMany.mockResolvedValue([])
  })

  afterEach(async () => {
    if (module) {
      await module.close()
    }
  })

  describe('getMetrics', () => {
    it('deve retornar métricas do dashboard', async () => {
      mockPrisma.customer.count.mockResolvedValue(10)
      mockPrisma.serviceOrder.count.mockResolvedValue(5)
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 100000 } })
      mockPrisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 50000 } })
      mockPrisma.correctiveAction.count.mockResolvedValue(2)
      mockPrisma.whatsAppMessage.count.mockResolvedValue(0)
      mockPrisma.whatsAppConversation.count.mockResolvedValue(0)
      mockPrisma.charge.count.mockResolvedValue(0)

      const result = await service.getMetrics('org-1')

      expect(result).toHaveProperty('totalCustomers')
      expect(result).toHaveProperty('openServiceOrders')
      expect(result).toHaveProperty('weeklyRevenueInCents')
      expect(result).toHaveProperty('pendingPaymentsInCents')
    })

    it('deve contar pagamentos reais do período somente para o tenant autenticado', async () => {
      mockPrisma.payment.count.mockResolvedValue(4)

      const result = await service.getMetrics('org-1')

      expect(result.paymentsReceivedCount).toBe(4)
      expect(mockPrisma.payment.count).toHaveBeenCalledWith({
        where: { orgId: 'org-1', paidAt: expect.any(Object) },
      })
      expect(mockPrisma.payment.count).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-2' }) }),
      )
    })

    it('deve contar conversas reais aguardando resposta da operação', async () => {
      mockPrisma.whatsAppConversation.count.mockResolvedValue(3)

      const result = await service.getMetrics('org-1')

      expect(result.whatsappSignals.customersNoResponse).toBe(3)
      expect(mockPrisma.whatsAppConversation.count).toHaveBeenCalledWith({
        where: { orgId: 'org-1', status: 'WAITING_OPERATOR' },
      })
    })

    it('deve calcular comparação real contra a janela equivalente da semana anterior', async () => {
      mockPrisma.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 15000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 10000 } })
      mockPrisma.serviceOrder.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(4)
      mockPrisma.charge.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(6)
      mockPrisma.whatsAppMessage.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)

      const result = await service.getMetrics('org-1')

      expect(result.comparison).toEqual({
        revenueReceivedPct: 50,
        completedServiceOrdersPct: 50,
        overdueChargesPct: -50,
        failedMessagesPct: 100,
      })
    })

    it('deve retornar null na comparação quando o período anterior não tem base', async () => {
      const result = await service.getMetrics('org-1')

      expect(result.comparison).toEqual({
        revenueReceivedPct: null,
        completedServiceOrdersPct: null,
        overdueChargesPct: null,
        failedMessagesPct: null,
      })
    })

    it('deve usar cache na segunda chamada', async () => {
      mockPrisma.customer.count.mockResolvedValue(5)
      mockPrisma.serviceOrder.count.mockResolvedValue(3)
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
      mockPrisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
      mockPrisma.correctiveAction.count.mockResolvedValue(0)
      mockPrisma.whatsAppMessage.count.mockResolvedValue(0)
      mockPrisma.whatsAppConversation.count.mockResolvedValue(0)
      mockPrisma.charge.count.mockResolvedValue(0)

      await service.getMetrics('org-1')
      const customerCountCallsAfterFirstRequest =
        mockPrisma.customer.count.mock.calls.length
      await service.getMetrics('org-1')

      // fetchMetrics faz duas consultas em customer.count (ativos + total).
      // A segunda execução deve vir do cache e não repetir consultas.
      expect(mockPrisma.customer.count).toHaveBeenCalledTimes(2)
    })
  })

  describe('getAlerts', () => {
    it('deve retornar alertas operacionais', async () => {
      mockPrisma.serviceOrder.findMany.mockResolvedValue([])
      mockPrisma.charge.findMany.mockResolvedValue([])
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.customer.findMany.mockResolvedValue([])

      const result = await service.getAlerts('org-1')

      expect(result).toHaveProperty('overdueOrders')
      expect(result).toHaveProperty('overdueCharges')
      expect(result).toHaveProperty('todayServices')
      expect(result).toHaveProperty('customersWithPending')
      expect(result).toHaveProperty('operationalQueue')
    })

    it('deve expor fila transversal leve com itens reais, prioridade explícita e tenant isolado', async () => {
      const startsAt = new Date('2026-05-31T10:00:00Z')
      const lastMessageAt = new Date('2026-05-30T08:00:00Z')
      mockPrisma.serviceOrder.findMany
        .mockResolvedValueOnce([{ id: 'so-1', title: 'O.S. atrasada', customer: { id: 'c1', name: 'Cliente 1' } }])
        .mockResolvedValueOnce([])
      mockPrisma.charge.findMany.mockResolvedValue([{ id: 'ch-1', amountCents: 2500, customer: { id: 'c1', name: 'Cliente 1' } }])
      mockPrisma.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'ap-1', startsAt, notes: null, customer: { id: 'c1', name: 'Cliente 1' } }])
      mockPrisma.whatsAppMessage.findMany.mockResolvedValue([{ id: 'msg-1', errorMessage: 'Provider indisponível', customer: { id: 'c1', name: 'Cliente 1' } }])
      mockPrisma.whatsAppConversation.findMany.mockResolvedValue([{ id: 'conv-1', title: null, phone: '5511999999999', lastMessageAt, customer: { id: 'c1', name: 'Cliente 1' } }])

      const result = await service.getAlerts('org-1')

      expect(result.operationalQueue).toHaveLength(5)
      expect(result.operationalQueue.map((item) => item.type)).toEqual([
        'OVERDUE_SERVICE_ORDER',
        'OVERDUE_CHARGE',
        'FAILED_MESSAGE',
        'CUSTOMER_AWAITING_RESPONSE',
        'UNCONFIRMED_APPOINTMENT',
      ])
      expect(result.operationalQueue[3]).toEqual(expect.objectContaining({
        customerId: 'c1', conversationId: 'conv-1', lastMessageAt,
      }))
      expect(result.operationalQueue[4]).toEqual(expect.objectContaining({
        appointmentId: 'ap-1', customerId: 'c1', startsAt,
      }))
      expect(mockPrisma.whatsAppMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1', status: 'FAILED' } }),
      )
      expect(mockPrisma.whatsAppConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1', status: 'WAITING_OPERATOR' } }),
      )
    })

    it('deve buscar somente agendamentos SCHEDULED nas próximas 48 horas e ordená-los por início', async () => {
      const before = Date.now()

      await service.getAlerts('org-1')

      const after = Date.now()
      const futureAppointmentsQuery = mockPrisma.appointment.findMany.mock.calls[1][0]
      expect(futureAppointmentsQuery).toEqual(expect.objectContaining({
        where: {
          orgId: 'org-1',
          status: 'SCHEDULED',
          startsAt: { gte: expect.any(Date), lte: expect.any(Date) },
        },
        orderBy: { startsAt: 'asc' },
        take: 6,
      }))
      expect(futureAppointmentsQuery.where.startsAt.gte.getTime()).toBeGreaterThanOrEqual(before)
      expect(futureAppointmentsQuery.where.startsAt.gte.getTime()).toBeLessThanOrEqual(after)
      expect(futureAppointmentsQuery.where.startsAt.lte.getTime() - futureAppointmentsQuery.where.startsAt.gte.getTime()).toBe(48 * 60 * 60 * 1000)
      expect(futureAppointmentsQuery.where.status).not.toBe('CANCELED')
      expect(futureAppointmentsQuery.where.status).not.toBe('DONE')
    })

    it('não fabrica cliente ou conversa aguardando resposta quando não há conversa real individualizada', async () => {
      mockPrisma.whatsAppConversation.count.mockResolvedValue(3)
      mockPrisma.whatsAppConversation.findMany.mockResolvedValue([])

      const result = await service.getAlerts('org-1')

      expect(result.operationalQueue).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'CUSTOMER_AWAITING_RESPONSE' }),
      ]))
    })

    it('mantém a fila final limitada a seis itens respeitando prioridade entre categorias', async () => {
      mockPrisma.serviceOrder.findMany
        .mockResolvedValueOnce([
          { id: 'so-1', title: 'O.S. 1', customer: { id: 'c1', name: 'Cliente 1' } },
          { id: 'so-2', title: 'O.S. 2', customer: { id: 'c2', name: 'Cliente 2' } },
        ])
        .mockResolvedValueOnce([])
      mockPrisma.charge.findMany.mockResolvedValue([
        { id: 'ch-1', amountCents: 100, customer: { id: 'c1', name: 'Cliente 1' } },
        { id: 'ch-2', amountCents: 200, customer: { id: 'c2', name: 'Cliente 2' } },
      ])
      mockPrisma.whatsAppMessage.findMany.mockResolvedValue([
        { id: 'msg-1', customer: null },
        { id: 'msg-2', customer: null },
      ])
      mockPrisma.whatsAppConversation.findMany.mockResolvedValue([
        { id: 'conv-1', title: null, phone: '5511000000001', customer: null },
      ])
      mockPrisma.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'ap-1', notes: null, customer: { id: 'c1', name: 'Cliente 1' } }])

      const result = await service.getAlerts('org-1')

      expect(result.operationalQueue).toHaveLength(6)
      expect(result.operationalQueue.map((item) => item.type)).toEqual([
        'OVERDUE_SERVICE_ORDER',
        'OVERDUE_SERVICE_ORDER',
        'OVERDUE_CHARGE',
        'OVERDUE_CHARGE',
        'FAILED_MESSAGE',
        'FAILED_MESSAGE',
      ])
    })

    it('deve retornar contagem correta de ordens atrasadas', async () => {
      const overdueOrders = [
        { id: '1', title: 'OS Atrasada', scheduledFor: new Date('2024-01-01'), status: 'OPEN', createdAt: new Date('2024-01-01'), finishedAt: null, customer: { id: 'c1', name: 'Cliente 1' } },
      ]
      mockPrisma.serviceOrder.findMany.mockResolvedValue(overdueOrders)
      mockPrisma.charge.findMany.mockResolvedValue([])
      mockPrisma.appointment.findMany.mockResolvedValue([])
      mockPrisma.customer.findMany.mockResolvedValue([])

      const result = await service.getAlerts('org-1')

      expect(result.overdueOrders.count).toBe(1)
      expect(result.overdueOrders.items).toHaveLength(1)
    })
  })

  describe('invalidateCache', () => {
    it('deve limpar o cache do dashboard para a org', () => {
      // cache é a instância injetada no service (mesma referência)
      cache.set('dashboard:metrics:org-1', { test: true }, 60000)
      cache.set('dashboard:alerts:org-1', { test: true }, 60000)

      // Verificar que o cache foi preenchido
      expect(cache.get('dashboard:metrics:org-1')).not.toBeNull()

      service.invalidateCache('org-1')

      // Após invalidação, as chaves devem sumir
      expect(cache.get('dashboard:metrics:org-1')).toBeNull()
      expect(cache.get('dashboard:alerts:org-1')).toBeNull()
    })
  })
})
