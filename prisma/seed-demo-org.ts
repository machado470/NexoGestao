/**
 * seed-demo-org.ts
 * Seed de demonstração para nova organização
 */
import { PrismaClient, PaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedDemoOrg(orgId: string, actorUserId: string | null = null) {
  const now = new Date()

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        orgId,
        name: 'Ana Oliveira',
        phone: '5511999990001',
        email: 'ana.oliveira@exemplo.com',
        notes: 'Cliente demo — consultoria mensal',
        active: true,
      },
    }),
    prisma.customer.create({
      data: {
        orgId,
        name: 'Carlos Ferreira',
        phone: '5511999990002',
        email: 'carlos.ferreira@exemplo.com',
        notes: 'Cliente demo — suporte técnico',
        active: true,
      },
    }),
    prisma.customer.create({
      data: {
        orgId,
        name: 'Empresa Beta Ltda',
        phone: '5511999990003',
        email: 'contato@empresabeta.com',
        notes: 'Cliente demo — contrato anual',
        active: true,
      },
    }),
  ])

  const c1 = customers[0]
  const c2 = customers[1]
  const c3 = customers[2]

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const dayAfter = new Date(now)
  dayAfter.setDate(now.getDate() + 2)
  dayAfter.setHours(14, 0, 0, 0)

  const [apt1, apt2] = await Promise.all([
    prisma.appointment.create({
      data: {
        orgId,
        customerId: c1.id,
        startsAt: tomorrow,
        endsAt: new Date(tomorrow.getTime() + 60 * 60 * 1000),
        status: 'CONFIRMED',
        notes: 'Trazer proposta comercial',
      },
    }),
    prisma.appointment.create({
      data: {
        orgId,
        customerId: c2.id,
        startsAt: dayAfter,
        endsAt: new Date(dayAfter.getTime() + 90 * 60 * 1000),
        status: 'SCHEDULED',
        notes: 'Acesso remoto necessário',
      },
    }),
  ])

  const [so1, so2] = await Promise.all([
    prisma.serviceOrder.create({
      data: {
        orgId,
        customerId: c1.id,
        appointmentId: apt1.id,
        title: 'Consultoria operacional',
        description: 'Diagnóstico',
        status: 'IN_PROGRESS',
        priority: 1,
        scheduledFor: tomorrow,
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    }),
    prisma.serviceOrder.create({
      data: {
        orgId,
        customerId: c3.id,
        title: 'Implementação sistema',
        description: 'Configuração inicial do ambiente',
        status: 'OPEN',
        priority: 2,
      },
    }),
  ])

  const dueDate = new Date(now)
  dueDate.setDate(now.getDate() + 10)

  await prisma.charge.create({
    data: {
      orgId,
      customerId: c1.id,
      serviceOrderId: so1.id,
      amountCents: 150000,
      currency: 'BRL',
      status: 'PENDING',
      dueDate,
    },
  })

  const charge2 = await prisma.charge.create({
    data: {
      orgId,
      customerId: c3.id,
      serviceOrderId: so2.id,
      amountCents: 300000,
      currency: 'BRL',
      status: 'PAID',
      dueDate: new Date(now.getTime() - 5 * 86400000),
      paidAt: new Date(now.getTime() - 3 * 86400000),
    },
  })

  await prisma.payment.create({
    data: {
      orgId,
      chargeId: charge2.id,
      amountCents: 300000,
      method: PaymentMethod.PIX,
      paidAt: new Date(now.getTime() - 3 * 86400000),
    },
  })

  await prisma.invoice.create({
    data: {
      orgId,
      customerId: c1.id,
      number: `INV-${now.getFullYear()}-001`,
      description: 'Fatura de consultoria operacional',
      amountCents: 150000,
      status: 'ISSUED',
    },
  })

  await prisma.invoice.create({
    data: {
      orgId,
      customerId: c3.id,
      number: `INV-${now.getFullYear()}-002`,
      description: 'Fatura de implementação de sistema',
      amountCents: 300000,
      status: 'ISSUED',
    },
  })

  await prisma.timelineEvent.create({
    data: {
      orgId,
      action: 'DEMO_SEED_CREATED',
      description: 'Seed criada',
      metadata: { seed: true },
    },
  })

  console.log('Seed demo-org finalizado')
}
