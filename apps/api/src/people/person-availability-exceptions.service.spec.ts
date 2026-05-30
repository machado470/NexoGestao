import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PersonAvailabilityExceptionsService } from './person-availability-exceptions.service'

const mockPrisma = {
  person: { findFirst: jest.fn() },
  personAvailabilityException: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
}

describe('PersonAvailabilityExceptionsService', () => {
  const service = new PersonAvailabilityExceptionsService(mockPrisma as unknown as PrismaService)
  beforeEach(() => { jest.clearAllMocks(); mockPrisma.person.findFirst.mockResolvedValue({ id: 'person-1' }) })

  it('cria exceção válida persistindo o tenant confiável', async () => {
    mockPrisma.personAvailabilityException.create.mockResolvedValue({ id: 'exception-1' })
    await service.create('person-1', 'org-trusted', { startsAt: '2026-05-30T12:00:00.000Z', endsAt: '2026-05-30T14:00:00.000Z', reason: 'Consulta' })
    expect(mockPrisma.personAvailabilityException.create).toHaveBeenCalledWith({ data: { orgId: 'org-trusted', personId: 'person-1', startsAt: new Date('2026-05-30T12:00:00.000Z'), endsAt: new Date('2026-05-30T14:00:00.000Z'), reason: 'Consulta' } })
  })

  it('rejeita startsAt maior ou igual a endsAt', async () => {
    await expect(service.create('person-1', 'org-trusted', { startsAt: '2026-05-30T14:00:00.000Z', endsAt: '2026-05-30T14:00:00.000Z' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejeita pessoa de outro tenant', async () => {
    mockPrisma.person.findFirst.mockResolvedValue(null)
    await expect(service.create('person-other-org', 'org-trusted', { startsAt: '2026-05-30T12:00:00.000Z', endsAt: '2026-05-30T14:00:00.000Z' })).rejects.toBeInstanceOf(NotFoundException)
  })

  it('lista somente exceções do tenant e da pessoa', async () => {
    mockPrisma.personAvailabilityException.findMany.mockResolvedValue([])
    await service.list('person-1', 'org-trusted')
    expect(mockPrisma.personAvailabilityException.findMany).toHaveBeenCalledWith({ where: { orgId: 'org-trusted', personId: 'person-1' }, orderBy: { startsAt: 'desc' } })
  })

  it('deleta exceção do próprio tenant', async () => {
    mockPrisma.personAvailabilityException.deleteMany.mockResolvedValue({ count: 1 })
    await expect(service.delete('person-1', 'exception-1', 'org-trusted')).resolves.toEqual({ ok: true, id: 'exception-1' })
    expect(mockPrisma.personAvailabilityException.deleteMany).toHaveBeenCalledWith({ where: { id: 'exception-1', personId: 'person-1', orgId: 'org-trusted' } })
  })

  it('impede deletar exceção de outro tenant', async () => {
    mockPrisma.personAvailabilityException.deleteMany.mockResolvedValue({ count: 0 })
    await expect(service.delete('person-1', 'exception-other-org', 'org-trusted')).rejects.toBeInstanceOf(NotFoundException)
  })
})
