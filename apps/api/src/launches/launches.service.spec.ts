import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { LaunchesService } from './launches.service'
import { PrismaService } from '../prisma/prisma.service'
import { LaunchType } from './dto/create-launch.dto'

const mockPrisma = {
  launch: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  },
}

describe('LaunchesService', () => {
  let service: LaunchesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaunchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<LaunchesService>(LaunchesService)
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('deve retornar lista paginada de lançamentos', async () => {
      const mockLaunches = [
        { id: '1', description: 'Receita', amountCents: 10000, type: 'INCOME', date: new Date() },
      ]
      mockPrisma.launch.findMany.mockResolvedValue(mockLaunches)
      mockPrisma.launch.count.mockResolvedValue(1)

      const result = await service.list('org-1', {})

      expect(result.data).toEqual(mockLaunches)
      expect(result.pagination.total).toBe(1)
    })

    it('deve filtrar por tipo', async () => {
      mockPrisma.launch.findMany.mockResolvedValue([])
      mockPrisma.launch.count.mockResolvedValue(0)

      await service.list('org-1', { type: LaunchType.INCOME })

      expect(mockPrisma.launch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: LaunchType.INCOME }),
        })
      )
    })
  })

  describe('summary', () => {
    it('deve calcular balanço corretamente', async () => {
      mockPrisma.launch.groupBy.mockResolvedValue([
        { type: 'INCOME', _sum: { amountCents: 100000 }, _count: { id: 5 } },
        { type: 'EXPENSE', _sum: { amountCents: 40000 }, _count: { id: 3 } },
      ])

      const result = await service.summary('org-1')

      expect(result.income).toBe(100000)
      expect(result.expense).toBe(40000)
      expect(result.balance).toBe(60000)
    })
  })

  describe('create', () => {
    it('deve criar lançamento com sucesso', async () => {
      const dto = {
        description: 'Receita de consultoria',
        amountCents: 15000,
        type: LaunchType.INCOME,
        category: 'Consultoria',
        date: '2024-01-15',
      }
      const mockCreated = { id: 'launch-1', ...dto }
      mockPrisma.launch.create.mockResolvedValue(mockCreated)

      const result = await service.create('org-1', 'user-1', dto)

      expect(result).toEqual(mockCreated)
      expect(mockPrisma.launch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            type: LaunchType.INCOME,
          }),
        })
      )
    })
  })

  describe('delete', () => {
    it('deve lançar NotFoundException se lançamento não encontrado', async () => {
      mockPrisma.launch.findFirst.mockResolvedValue(null)

      await expect(service.delete('org-1', 'non-existent')).rejects.toThrow(NotFoundException)
    })
  })
})
