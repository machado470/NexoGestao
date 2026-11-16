import { ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { randomUUID } from 'crypto'
import { InvoicesService } from '../../src/invoices/invoices.service'
import { FinanceService } from '../../src/finance/finance.service'
import { PaymentsService } from '../../src/payments/payments.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { AuditService } from '../../src/audit/audit.service'
import { IdempotencyService } from '../../src/common/idempotency/idempotency.service'
import { OutboxService } from '../../src/outbox/outbox.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Financial audit gaps with real PostgreSQL', () => {
  jest.setTimeout(30000)
  const db = new PrismaClient()
  const orgIds: string[] = []
  let orgId: string, foreignOrg: string, customer: any, foreignCustomer: any
  const context = { requestId: 'gap-integration', correlationId: 'gap-integration' } as any
  const metrics = { increment: () => {} } as any
  const timeline = new TimelineService(db as any, context, { dispatchTimelineEvent: async () => {} } as any)
  const finance = new FinanceService(db as any, { enqueueMessage: async () => ({}) } as any, timeline,
    { track: async () => {} } as any, context, new IdempotencyService(db as any, context, metrics),
    metrics, new AuditService(db as any), new OutboxService(context))
  const invoices = new InvoicesService(db as any)
  beforeEach(async () => {
    orgId = randomUUID(); foreignOrg = randomUUID(); orgIds.push(orgId, foreignOrg)
    for (const id of [orgId, foreignOrg]) await db.organization.create({ data: { id, name: 'Audit regression', slug: `audit-${id}` } })
    customer = await db.customer.create({ data: { orgId, name: 'Own', phone: randomUUID() } })
    foreignCustomer = await db.customer.create({ data: { orgId: foreignOrg, name: 'Private foreign', phone: randomUUID() } })
  })
  afterAll(async () => {
    const where = { orgId: { in: orgIds } }
    await db.operationalOutboxEvent.deleteMany({ where })
    await db.idempotencyRecord.deleteMany({ where })
    await db.timelineEvent.deleteMany({ where })
    await db.auditEvent.deleteMany({ where })
    await db.payment.deleteMany({ where })
    await db.charge.deleteMany({ where })
    await db.invoice.deleteMany({ where })
    await db.customer.deleteMany({ where })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await db.$disconnect()
  })
  const createCharge = (data: any = {}) => db.charge.create({ data: { orgId, customerId: customer.id, amountCents: 1000, dueDate: new Date(), ...data } })
  it('rejects cross-tenant invoice relationships in the service and the database', async () => {
    await expect(invoices.create(orgId, { number: 'A', amountCents: 1000, customerId: foreignCustomer.id })).rejects.toBeInstanceOf(NotFoundException)
    const invoice = await invoices.create(orgId, { number: 'A', amountCents: 1000, customerId: customer.id })
    expect(invoice.description).toBe('')
    await expect(invoices.update(orgId, invoice.id, { customerId: foreignCustomer.id })).rejects.toBeInstanceOf(NotFoundException)
    await expect(db.invoice.update({ where: { id: invoice.id }, data: { customerId: foreignCustomer.id } })).rejects.toMatchObject({ code: 'P2003' })
    expect((await invoices.findOne(orgId, invoice.id)).customer?.id).toBe(customer.id)
  })
  it('allows only one concurrent invoice with the same tenant/number', async () => {
    const create = () => invoices.create(orgId, { number: 'SAME', amountCents: 1000 })
    const results = await Promise.allSettled([create(), create()])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException)
    expect(await db.invoice.count({ where: { orgId, number: 'SAME' } })).toBe(1)
    await expect(invoices.create(foreignOrg, { number: 'SAME', amountCents: 1000 })).resolves.toBeDefined()
  })
  it('enforces invoice number uniqueness on update', async () => {
    await invoices.create(orgId, { number: 'FIRST', amountCents: 1000 })
    const second = await invoices.create(orgId, { number: 'SECOND', amountCents: 1000 })
    await expect(invoices.update(orgId, second.id, { number: 'FIRST' })).rejects.toBeInstanceOf(ConflictException)
  })
  it('emits one overdue event across concurrent jobs and later repeats', async () => {
    const charge = await createCharge({ dueDate: new Date('2020-01-01') })
    const results = await Promise.all([finance.automateOverdueLifecycle(orgId), finance.automateOverdueLifecycle(orgId)])
    expect(results.reduce((n, r) => n + r.updated, 0)).toBe(1)
    expect((await finance.automateOverdueLifecycle(orgId)).updated).toBe(0)
    expect(await db.timelineEvent.count({ where: { orgId, chargeId: charge.id, action: 'CHARGE_OVERDUE' } })).toBe(1)
  })
  it('preserves canceled values and persists intentional note clearing', async () => {
    const charge = await createCharge({ status: 'CANCELED', notes: 'Old note' })
    await expect(finance.updateCharge({ orgId, id: charge.id, amountCents: 2000, expectedUpdatedAt: charge.updatedAt.toISOString() })).rejects.toThrow('não pode ser alterado')
    await finance.updateCharge({ orgId, id: charge.id, notes: '', expectedUpdatedAt: charge.updatedAt.toISOString() })
    expect(await db.charge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: 'CANCELED', amountCents: 1000, notes: '' })
  })
  it('checks signed Stripe amounts and settles duplicate event types once', async () => {
    const charge = await createCharge()
    const pi = `pi_${randomUUID()}`, secret = 'whsec_local_integration'
    const payments = new PaymentsService({ get: (key: string) => key === 'STRIPE_SECRET_KEY' ? 'sk_test_local' : key === 'STRIPE_WEBHOOK_SECRET' ? secret : 'test' } as any, db as any, finance)
    const send = (extra: any = {}, type = 'checkout.session.completed') => {
      const payload = JSON.stringify({ id: `evt_${randomUUID()}`, type, data: { object: {
        id: 'cs_local', mode: 'payment', payment_status: 'paid', amount_total: 1000, currency: 'brl', payment_intent: pi,
        metadata: { orgId, chargeId: charge.id }, ...extra,
      } } })
      return payments.handleWebhook(Buffer.from(payload), Stripe.webhooks.generateTestHeaderString({ payload, secret }))
    }
    await expect(send({ amount_total: 100 })).rejects.toThrow('Conciliação necessária')
    await expect(send({ currency: 'usd' })).rejects.toThrow('Conciliação necessária')
    await send({ payment_status: 'unpaid' })
    expect(await db.payment.count({ where: { orgId } })).toBe(0)
    await send()
    await send({ paid: true, captured: true, amount_captured: 1000 }, 'charge.succeeded')
    await send({}, 'checkout.session.async_payment_succeeded')
    const rows = await db.payment.findMany({ where: { orgId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amountCents: 1000, externalRef: `stripe:${pi}` })
    expect(await db.operationalOutboxEvent.count({ where: { orgId, eventType: 'PAYMENT_RECEIVED' } })).toBe(1)
    const another = await createCharge()
    await expect(finance.payCharge({ orgId, chargeId: another.id, amountCents: 1000, method: 'CARD', currency: 'brl', externalRef: `stripe:${pi}`, idempotencyKey: randomUUID() })).rejects.toMatchObject({ code: 'P2002' })
    expect((await db.charge.findUniqueOrThrow({ where: { id: another.id } })).status).toBe('PENDING')
  })
})
