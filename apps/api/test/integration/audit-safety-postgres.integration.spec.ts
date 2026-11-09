import { ConflictException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PeopleService } from '../../src/people/people.service'
import { FinanceService } from '../../src/finance/finance.service'
import { AuditService } from '../../src/audit/audit.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Audit safety regressions with PostgreSQL', () => {
  jest.setTimeout(30000)
  const prisma = new PrismaClient()
  const orgId = randomUUID()
  const deliveries: Array<{ event: any; person: any }> = []
  const dispatcher = { dispatchTimelineEvent: async (input: any) => {
    if (!input.data.personId) return
    deliveries.push({
      event: await prisma.timelineEvent.findUnique({ where: { id: input.timelineEventId } }),
      person: await prisma.person.findUnique({ where: { id: input.data.personId } }),
    })
  } }
  const timeline = new TimelineService(prisma as any, {} as any, dispatcher as any)
  const people = new PeopleService(prisma as any, {} as any, timeline)
  beforeAll(async () => {
    await prisma.organization.create({ data: { id: orgId, name: 'Audit safety', slug: `audit-${orgId}` } })
  })
  afterAll(async () => {
    await prisma.timelineEvent.deleteMany({ where: { orgId } })
    await prisma.auditEvent.deleteMany({ where: { orgId } })
    await prisma.payment.deleteMany({ where: { orgId } })
    await prisma.charge.deleteMany({ where: { orgId } })
    await prisma.customer.deleteMany({ where: { orgId } })
    await prisma.person.deleteMany({ where: { orgId } })
    await prisma.user.deleteMany({ where: { orgId } })
    await prisma.organization.delete({ where: { id: orgId } })
    await prisma.$disconnect()
  })
  it('serializes simultaneous person deactivations and preserves one usable administrator', async () => {
    const makeAdmin = () => prisma.user.create({ data: {
      orgId, role: 'ADMIN', active: true, email: `${randomUUID()}@audit.test`,
      person: { create: { orgId, name: 'Admin', role: 'ADMIN' } },
    }, include: { person: true } })
    const [a, b] = await Promise.all([makeAdmin(), makeAdmin()])
    const outcomes = await Promise.allSettled([
      people.updatePerson(a.person!.id, orgId, { active: false, expectedUpdatedAt: a.person!.updatedAt.toISOString() }, b.id),
      people.deactivatePerson(b.person!.id, orgId, a.id),
    ])
    expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.user.count({ where: { orgId, active: true, role: 'ADMIN', person: { is: { active: true } } } })).toBe(1)
    expect(await prisma.auditEvent.count({ where: { orgId, action: 'PERSON_DEACTIVATED' } })).toBe(1)
    expect(await prisma.timelineEvent.count({ where: { orgId, action: 'PERSON_DEACTIVATED' } })).toBe(1)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].event).toMatchObject({ orgId, action: 'PERSON_DEACTIVATED' })
    expect(deliveries[0].person).toMatchObject({ orgId, active: false })
  })
  it('rolls back the activity change and audit when transactional timeline persistence fails', async () => {
    const person = await prisma.person.create({ data: { orgId, name: 'Worker', role: 'STAFF' } })
    const failing = new PeopleService(prisma as any, {} as any, { logInTransaction: async () => { throw new Error('timeline failure') } } as any)
    await expect(failing.deactivatePerson(person.id, orgId, null)).rejects.toThrow('timeline failure')
    expect((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).active).toBe(true)
    expect(await prisma.auditEvent.count({ where: { orgId, personId: person.id } })).toBe(0)
    expect(deliveries).toHaveLength(1)
  })
  it('rejects a payment if another connection edits the amount after validation reads it', async () => {
    const customer = await prisma.customer.create({ data: { orgId, name: 'Customer', phone: randomUUID() } })
    const charge = await prisma.charge.create({ data: { orgId, customerId: customer.id, amountCents: 1000, dueDate: new Date() } })
    let signalRead!: () => void, resume!: () => void
    const read = new Promise<void>(resolve => { signalRead = resolve })
    const proceed = new Promise<void>(resolve => { resume = resolve })
    const pausedDb = { charge: prisma.charge, $transaction: (fn: any) => prisma.$transaction(async tx => {
      let first = true
      return fn(new Proxy(tx, { get(target, key) {
        if (key !== 'charge') return Reflect.get(target, key)
        return new Proxy(target.charge, { get(delegate, method) {
          if (method !== 'findFirst') return Reflect.get(delegate, method)
          return async (args: any) => {
            const result = await delegate.findFirst(args)
            if (first) { first = false; signalRead(); await proceed }
            return result
          }
        } })
      } }))
    }, { timeout: 15000 }) }
    const finance = new FinanceService(pausedDb as any, {} as any, timeline, {} as any, {} as any,
      { begin: async () => ({ mode: 'execute', recordId: 'test' }), fail: async () => {} } as any,
      { increment: () => {} } as any, {} as any, {} as any)
    const payment = finance.payCharge({ orgId, chargeId: charge.id, amountCents: 1000, method: 'PIX' }).then(
      () => null, error => error,
    )
    try {
      await Promise.race([read, payment.then(error => { throw error ?? new Error('Payment finished before the concurrency barrier') })])
      await prisma.charge.update({ where: { id: charge.id }, data: { amountCents: 2000 } })
    } finally { resume() }
    expect(await payment).toBeInstanceOf(ConflictException)
    expect(await prisma.payment.count({ where: { chargeId: charge.id } })).toBe(0)
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: 'PENDING', amountCents: 2000 })
  })
  it('requires a cancellation reason and preserves canonical cancellation metadata', async () => {
    const customer = await prisma.customer.create({ data: { orgId, name: 'Cancel customer', phone: randomUUID() } })
    const charge = await prisma.charge.create({ data: { orgId, customerId: customer.id, amountCents: 1000, dueDate: new Date() } })
    const finance = new FinanceService(prisma as any, {} as any, timeline, {} as any, {} as any,
      {} as any, {} as any, new AuditService(prisma as any), {} as any)
    await expect(finance.updateCharge({ orgId, id: charge.id, status: 'CANCELED', expectedUpdatedAt: charge.updatedAt.toISOString() })).rejects.toThrow('motivo obrigatório')
    expect((await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).status).toBe('PENDING')
    await expect(finance.cancelCharge({ orgId, id: charge.id, cancellationReason: ' ', expectedUpdatedAt: charge.updatedAt.toISOString() })).rejects.toThrow('Motivo')
    await finance.cancelCharge({ orgId, id: charge.id, actorUserId: 'audit-actor', cancellationReason: 'Cobrança duplicada', expectedUpdatedAt: charge.updatedAt.toISOString() })
    expect(await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: 'CANCELED', canceledByUserId: 'audit-actor', cancellationReason: 'Cobrança duplicada', canceledAt: expect.any(Date) })
    expect(await prisma.auditEvent.count({ where: { orgId, entityId: charge.id, action: 'CHARGE_CANCELED' } })).toBe(1)
    await expect(finance.remindChargeInOrg(orgId, charge.id)).rejects.toThrow('Somente cobranças pendentes')
  })

})
