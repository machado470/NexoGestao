import { AppointmentsService } from './appointments.service'

describe('Appointments capacity bounds', () => {
  const db = { appointment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } }
  beforeEach(() => jest.clearAllMocks())
  it('caps oversized HTTP limits', async () => {
    const service = new AppointmentsService(db as any, null!, null!, null!, null!, null!, null!)
    const result = await service.list('org', { limit: 1000000 })
    expect(result.meta.limit).toBe(1000)
    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1000, where: { orgId: 'org' } }))
  })
  it.each([{ page: -1 }, { page: 1.5 }, { page: 10001 }, { limit: 0 }, { limit: Infinity }, { limit: -1 }])('rejects invalid input before querying: %j', async input => {
    const service = new AppointmentsService(db as any, null!, null!, null!, null!, null!, null!)
    await expect(service.list('org', input)).rejects.toMatchObject({ status: 400 })
    expect(db.appointment.findMany).not.toHaveBeenCalled()
  })
})
