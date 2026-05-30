import { BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TimelineService } from '../timeline/timeline.service'
import { PeopleService } from './people.service'

const updatedAt = new Date('2026-05-30T12:00:00.000Z')
const mockPrisma = {
  person: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
}
const service = new PeopleService(
  mockPrisma as unknown as PrismaService,
  {} as AuditService,
  {} as TimelineService,
)

describe('PeopleService planned workload capacity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.person.findFirst.mockResolvedValue({ id: 'person-1', orgId: 'org-trusted', updatedAt, active: true, dailyServiceOrderCapacity: 7, dailyAppointmentCapacity: 4, workloadNotes: 'Externo' })
    mockPrisma.person.updateMany.mockResolvedValue({ count: 1 })
  })

  it('salva capacidade no update tenant-scoped', async () => {
    await service.updatePerson('person-1', 'org-trusted', {
      expectedUpdatedAt: updatedAt.toISOString(),
      dailyServiceOrderCapacity: 7,
      dailyAppointmentCapacity: 4,
      workloadNotes: 'Externo',
    })
    expect(mockPrisma.person.updateMany).toHaveBeenCalledWith({
      where: { id: 'person-1', orgId: 'org-trusted', updatedAt },
      data: expect.objectContaining({ dailyServiceOrderCapacity: 7, dailyAppointmentCapacity: 4, workloadNotes: 'Externo' }),
    })
  })

  it.each([-1, 0, 101])('rejeita capacidade fora do limite operacional: %s', async (dailyServiceOrderCapacity) => {
    await expect(service.updatePerson('person-1', 'org-trusted', { expectedUpdatedAt: updatedAt.toISOString(), dailyServiceOrderCapacity }))
      .rejects.toBeInstanceOf(BadRequestException)
    expect(mockPrisma.person.updateMany).not.toHaveBeenCalled()
  })

  it('mantém orgId autenticado na listagem', async () => {
    mockPrisma.person.findMany.mockResolvedValue([{ id: 'person-1', dailyServiceOrderCapacity: 7, dailyAppointmentCapacity: 4 }])
    await expect(service.listActiveByOrg('org-trusted')).resolves.toEqual([{ id: 'person-1', dailyServiceOrderCapacity: 7, dailyAppointmentCapacity: 4 }])
    expect(mockPrisma.person.findMany).toHaveBeenCalledWith({ where: { active: true, orgId: 'org-trusted' } })
  })
})
