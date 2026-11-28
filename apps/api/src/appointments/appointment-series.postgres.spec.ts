import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AppointmentsService } from './appointments.service'

const url = 'postgresql://nexo@127.0.0.1:55439/postgres'
const describePostgres = process.env.APPOINTMENT_SERIES_TEST_DATABASE_URL === url ? describe : describe.skip

describePostgres('appointment series with isolated PostgreSQL', () => {
  const db = new PrismaClient({ datasources: { db: { url } } })
  const orgId = randomUUID()
  const service = new AppointmentsService(db as PrismaService, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)

  beforeAll(async () => {
    await db.organization.create({ data: { id: orgId, name: 'Agenda de teste', slug: orgId } })
  })

  afterAll(async () => {
    try {
      const where = { orgId }
      await db.timelineEvent.deleteMany({ where })
      await db.auditEvent.deleteMany({ where })
      await db.appointment.deleteMany({ where })
      await db.appointmentSeries.deleteMany({ where })
      await db.customer.deleteMany({ where })
      await db.person.deleteMany({ where })
      await db.organization.delete({ where: { id: orgId } })
    } finally {
      await db.$disconnect()
    }
  })

  it('creates one complete series while another concurrent request conflicts and replays the original IDs', async () => {
    const customer = await db.customer.create({ data: { orgId, name: 'Cliente de teste', phone: '11999999999' } })
    const person = await db.person.create({ data: { orgId, name: 'Responsável de teste', role: 'STAFF' } })
    const actor = { userId: null, personId: person.id }
    const input = {
      customerId: customer.id, assignedToPersonId: person.id, cadence: 'WEEKLY' as const,
      startsAt: '2027-03-01T12:00:00Z', count: 3, entryKey: randomUUID(),
    }
    const other = { ...input, entryKey: randomUUID() }
    const quota = jest.fn().mockResolvedValue(undefined)
    const outcomes = await Promise.allSettled([
      service.createSeries(orgId, actor, input, quota),
      service.createSeries(orgId, actor, other, quota),
    ])
    const winner = outcomes.findIndex(result => result.status === 'fulfilled')
    expect(winner).toBeGreaterThanOrEqual(0)
    expect(outcomes[1 - winner]).toMatchObject({ status: 'rejected', reason: { status: 409 } })
    expect(await db.appointmentSeries.count({ where: { orgId } })).toBe(1)
    expect(await db.appointment.count({ where: { orgId } })).toBe(3)
    expect(await db.timelineEvent.count({ where: { orgId } })).toBe(3)
    expect(await db.auditEvent.count({ where: { orgId } })).toBe(1)
    const accepted = winner ? other : input
    const rejectQuota = jest.fn().mockRejectedValue(new Error('Sem cota'))
    await expect(service.createSeries(orgId, actor, accepted, rejectQuota))
      .resolves.toEqual((outcomes[winner] as PromiseFulfilledResult<unknown>).value)
    expect(rejectQuota).not.toHaveBeenCalled()
    await expect(service.createSeries(orgId, actor, { ...accepted, count: 4 }, quota))
      .rejects.toMatchObject({ status: 409 })
  })
})
