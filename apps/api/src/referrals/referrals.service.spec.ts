import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ReferralsService } from './referrals.service'
import { PrismaService } from '../prisma/prisma.service'

const mockPrisma = {
  referral: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
}

describe('ReferralsService', () => {
  let service: ReferralsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<ReferralsService>(ReferralsService)
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('deve criar uma indicação com código único', async () => {
      const dto = {
        referrerName: 'João',
        referrerEmail: 'joao@test.com',
        referredName: 'Maria',
        referredEmail: 'maria@test.com',
      }
      const mockCreated = { id: 'ref-1', ...dto, code: 'ABC12345', status: 'PENDING' }
      mockPrisma.referral.create.mockResolvedValue(mockCreated)

      const result = await service.create('org-1', dto as any)

      expect(result).toEqual(mockCreated)
      expect(mockPrisma.referral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'org-1',
            referrerName: dto.referrerName,
            referredEmail: dto.referredEmail,
            status: 'PENDING',
          }),
        })
      )
    })
  })

  describe('update', () => {
    it('deve lançar NotFoundException se indicação não encontrada', async () => {
      mockPrisma.referral.findFirst.mockResolvedValue(null)

      await expect(
        service.update('org-1', 'non-existent', { status: 'CONFIRMED' as any })
      ).rejects.toThrow(NotFoundException)
    })

    it('deve definir confirmedAt ao confirmar indicação', async () => {
      const existing = { id: 'ref-1', orgId: 'org-1', status: 'PENDING', confirmedAt: null, paidAt: null }
      const updated = { ...existing, status: 'CONFIRMED', confirmedAt: new Date() }
      mockPrisma.referral.findFirst.mockResolvedValue(existing)
      mockPrisma.referral.update.mockResolvedValue(updated)

      await service.update('org-1', 'ref-1', { status: 'CONFIRMED' as any })

      expect(mockPrisma.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CONFIRMED',
            confirmedAt: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('getBalance', () => {
    it('deve retornar saldo de créditos pendentes e pagos', async () => {
      mockPrisma.referral.aggregate
        .mockResolvedValueOnce({ _sum: { creditAmountCents: 20000 } })
        .mockResolvedValueOnce({ _sum: { creditAmountCents: 10000 } })

      const result = await service.getBalance('org-1')

      expect(result).toEqual({
        pendingBalance: 20000,
        paidBalance: 10000,
      })
    })
  })

  describe('generateCode', () => {
    it('deve gerar um código de 8 caracteres', async () => {
      const result = await service.generateCode('org-1')

      expect(result.code).toHaveLength(8)
      expect(result.code).toMatch(/^[A-Z0-9]{8}$/)
    })
  })
})
