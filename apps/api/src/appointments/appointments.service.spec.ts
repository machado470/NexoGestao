import { BadRequestException } from '@nestjs/common'
import { AppointmentsService } from './appointments.service'

function buildService(prisma: any) {
  return new AppointmentsService(
    prisma,
    { log: jest.fn() } as any,
    { log: jest.fn() } as any,
    { queueMessage: jest.fn() } as any,
    {} as any,
    { executeTrigger: jest.fn() } as any,
    {
      begin: jest.fn().mockResolvedValue({ mode: 'execute', recordId: 'idem-1' }),
      complete: jest.fn(),
      fail: jest.fn(),
    } as any,
  )
}

const baseAppointment = {
  id: 'apt-1',
  orgId: 'org-1',
  customerId: 'c-1',
  assignedToPersonId: 'resp-1',
  startsAt: new Date('2026-05-01T10:00:00Z'),
  endsAt: new Date('2026-05-01T10:30:00Z'),
  status: 'SCHEDULED',
  notes: null,
  updatedAt: new Date('2026-05-01T09:00:00Z'),
  customer: { id: 'c-1', name: 'Cliente', phone: null },
  assignedTo: { id: 'resp-1', name: 'Responsável' },
}

describe('AppointmentsService assignee persistence', () => {
  it('bloqueia create com responsável de outra org', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', name: 'Cliente' }) },
      person: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const service = buildService(prisma)

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

  it('persiste e retorna responsável no create', async () => {
    const prisma: any = {
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', name: 'Cliente' }) },
      person: { findFirst: jest.fn().mockResolvedValue({ id: 'resp-1' }) },
      appointment: { create: jest.fn().mockResolvedValue(baseAppointment) },
    }
    const service = buildService(prisma)

    const created = await service.create({
      orgId: 'org-1',
      createdBy: 'u-1',
      personId: 'p-1',
      customerId: 'c-1',
      assignedToPersonId: 'resp-1',
      startsAt: '2026-05-01T10:00:00Z',
    })

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToPersonId: 'resp-1' }),
        include: expect.objectContaining({ assignedTo: expect.any(Object) }),
      }),
    )
    expect(created.assignedToPersonId).toBe('resp-1')
  })

  it('aplica filtro server-side por responsável mantendo escopo do tenant', async () => {
    const prisma: any = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }
    const service = buildService(prisma)

    await service.list('org-1', { assignedToPersonId: 'resp-1' })

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: 'org-1', assignedToPersonId: 'resp-1' },
        include: expect.objectContaining({ assignedTo: expect.any(Object) }),
      }),
    )
    expect(prisma.appointment.count).toHaveBeenCalledWith({
      where: { orgId: 'org-1', assignedToPersonId: 'resp-1' },
    })
  })

  it('edita responsável e permite removê-lo', async () => {
    const updated = { ...baseAppointment, assignedToPersonId: null, assignedTo: null }
    const prisma: any = {
      appointment: {
        findFirst: jest.fn().mockResolvedValueOnce(baseAppointment).mockResolvedValueOnce(updated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const service = buildService(prisma)

    const result = await service.update({
      orgId: 'org-1',
      updatedBy: 'u-1',
      personId: 'p-1',
      id: 'apt-1',
      data: { assignedToPersonId: null, expectedUpdatedAt: '2026-05-01T09:00:00Z' },
    })

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'apt-1', orgId: 'org-1' }),
        data: { assignedToPersonId: null },
      }),
    )
    expect(result.assignedToPersonId).toBeNull()
  })

  it('bloqueia troca para responsável de outra org', async () => {
    const prisma: any = {
      appointment: { findFirst: jest.fn().mockResolvedValue(baseAppointment) },
      person: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const service = buildService(prisma)

    await expect(
      service.update({
        orgId: 'org-1',
        updatedBy: 'u-1',
        personId: 'p-1',
        id: 'apt-1',
        data: { assignedToPersonId: 'resp-other-org', expectedUpdatedAt: '2026-05-01T09:00:00Z' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
  it('emite APPOINTMENT_CANCELLED ao cancelar agendamento', async () => {
    const updated = { ...baseAppointment, status: 'CANCELED' }
    const timeline = { log: jest.fn() }
    const prisma: any = {
      appointment: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(baseAppointment)
          .mockResolvedValueOnce(updated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', phone: null }) },
    }
    const service = new AppointmentsService(
      prisma,
      timeline as any,
      { log: jest.fn() } as any,
      { queueMessage: jest.fn() } as any,
      {} as any,
      { executeTrigger: jest.fn() } as any,
      {
        begin: jest.fn().mockResolvedValue({ mode: 'execute', recordId: 'idem-1' }),
        complete: jest.fn(),
        fail: jest.fn(),
      } as any,
    )

    await service.update({
      orgId: 'org-1',
      updatedBy: 'u-1',
      personId: 'p-1',
      id: 'apt-1',
      data: { status: 'CANCELED', expectedUpdatedAt: baseAppointment.updatedAt.toISOString() },
    })

    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        action: 'APPOINTMENT_CANCELLED',
        appointmentId: 'apt-1',
        customerId: 'c-1',
      }),
    )
  })

})
