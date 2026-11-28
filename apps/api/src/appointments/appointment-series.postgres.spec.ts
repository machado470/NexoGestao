import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { OutboxService } from '../outbox/outbox.service'
import { AppointmentsService } from './appointments.service'

const url = 'postgresql://nexo@127.0.0.1:55439/postgres'
const describePostgres = process.env.APPOINTMENT_SERIES_TEST_DATABASE_URL === url ? describe : describe.skip

describePostgres('appointment series with isolated PostgreSQL', () => {
  const db = new PrismaClient({ datasources: { db: { url } } })
  const orgId = randomUUID()
  const outbox = new OutboxService({} as any)
  const service = new AppointmentsService(db as PrismaService, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, outbox)

  beforeAll(async () => {
    await db.organization.create({ data: { id: orgId, name: 'Agenda de teste', slug: orgId } })
  })

  afterAll(async () => {
    try {
      const where = { orgId }
      await db.operationalOutboxEvent.deleteMany({ where })
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
    const createdEvents = await db.operationalOutboxEvent.findMany({ where: { orgId, eventType: 'APPOINTMENT_CREATED' } })
    expect(createdEvents).toHaveLength(3)
    expect(new Set(createdEvents.map(event => event.aggregateId)).size).toBe(3)
    expect(createdEvents.every(event => event.status === 'PENDING')).toBe(true)
    const accepted = winner ? other : input
    const rejectQuota = jest.fn().mockRejectedValue(new Error('Sem cota'))
    await expect(service.createSeries(orgId, actor, accepted, rejectQuota))
      .resolves.toEqual((outcomes[winner] as PromiseFulfilledResult<unknown>).value)
    expect(rejectQuota).not.toHaveBeenCalled()
    expect(await db.operationalOutboxEvent.count({ where: { orgId, eventType: 'APPOINTMENT_CREATED' } })).toBe(3)
    await expect(service.createSeries(orgId, actor, { ...accepted, count: 4 }, quota))
      .rejects.toMatchObject({ status: 409 })
  })
  it('moves this and following visits atomically while keeping canceled and previous visits', async () => {
    const customer = await db.customer.create({ data: { orgId, name: 'Cliente reagendado', phone: '11999999997' } })
    const person = await db.person.create({ data: { orgId, name: 'Responsável da série', role: 'STAFF' } })
    const actor = { userId: null, personId: person.id }
    const series = await service.createSeries(orgId, actor, {
      customerId: customer.id, assignedToPersonId: person.id, cadence: 'WEEKLY',
      startsAt: '2031-03-03T12:00:00Z', count: 4, entryKey: randomUUID(),
    }, async () => {})
    const [earlier, selected, canceled, last] = series.visitIds
    await db.appointment.update({ where: { id: canceled }, data: { status: 'CANCELED' } })
    const anchor = await db.appointment.findUniqueOrThrow({ where: { id: selected } })
    const replacement = {
      // This puts the first moved visit on the old slot of the next week.
      startsAt: '2031-03-17T12:00:00Z', endsAt: '2031-03-17T13:00:00Z',
      expectedUpdatedAt: anchor.updatedAt.toISOString(),
    }
    const conflict = await db.appointment.create({
      data: {
        orgId, customerId: customer.id, assignedToPersonId: person.id,
        startsAt: new Date('2031-03-31T12:15:00Z'), endsAt: new Date('2031-03-31T13:00:00Z'),
      },
    })
    await expect(service.rescheduleSeries(orgId, selected, actor, replacement)).rejects.toMatchObject({ status: 409 })
    expect(await db.appointment.findUnique({ where: { id: selected } })).toMatchObject({
      startsAt: anchor.startsAt, updatedAt: anchor.updatedAt, assignedToPersonId: person.id,
    })
    await db.appointment.delete({ where: { id: conflict.id } })
    await expect(service.rescheduleSeries(orgId, selected, actor, replacement))
      .resolves.toEqual({ seriesId: series.seriesId, visitIds: [selected, last] })
    const updatedEvents = await db.operationalOutboxEvent.findMany({ where: { orgId, eventType: 'APPOINTMENT_UPDATED' } })
    expect(updatedEvents.map(event => event.aggregateId).sort()).toEqual([selected, last].sort())
    const rows = await db.appointment.findMany({
      where: { orgId, seriesId: series.seriesId }, orderBy: { seriesPosition: 'asc' },
    })
    expect(rows.map(row => [row.id, row.status, row.startsAt.toISOString(), row.assignedToPersonId])).toEqual([
      [earlier, 'SCHEDULED', '2031-03-03T12:00:00.000Z', person.id],
      [selected, 'SCHEDULED', '2031-03-17T12:00:00.000Z', person.id],
      [canceled, 'CANCELED', '2031-03-17T12:00:00.000Z', person.id],
      [last, 'SCHEDULED', '2031-03-31T12:00:00.000Z', person.id],
    ])
    await expect(service.rescheduleSeries(orgId, selected, actor, replacement)).rejects.toMatchObject({ status: 409 })
    await expect(service.rescheduleSeries(randomUUID(), selected, actor, replacement)).rejects.toMatchObject({ status: 404 })
    const current = rows[1]
    const concurrentStartsAt = new Date('2031-03-17T15:00:00Z')
    const racingDb = db.$extends({
      query: { appointment: {
        async findMany({ args, query }) {
          await db.appointment.update({
            where: { id: selected },
            data: { startsAt: concurrentStartsAt, endsAt: new Date('2031-03-17T16:00:00Z') },
          })
          return query(args)
        },
      } },
    })
    const racingService = new AppointmentsService(racingDb as unknown as PrismaService, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, outbox)
    await expect(racingService.rescheduleSeries(orgId, selected, actor, {
      ...replacement, expectedUpdatedAt: current.updatedAt.toISOString(),
    })).rejects.toMatchObject({ status: 409 })
    expect(await db.appointment.findUnique({ where: { id: selected } }))
      .toMatchObject({ startsAt: concurrentStartsAt })
  })

  it('cancels the selected and following open visits once, with audit and outbox events', async () => {
    const customer = await db.customer.create({ data: { orgId, name: 'Cliente cancelamento', phone: '11988887777' } })
    const actor = { userId: null, personId: null }
    const series = await service.createSeries(orgId, actor, {
      customerId: customer.id, cadence: 'WEEKLY', startsAt: '2031-05-05T12:00:00Z',
      count: 4, entryKey: randomUUID(),
    }, async () => {})
    const [earlier, selected, completed, last] = series.visitIds
    await db.appointment.update({ where: { id: completed }, data: { status: 'DONE' } })
    const anchor = await db.appointment.findUniqueOrThrow({ where: { id: selected } })
    const version = anchor.updatedAt.toISOString()

    await expect(service.cancelSeries(randomUUID(), selected, actor, version)).rejects.toMatchObject({ status: 404 })
    const results = await Promise.allSettled([
      service.cancelSeries(orgId, selected, actor, version),
      service.cancelSeries(orgId, selected, actor, version),
    ])
    expect(results).toEqual(expect.arrayContaining([
      { status: 'fulfilled', value: { seriesId: series.seriesId, visitIds: [selected, last] } },
      { status: 'rejected', reason: expect.objectContaining({ status: 409 }) },
    ]))
    const visits = await db.appointment.findMany({ where: { orgId, seriesId: series.seriesId }, orderBy: { seriesPosition: 'asc' } })
    expect(visits.map(visit => [visit.id, visit.status])).toEqual([
      [earlier, 'SCHEDULED'], [selected, 'CANCELED'], [completed, 'DONE'], [last, 'CANCELED'],
    ])
    expect(await db.timelineEvent.count({ where: { orgId, action: 'APPOINTMENT_CANCELLED', appointmentId: { in: series.visitIds } } })).toBe(2)
    expect(await db.operationalOutboxEvent.count({ where: { orgId, eventType: 'APPOINTMENT_CANCELLED', aggregateId: { in: series.visitIds } } })).toBe(2)
    expect(await db.auditEvent.count({ where: { orgId, entityId: series.seriesId, context: 'Próximas visitas canceladas' } })).toBe(1)
  })

})
