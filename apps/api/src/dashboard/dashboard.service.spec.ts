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

      const result = await service.getMetrics('org-1')

      expect(result).toHaveProperty('totalCustomers')
      expect(result).toHaveProperty('openServiceOrders')
      expect(result).toHaveProperty('weeklyRevenueInCents')
      expect(result).toHaveProperty('pendingPaymentsInCents')
    })

    it('deve usar cache na segunda chamada', async () => {
      mockPrisma.customer.count.mockResolvedValue(5)
      mockPrisma.serviceOrder.count.mockResolvedValue(3)
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
      mockPrisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
      mockPrisma.correctiveAction.count.mockResolvedValue(0)

      await service.getMetrics('org-1')
      await service.getMetrics('org-1')

      // Prisma deve ser chamado apenas uma vez (segunda chamada usa cache)
      expect(mockPrisma.customer.count).toHaveBeenCalledTimes(1)
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
