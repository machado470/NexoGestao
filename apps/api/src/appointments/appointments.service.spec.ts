import { BadRequestException } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'

describe('AppointmentsService hardening', () => {
  it('bloqueia create com responsible de outra org', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', name: 'Cliente' }) },
      person: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const service = new AppointmentsService(
      prisma,
      { log: jest.fn() } as any,
      { log: jest.fn() } as any,
      { queueMessage: jest.fn() } as any,
      {} as any,
      { executeTrigger: jest.fn() } as any,
      { begin: jest.fn(), complete: jest.fn(), fail: jest.fn() } as any,
    )

    await expect(
      service.create({
        orgId: 'org-1',
        createdBy: 'u-1',
        personId: 'p-1',
        customerId: 'c-1',
        assignedToPersonId: 'resp-2',
        startsAt: '2026-05-01T10:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
