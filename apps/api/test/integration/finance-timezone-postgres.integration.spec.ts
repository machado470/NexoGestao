import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { FinanceService } from '../../src/finance/finance.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Organization-local overdue transitions with PostgreSQL', () => {
  const db = new PrismaClient()
  const orgIds: string[] = []
  const sent: string[] = []
  const timeline = new TimelineService(db as any, {} as any, { dispatchTimelineEvent: async () => {} } as any)
  const finance = new FinanceService(db as any, { enqueueMessage: async (input: any) => {
    sent.push(input.entityId)
    return { created: true, message: { id: randomUUID() } }
  } } as any, timeline, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
  const tenant = async (timezone: string) => {
    const id = randomUUID(); orgIds.push(id)
    await db.organization.create({ data: { id, name: 'Timezone regression', slug: `tz-${id}`, timezone } })
    const customer = await db.customer.create({ data: { orgId: id, name: 'Synthetic customer', phone: randomUUID() } })
    return { orgId: id, customerId: customer.id }
  }
  const charge = (scope: { orgId: string; customerId: string }, dueDate: string) => db.charge.create({ data: { ...scope, amountCents: 1000, dueDate: new Date(dueDate) } })
  const clock = (value: string) => jest.spyOn(Date, 'now').mockReturnValue(new Date(value).getTime())
  beforeEach(() => { sent.length = 0 })
  afterEach(() => { jest.restoreAllMocks() })
  afterAll(async () => {
    const where = { orgId: { in: orgIds } }
    await db.timelineEvent.deleteMany({ where })
    await db.charge.deleteMany({ where })
    await db.customer.deleteMany({ where })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await db.$disconnect()
  })
  it('keeps today pending until local midnight and uses exclusive next-day boundaries', async () => {
    const scope = await tenant('America/Sao_Paulo')
    const yesterday = await charge(scope, '2026-11-09T02:59:59.999Z')
    const start = await charge(scope, '2026-11-09T03:00:00Z')
    const middle = await charge(scope, '2026-11-09T15:00:00Z')
    const last = await charge(scope, '2026-11-10T02:59:59.999Z')
    const next = await charge(scope, '2026-11-10T03:00:00Z')
    const now = clock('2026-11-10T01:30:00Z')
    expect((await finance.automateOverdueLifecycle(scope.orgId)).updated).toBe(1)
    expect((await db.charge.findUniqueOrThrow({ where: { id: yesterday.id } })).status).toBe('OVERDUE')
    for (const row of [start, middle, last, next]) expect((await db.charge.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING')
    expect(sent).toEqual(expect.arrayContaining([start.id, middle.id, last.id]))
    expect(sent).not.toContain(next.id)
    now.mockReturnValue(new Date('2026-11-10T03:00:00Z').getTime())
    expect((await finance.automateOverdueLifecycle(scope.orgId)).updated).toBe(3)
    expect((await db.charge.findUniqueOrThrow({ where: { id: next.id } })).status).toBe('PENDING')
    expect((await finance.automateOverdueLifecycle(scope.orgId)).updated).toBe(0)
    expect(await db.timelineEvent.count({ where: { orgId: scope.orgId, action: 'CHARGE_OVERDUE' } })).toBe(4)
    const event = await db.timelineEvent.findFirstOrThrow({ where: { orgId: scope.orgId, chargeId: middle.id, action: 'CHARGE_OVERDUE' } })
    expect(event.metadata).toMatchObject({ timezone: 'America/Sao_Paulo', evaluatedAt: '2026-11-10T03:00:00.000Z' })
  })
  it('uses each organization day independently at the same UTC instant', async () => {
    const brazil = await tenant('America/Sao_Paulo'), utc = await tenant('UTC')
    const a = await charge(brazil, '2026-11-09T15:00:00Z'), b = await charge(utc, '2026-11-09T15:00:00Z')
    clock('2026-11-10T01:30:00Z')
    await Promise.all([finance.automateOverdueLifecycle(brazil.orgId), finance.automateOverdueLifecycle(utc.orgId)])
    expect((await db.charge.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('PENDING')
    expect((await db.charge.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('OVERDUE')
  })
  it('handles a 23-hour DST day without treating the next day as due today', async () => {
    const scope = await tenant('America/New_York')
    const previous = await charge(scope, '2026-03-08T04:59:59.999Z')
    const start = await charge(scope, '2026-03-08T05:00:00Z')
    const last = await charge(scope, '2026-03-09T03:59:59.999Z')
    const next = await charge(scope, '2026-03-09T04:00:00Z')
    clock('2026-03-08T12:00:00Z')
    expect((await finance.automateOverdueLifecycle(scope.orgId)).updated).toBe(1)
    expect((await db.charge.findUniqueOrThrow({ where: { id: previous.id } })).status).toBe('OVERDUE')
    expect(sent).toEqual(expect.arrayContaining([start.id, last.id]))
    expect(sent).not.toContain(next.id)
  })
  it('does not mutate overdue charges when the persisted timezone is invalid', async () => {
    const scope = await tenant('Mars/Olympus')
    const row = await charge(scope, '2020-01-01T00:00:00Z')
    clock('2026-11-10T01:30:00Z')
    await expect(finance.automateOverdueLifecycle(scope.orgId)).rejects.toThrow('Fuso horário')
    expect((await db.charge.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PENDING')
    expect(sent).toHaveLength(0)
    expect(await db.timelineEvent.count({ where: { orgId: scope.orgId } })).toBe(0)
  })
})
