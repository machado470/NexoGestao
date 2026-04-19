import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ExpensesService } from './expenses.service'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'

const mockPrisma = {
  expense: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  payment: {
    aggregate: jest.fn(),
  },
  charge: {
    aggregate: jest.fn(),
  },
}
const mockTimeline = { log: jest.fn() }

describe('ExpensesService', () => {
  let service: ExpensesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TimelineService, useValue: mockTimeline },
      ],
    }).compile()

    service = module.get<ExpensesService>(ExpensesService)
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('deve retornar lista paginada de despesas', async () => {
      const mockExpenses = [
        { id: '1', title: 'Despesa 1', amountCents: 10000, category: 'MARKET', occurredAt: new Date() },
      ]
      mockPrisma.expense.findMany.mockResolvedValue(mockExpenses)
      mockPrisma.expense.count.mockResolvedValue(1)

      const result = await service.list('org-1', { page: '1', limit: '10' } as any)

      expect(result.data).toEqual(mockExpenses)
      expect(result.pagination.total).toBe(1)
      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } })
      )
    })

    it('deve aplicar filtro de categoria', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([])
      mockPrisma.expense.count.mockResolvedValue(0)

      await service.list('org-1', { category: 'MARKET' } as any)

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'MARKET' }),
        })
      )
    })
  })

  describe('create', () => {
    it('deve criar uma despesa com sucesso', async () => {
      const dto = {
        description: 'Nova despesa',
        title: 'Nova despesa',
        amountCents: 5000,
        category: 'MARKET',
        type: 'VARIABLE',
        occurredAt: '2024-01-15',
      }
      const mockCreated = { id: 'new-id', ...dto }
      mockPrisma.expense.create.mockResolvedValue(mockCreated)

      const result = await service.create('org-1', 'user-1', dto as any)

      expect(result).toEqual(mockCreated)
      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            description: dto.description,
            amountCents: dto.amountCents,
          }),
        })
      )
    })
  })

  describe('update', () => {
    it('deve lançar NotFoundException se despesa não encontrada', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(null)

      await expect(
        service.update('org-1', 'non-existent', null, { description: 'Updated' })
      ).rejects.toThrow(NotFoundException)
    })

    it('deve atualizar despesa existente', async () => {
      const existing = { id: 'exp-1', orgId: 'org-1', title: 'Old', amountCents: 1000 }
      const updated = { ...existing, description: 'Updated' }
      mockPrisma.expense.findFirst.mockResolvedValue(existing)
      mockPrisma.expense.update.mockResolvedValue(updated)

      const result = await service.update('org-1', 'exp-1', null, { description: 'Updated' })

      expect(result.description).toBe('Updated')
      expect(mockPrisma.expense.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'exp-1' } })
      )
    })
  })

  describe('delete', () => {
    it('deve lançar NotFoundException se despesa não encontrada', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(null)

      await expect(service.delete('org-1', 'non-existent', null)).rejects.toThrow(NotFoundException)
    })

    it('deve deletar despesa existente', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue({ id: 'exp-1', recurrence: 'NONE', title: 'A' })
      mockPrisma.expense.delete.mockResolvedValue({ id: 'exp-1' })

      const result = await service.delete('org-1', 'exp-1', null)

      expect(result).toEqual({ ok: true })
      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } })
    })
  })
})
