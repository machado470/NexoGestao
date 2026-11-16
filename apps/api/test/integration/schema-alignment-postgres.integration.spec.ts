import { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Canonical PostgreSQL schema contracts', () => {
  const db = new PrismaClient()
  const orgId = randomUUID()
  beforeAll(async () => { await db.organization.create({ data: { id: orgId, name: 'Schema test', slug: `schema-${orgId}` } }) })
  afterAll(async () => {
    await db.operationalOutboxEvent.deleteMany({ where: { orgId } })
    await db.expense.deleteMany({ where: { orgId } })
    await db.whatsAppConversation.deleteMany({ where: { orgId } })
    await db.organization.delete({ where: { id: orgId } })
    await db.$disconnect()
  })
  it('keeps database-generated UUIDs and timestamps usable by raw SQL and Prisma', async () => {
    const [event] = await db.$queryRaw<Array<{ id: string; nativeType: string; updatedAt: Date }>>(Prisma.sql`
      INSERT INTO "OperationalOutboxEvent" ("orgId", "eventType", "aggregateType", "aggregateId", "correlationId", "idempotencyKey", payload)
      VALUES (${orgId}, 'SCHEMA_TEST', 'Test', 'test', 'test', ${randomUUID()}, '{}'::jsonb)
      RETURNING id::text, pg_typeof(id)::text AS "nativeType", "updatedAt"
    `)
    expect(event.nativeType).toBe('uuid')
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(event.updatedAt).toBeInstanceOf(Date)
    expect((await db.operationalOutboxEvent.findUniqueOrThrow({ where: { id: event.id } })).id).toBe(event.id)
    const created = await db.operationalOutboxEvent.create({ data: { orgId, eventType: 'SCHEMA_TEST', aggregateType: 'Test', aggregateId: 'test', correlationId: 'test', idempotencyKey: randomUUID(), payload: {} } })
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('preserves expense instants across PostgreSQL session timezones', async () => {
    const occurredAt = new Date('2026-11-09T23:30:00-03:00')
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Pacific/Auckland'")
      const expense = await tx.expense.create({ data: { orgId, title: 'Timezone test', amountCents: 100, category: 'OTHER', occurredAt } })
      expect(expense.occurredAt.toISOString()).toBe(occurredAt.toISOString())
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/Sao_Paulo'")
      const reloaded = await tx.expense.findUniqueOrThrow({ where: { id: expense.id } })
      expect(reloaded.occurredAt.toISOString()).toBe(occurredAt.toISOString())
    })
  })
  it('preserves the existing required WhatsApp provider and timestamp defaults', async () => {
    const conversation = await db.whatsAppConversation.create({ data: { orgId, phone: randomUUID() } })
    expect(conversation.provider).toBe('mock')
    const rows = await db.$queryRaw<Array<{ column_name: string; column_default: string | null; is_nullable: string }>>`
      SELECT column_name, column_default, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'WhatsAppConversation' AND column_name IN ('provider', 'updatedAt')
    `
    expect(rows.find(row => row.column_name === 'provider')).toMatchObject({ is_nullable: 'NO', column_default: expect.stringContaining('mock') })
    expect(rows.find(row => row.column_name === 'updatedAt')?.column_default).not.toBeNull()
  })
})
