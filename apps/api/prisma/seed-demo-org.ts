/**
 * seed-demo-org.ts
 * Seed de demonstração para nova organização:
 * - 3 clientes exemplo
 * - 2 agendamentos
 * - 2 ordens de serviço
 * - 1 cobrança
 * - 1 pagamento
 * - 2 despesas
 * - 2 faturas
 * - 2 lançamentos financeiros
 * - 1 indicação
 */
import { PrismaClient, PaymentMethod } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function seedDemoOrg(orgId: string, actorUserId: string | null = null) {
  const now = new Date()

  // ─── 3 Clientes ────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: `demo-customer-1-${orgId}`.substring(0, 36) },
      update: {},
      create: {
        orgId,
        name: 'Ana Oliveira',
        phone: '5511999990001',
        email: 'ana.oliveira@exemplo.com',
        notes: 'Cliente demo — consultoria mensal',
        active: true,
      },
    }).catch(() =>
      prisma.customer.create({
        data: {
          orgId,
          name: 'Ana Oliveira',
          phone: '5511999990001',
          email: 'ana.oliveira@exemplo.com',
          notes: 'Cliente demo — consultoria mensal',
          active: true,
        },
      })
    ),
    prisma.customer.create({
      data: {
        orgId,
        name: 'Carlos Ferreira',
        phone: '5511999990002',
        email: 'carlos.ferreira@exemplo.com',
        notes: 'Cliente demo — suporte técnico',
        active: true,
      },
    }).catch(() => prisma.customer.findFirst({ where: { orgId, email: 'carlos.ferreira@exemplo.com' } })),
    prisma.customer.create({
      data: {
        orgId,
        name: 'Empresa Beta Ltda',
        phone: '5511999990003',
        email: 'contato@empresabeta.com',
        notes: 'Cliente demo — contrato anual',
        active: true,
      },
    }).catch(() => prisma.customer.findFirst({ where: { orgId, email: 'contato@empresabeta.com' } })),
  ])

  const validCustomers = customers.filter(Boolean) as any[]
  if (validCustomers.length === 0) return { skipped: true }

  const c1 = validCustomers[0]
  const c2 = validCustomers[1] ?? c1
  const c3 = validCustomers[2] ?? c1

  // ─── 2 Agendamentos ────────────────────────────────────────────────────────
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
        title: 'Reunião inicial — Ana Oliveira',
        description: 'Alinhamento de escopo e objetivos',
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
        title: 'Suporte técnico — Carlos Ferreira',
        description: 'Diagnóstico do sistema',
        startsAt: dayAfter,
        endsAt: new Date(dayAfter.getTime() + 90 * 60 * 1000),
        status: 'SCHEDULED',
        notes: 'Acesso remoto necessário',
      },
    }),
  ])

  // ─── 2 Ordens de Serviço ───────────────────────────────────────────────────
  const [so1, so2] = await Promise.all([
    prisma.serviceOrder.create({
      data: {
        orgId,
        customerId: c1.id,
        appointmentId: apt1.id,
        title: 'Consultoria operacional — Ana Oliveira',
        description: 'Levantamento de processos e diagnóstico',
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
        title: 'Implementação de sistema — Empresa Beta',
        description: 'Configuração e treinamento da equipe',
        status: 'OPEN',
        priority: 2,
        scheduledFor: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // ─── 1 Cobrança ────────────────────────────────────────────────────────────
  const dueDate = new Date(now)
  dueDate.setDate(now.getDate() + 10)

  const charge = await prisma.charge.create({
    data: {
      orgId,
      customerId: c1.id,
      serviceOrderId: so1.id,
      amountCents: 150000, // R$ 1.500,00
      currency: 'BRL',
      status: 'PENDING',
      dueDate,
      notes: 'Consultoria operacional — 1ª parcela',
    },
  })

  // ─── 1 Pagamento ───────────────────────────────────────────────────────────
  const charge2 = await prisma.charge.create({
    data: {
      orgId,
      customerId: c3.id,
      serviceOrderId: so2.id,
      amountCents: 300000, // R$ 3.000,00
      currency: 'BRL',
      status: 'PAID',
      dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      paidAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      notes: 'Implementação — pagamento antecipado',
    },
  })

  const payment = await prisma.payment.create({
    data: {
      orgId,
      chargeId: charge2.id,
      amountCents: 300000,
      method: PaymentMethod.PIX,
      paidAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      notes: 'Pagamento via PIX — confirmado',
    },
  })

  // ─── 2 Despesas ────────────────────────────────────────────────────────────
  const [exp1, exp2] = await Promise.all([
    prisma.expense.create({
      data: {
        orgId,
        description: 'Licença de software — ferramentas de gestão',
        amountCents: 29900,
        category: 'INFRASTRUCTURE',
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        notes: 'Renovação mensal',
        createdByUserId: actorUserId,
      },
    }),
    prisma.expense.create({
      data: {
        orgId,
        description: 'Material de escritório',
        amountCents: 8500,
        category: 'SUPPLIES',
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        notes: 'Papelaria e impressão',
        createdByUserId: actorUserId,
      },
    }),
  ])

  // ─── 2 Faturas ─────────────────────────────────────────────────────────────
  const [inv1, inv2] = await Promise.all([
    prisma.invoice.create({
      data: {
        orgId,
        customerId: c1.id,
        number: `INV-${now.getFullYear()}-001`,
        description: 'Consultoria operacional — Janeiro',
        amountCents: 150000,
        status: 'ISSUED',
        dueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        issuedAt: now,
        notes: 'Fatura referente ao contrato de consultoria',
      },
    }),
    prisma.invoice.create({
      data: {
        orgId,
        customerId: c3.id,
        number: `INV-${now.getFullYear()}-002`,
        description: 'Implementação de sistema — Empresa Beta',
        amountCents: 300000,
        status: 'PAID',
        dueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        issuedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        paidAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        notes: 'Fatura paga antecipadamente',
      },
    }),
  ])

  // ─── 2 Lançamentos ─────────────────────────────────────────────────────────
  const [launch1, launch2] = await Promise.all([
    prisma.launch.create({
      data: {
        orgId,
        description: 'Receita — consultoria Ana Oliveira',
        amountCents: 150000,
        type: 'INCOME',
        category: 'Consultoria',
        account: 'Conta Principal',
        date: new Date(now.getFullYear(), now.getMonth(), 15),
        notes: 'Receita prevista',
        createdByUserId: actorUserId,
      },
    }),
    prisma.launch.create({
      data: {
        orgId,
        description: 'Despesa — infraestrutura mensal',
        amountCents: 29900,
        type: 'EXPENSE',
        category: 'Infraestrutura',
        account: 'Conta Principal',
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        notes: 'Custo fixo mensal',
        createdByUserId: actorUserId,
      },
    }),
  ])

  // ─── 1 Indicação ───────────────────────────────────────────────────────────
  const referral = await prisma.referral.create({
    data: {
      orgId,
      referrerName: 'Carlos Ferreira',
      referrerEmail: 'carlos.ferreira@exemplo.com',
      referrerPhone: '5511999990002',
      referredName: 'Novo Cliente Indicado',
      referredEmail: 'novo.cliente@exemplo.com',
      referredPhone: '5511999990099',
      creditAmountCents: 10000, // R$ 100,00
      status: 'PENDING',
      code: 'DEMO2024',
    },
  })

  // ─── Timeline events ───────────────────────────────────────────────────────
  await prisma.timelineEvent.createMany({
    data: [
      {
        orgId,
        action: 'DEMO_SEED_CREATED',
        description: 'Dados de demonstração criados para nova organização',
        metadata: {
          customers: validCustomers.length,
          appointments: 2,
          serviceOrders: 2,
          charges: 2,
          payments: 1,
          expenses: 2,
          invoices: 2,
          launches: 2,
          referrals: 1,
          seed: true,
          seedSource: 'prisma/seed-demo-org.ts',
        },
      },
    ],
  })

  return {
    customers: validCustomers.length,
    appointments: 2,
    serviceOrders: 2,
    charges: 2,
    payments: 1,
    expenses: 2,
    invoices: 2,
    launches: 2,
    referrals: 1,
  }
}

// Executar standalone se chamado diretamente
async function main() {
  const orgSlug = process.env.DEMO_ORG_SLUG || 'default'

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } })
  if (!org) {
    console.error(`❌ Organização '${orgSlug}' não encontrada. Rode o seed principal primeiro.`)
    process.exit(1)
  }

  const user = await prisma.user.findFirst({ where: { orgId: org.id, role: 'ADMIN' } })

  console.log(`🌱 Criando seed de demonstração para org: ${org.name} (${org.id})`)
  const result = await seedDemoOrg(org.id, user?.id ?? null)
  console.log('✅ Seed de demonstração criado:', result)
}

main()
  .catch((err) => {
    console.error('❌ Seed falhou:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
