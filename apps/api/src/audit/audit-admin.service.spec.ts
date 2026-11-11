import { AuditAdminService } from './audit-admin.service'

describe('Audit actor names include historical tenant actors', () => {
  const actors = [{ actorPersonId: 'inactive-person', _count: { id: 2 } }, { actorPersonId: null, _count: { id: 1 } }]
  const db = { auditEvent: { groupBy: jest.fn(), count: jest.fn() }, person: { findMany: jest.fn() } }
  beforeEach(() => {
    jest.resetAllMocks()
    db.auditEvent.groupBy.mockImplementation(async ({ by }) => by[0] === 'action' ? [{ action: 'CUSTOMER_UPDATED', _count: { id: 3 } }] : actors)
    db.auditEvent.count.mockResolvedValue(3)
    db.person.findMany.mockResolvedValue([{ id: 'inactive-person', name: 'Ator histórico' }])
  })
  it('enriches actor IDs without changing counts and without filtering out inactive people', async () => {
    const result = await new AuditAdminService(db as any).getSummary({ orgId: 'org' })
    expect(result.byActor).toEqual([{ actorPersonId: 'inactive-person', actorName: 'Ator histórico', count: 2 }, { actorPersonId: null, actorName: null, count: 1 }])
    expect(db.person.findMany).toHaveBeenCalledWith({ where: { orgId: 'org', id: { in: ['inactive-person'] } }, select: { id: true, name: true } })
  })
  it('does not fabricate a name for an actor absent from the tenant lookup', async () => {
    db.person.findMany.mockResolvedValue([])
    expect((await new AuditAdminService(db as any).getSummary({ orgId: 'org' })).byActor[0]).toMatchObject({ actorPersonId: 'inactive-person', actorName: null })
  })
  it('does not query people for an empty audit summary', async () => {
    db.auditEvent.groupBy.mockResolvedValue([])
    db.auditEvent.count.mockResolvedValue(0)
    expect(await new AuditAdminService(db as any).getSummary({ orgId: 'org' })).toEqual({ total: 0, byAction: [], byActor: [] })
    expect(db.person.findMany).not.toHaveBeenCalled()
  })
})


describe('Audit actor attribution', () => {
  it.each([
    ['known person', { actorPersonId: 'person', person: { name: 'Ana' } }, 'Ana'],
    ['missing person', { actorPersonId: 'person', person: null }, 'Ator não identificado'],
    ['user without person', { actorPersonId: null, actorUserId: 'user', person: null }, 'Ator não identificado'],
    ['system', { actorPersonId: null, actorUserId: null, person: null }, 'Sistema'],
  ])('preserves attribution for %s in list and detail', async (_label, actor, expected) => {
    const event = { id: 'event', orgId: 'org', ...actor }
    const db = { auditEvent: { findMany: jest.fn().mockResolvedValue([event]), count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue(event) } }
    const service = new AuditAdminService(db as any)
    expect((await service.listEvents({ orgId: 'org' })).data[0]).toEqual({ ...event, actorName: expected })
    expect(await service.getEventDetail('org', 'event')).toEqual({ ...event, actorName: expected })
  })
})


describe('Audit pagination validation', () => {
  it.each([
    { page: -1 }, { page: 1.5 }, { page: Infinity },
    { limit: -1 }, { limit: 1.5 }, { limit: Infinity },
  ])('rejects invalid pagination before querying: %j', async input => {
    const db = { auditEvent: { findMany: jest.fn(), count: jest.fn() } }
    await expect(new AuditAdminService(db as any).listEvents({ orgId: 'org', ...input })).rejects.toMatchObject({ status: 400 })
    expect(db.auditEvent.findMany).not.toHaveBeenCalled()
    expect(db.auditEvent.count).not.toHaveBeenCalled()
  })
  it.each([
    [{}, 1, 50, 0],
    [{ page: 0, limit: 0 }, 1, 50, 0],
    [{ page: 2, limit: 200 }, 2, 100, 100],
    [{ page: '2', limit: '25' }, 2, 25, 25],
  ])('preserves supported pagination: %j', async (input, page, limit, skip) => {
    const db = { auditEvent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } }
    const result = await new AuditAdminService(db as any).listEvents({ orgId: 'org', ...input } as any)
    expect(result.pagination).toMatchObject({ page, limit })
    expect(db.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip, take: limit, where: { orgId: 'org' } }))
  })
})


describe('Audit date filters', () => {
  const makeDb = () => ({ auditEvent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) } })
  it.each([
    { from: 'invalid' }, { to: 'invalid' },
    { from: '2026-11-11T00:00:00.000Z', to: '2026-11-10T23:59:59.999Z' },
  ])('rejects invalid ranges in list and summary before querying: %j', async input => {
    const db = makeDb()
    const service = new AuditAdminService(db as any)
    await expect(service.listEvents({ orgId: 'org', ...input })).rejects.toMatchObject({ status: 400 })
    await expect(service.getSummary({ orgId: 'org', ...input })).rejects.toMatchObject({ status: 400 })
    expect(db.auditEvent.findMany).not.toHaveBeenCalled()
    expect(db.auditEvent.groupBy).not.toHaveBeenCalled()
    expect(db.auditEvent.count).not.toHaveBeenCalled()
  })
  it.each([
    [{}, undefined],
    [{ from: '2026-11-10T00:00:00.000Z' }, { gte: new Date('2026-11-10T00:00:00.000Z') }],
    [{ to: '2026-11-10T23:59:59.999Z' }, { lte: new Date('2026-11-10T23:59:59.999Z') }],
    [{ from: '2026-11-10T00:00:00.000Z', to: '2026-11-10T00:00:00.000Z' }, { gte: new Date('2026-11-10T00:00:00.000Z'), lte: new Date('2026-11-10T00:00:00.000Z') }],
  ])('preserves valid inclusive date filters: %j', async (input, createdAt) => {
    const db = makeDb()
    const service = new AuditAdminService(db as any)
    await service.listEvents({ orgId: 'org', ...input })
    await service.getSummary({ orgId: 'org', ...input })
    const where = createdAt ? { orgId: 'org', createdAt } : { orgId: 'org' }
    expect(db.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(db.auditEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where }))
  })
})
