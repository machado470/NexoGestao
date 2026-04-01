/**
 * Seed de dados de demonstração para o NexoGestão.
 * Popula: clientes, agendamentos, ordens de serviço, cobranças, pagamentos,
 * despesas, lançamentos financeiros e eventos de timeline.
 */
import { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  // ── Organização e usuário admin ──────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: { name: 'NexoGestão', requiresOnboarding: false },
    create: { name: 'NexoGestão', slug: 'default', requiresOnboarding: false },
  })

  const adminEmail = 'admin@nexogestao.local'
  const adminPassword = 'Admin@123456'

  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!adminUser) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        password: passwordHash,
        role: 'ADMIN',
        active: true,
        orgId: org.id,
      },
    })
    await prisma.person.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        role: 'ADMIN',
        active: true,
        orgId: org.id,
        userId: adminUser.id,
      },
    })
  }

  const adminPerson = await prisma.person.findFirst({
    where: { orgId: org.id, role: 'ADMIN' },
  })

  // ── Clientes ─────────────────────────────────────────────────────────────
  const clientesData = [
    { name: 'Maria Oliveira', phone: '11987654321', email: 'maria@email.com', notes: 'Cliente VIP' },
    { name: 'João Santos', phone: '11976543210', email: 'joao@email.com', notes: 'Preferência por manhãs' },
    { name: 'Ana Costa', phone: '11965432109', email: 'ana@email.com', notes: null },
    { name: 'Carlos Pereira', phone: '11954321098', email: 'carlos@email.com', notes: 'Pagamento sempre em dia' },
    { name: 'Fernanda Lima', phone: '11943210987', email: 'fernanda@email.com', notes: null },
    { name: 'Roberto Alves', phone: '11932109876', email: 'roberto@email.com', notes: 'Indicado por Maria' },
    { name: 'Patrícia Souza', phone: '11921098765', email: 'patricia@email.com', notes: null },
    { name: 'Marcos Ferreira', phone: '11910987654', email: 'marcos@email.com', notes: 'Empresa: Ferreira & Cia' },
  ]

  const clientes = []
  for (const c of clientesData) {
    const existing = await prisma.customer.findFirst({
      where: { orgId: org.id, phone: c.phone },
    })
    if (existing) {
      clientes.push(existing)
    } else {
      const created = await prisma.customer.create({
        data: { ...c, orgId: org.id },
      })
      clientes.push(created)
    }
  }

  // ── Agendamentos ─────────────────────────────────────────────────────────
  const agendamentosData = [
    { customerId: clientes[0].id, startsAt: daysAgo(10), endsAt: new Date(daysAgo(10).getTime() + 60 * 60 * 1000), status: 'DONE' as const },
    { customerId: clientes[1].id, startsAt: daysAgo(7), endsAt: new Date(daysAgo(7).getTime() + 90 * 60 * 1000), status: 'DONE' as const },
    { customerId: clientes[2].id, startsAt: daysAgo(3), endsAt: new Date(daysAgo(3).getTime() + 60 * 60 * 1000), status: 'DONE' as const },
    { customerId: clientes[3].id, startsAt: daysFromNow(1), endsAt: new Date(daysFromNow(1).getTime() + 60 * 60 * 1000), status: 'SCHEDULED' as const },
    { customerId: clientes[4].id, startsAt: daysFromNow(3), endsAt: new Date(daysFromNow(3).getTime() + 90 * 60 * 1000), status: 'SCHEDULED' as const },
    { customerId: clientes[5].id, startsAt: daysFromNow(5), endsAt: new Date(daysFromNow(5).getTime() + 60 * 60 * 1000), status: 'CONFIRMED' as const },
  ]

  const agendamentos = []
  for (const a of agendamentosData) {
    const created = await prisma.appointment.create({
      data: { ...a, orgId: org.id },
    })
    agendamentos.push(created)
  }

  // ── Ordens de Serviço ────────────────────────────────────────────────────
  const osData = [
    {
      customerId: clientes[0].id,
      title: 'Manutenção preventiva - Maria',
      description: 'Revisão completa do sistema',
      status: 'DONE' as const,
      priority: 2,
      amountCents: 35000,
      scheduledFor: daysAgo(10),
      startedAt: daysAgo(10),
      finishedAt: daysAgo(10),
      outcomeSummary: 'Serviço concluído com sucesso.',
    },
    {
      customerId: clientes[1].id,
      title: 'Instalação de equipamento - João',
      description: 'Instalação e configuração inicial',
      status: 'DONE' as const,
      priority: 3,
      amountCents: 75000,
      scheduledFor: daysAgo(7),
      startedAt: daysAgo(7),
      finishedAt: daysAgo(7),
      outcomeSummary: 'Instalação realizada sem intercorrências.',
    },
    {
      customerId: clientes[2].id,
      title: 'Reparo urgente - Ana',
      description: 'Falha identificada no sistema principal',
      status: 'IN_PROGRESS' as const,
      priority: 1,
      amountCents: 45000,
      scheduledFor: daysAgo(3),
      startedAt: daysAgo(3),
    },
    {
      customerId: clientes[3].id,
      title: 'Consultoria técnica - Carlos',
      description: 'Análise e recomendações de melhoria',
      status: 'ASSIGNED' as const,
      priority: 2,
      amountCents: 25000,
      scheduledFor: daysFromNow(1),
      assignedToPersonId: adminPerson?.id,
    },
    {
      customerId: clientes[4].id,
      title: 'Projeto novo - Fernanda',
      description: 'Desenvolvimento de solução customizada',
      status: 'OPEN' as const,
      priority: 2,
      amountCents: 120000,
      scheduledFor: daysFromNow(3),
    },
    {
      customerId: clientes[5].id,
      title: 'Suporte mensal - Roberto',
      description: 'Pacote de suporte mensal contratado',
      status: 'OPEN' as const,
      priority: 3,
      amountCents: 18000,
      scheduledFor: daysFromNow(5),
    },
    {
      customerId: clientes[0].id,
      title: 'Revisão semestral - Maria',
      description: 'Segunda revisão do ano',
      status: 'OPEN' as const,
      priority: 2,
      amountCents: 35000,
      scheduledFor: daysFromNow(10),
    },
    {
      customerId: clientes[6].id,
      title: 'Instalação básica - Patrícia',
      description: 'Setup inicial do ambiente',
      status: 'CANCELED' as const,
      priority: 2,
      amountCents: 30000,
      scheduledFor: daysAgo(5),
      cancellationReason: 'Cliente solicitou cancelamento.',
    },
  ]

  const ordens = []
  for (const os of osData) {
    const created = await prisma.serviceOrder.create({
      data: { ...os, orgId: org.id },
    })
    ordens.push(created)
  }

  // ── Cobranças ────────────────────────────────────────────────────────────
  const cobrancasData = [
    // OS 0 - DONE - cobrada e paga
    { customerId: clientes[0].id, serviceOrderId: ordens[0].id, amountCents: 35000, status: 'PAID' as const, dueDate: daysAgo(8), paidAt: daysAgo(8) },
    // OS 1 - DONE - cobrada e paga
    { customerId: clientes[1].id, serviceOrderId: ordens[1].id, amountCents: 75000, status: 'PAID' as const, dueDate: daysAgo(5), paidAt: daysAgo(5) },
    // OS 2 - IN_PROGRESS - pendente
    { customerId: clientes[2].id, serviceOrderId: ordens[2].id, amountCents: 45000, status: 'PENDING' as const, dueDate: daysFromNow(7) },
    // OS 3 - ASSIGNED - pendente
    { customerId: clientes[3].id, serviceOrderId: ordens[3].id, amountCents: 25000, status: 'PENDING' as const, dueDate: daysFromNow(10) },
    // OS 4 - OPEN - pendente
    { customerId: clientes[4].id, serviceOrderId: ordens[4].id, amountCents: 120000, status: 'PENDING' as const, dueDate: daysFromNow(15) },
    // Cobrança vencida (sem OS)
    { customerId: clientes[7].id, serviceOrderId: null, amountCents: 55000, status: 'OVERDUE' as const, dueDate: daysAgo(15) },
    // Cobrança vencida (sem OS)
    { customerId: clientes[6].id, serviceOrderId: null, amountCents: 22000, status: 'OVERDUE' as const, dueDate: daysAgo(20) },
  ]

  const cobrancas = []
  for (const c of cobrancasData) {
    const created = await prisma.charge.create({
      data: { ...c, orgId: org.id },
    })
    cobrancas.push(created)
  }

  // ── Pagamentos ───────────────────────────────────────────────────────────
  await prisma.payment.create({
    data: {
      orgId: org.id,
      chargeId: cobrancas[0].id,
      amountCents: 35000,
      method: 'PIX',
      paidAt: daysAgo(8),
      notes: 'Pago via PIX',
    },
  })
  await prisma.payment.create({
    data: {
      orgId: org.id,
      chargeId: cobrancas[1].id,
      amountCents: 75000,
      method: 'TRANSFER',
      paidAt: daysAgo(5),
      notes: 'Transferência bancária',
    },
  })

  // ── Despesas ─────────────────────────────────────────────────────────────
  const despesasData = [
    { description: 'Material de escritório', amountCents: 8500, category: 'OFFICE', date: daysAgo(20) },
    { description: 'Aluguel do espaço', amountCents: 150000, category: 'RENT', date: daysAgo(30) },
    { description: 'Conta de energia', amountCents: 35000, category: 'UTILITIES', date: daysAgo(15) },
    { description: 'Ferramentas e equipamentos', amountCents: 45000, category: 'EQUIPMENT', date: daysAgo(10) },
    { description: 'Marketing digital', amountCents: 25000, category: 'MARKETING', date: daysAgo(5) },
  ]

  for (const d of despesasData) {
    await prisma.expense.create({
      data: { ...d, orgId: org.id, createdByUserId: adminUser.id },
    })
  }

  // ── Lançamentos financeiros ───────────────────────────────────────────────
  const lancamentosData = [
    { description: 'Receita OS Maria', amountCents: 35000, type: 'INCOME', category: 'SERVICE', date: daysAgo(8) },
    { description: 'Receita OS João', amountCents: 75000, type: 'INCOME', category: 'SERVICE', date: daysAgo(5) },
    { description: 'Aluguel mensal', amountCents: -150000, type: 'EXPENSE', category: 'RENT', date: daysAgo(30) },
    { description: 'Energia elétrica', amountCents: -35000, type: 'EXPENSE', category: 'UTILITIES', date: daysAgo(15) },
    { description: 'Receita consultoria Carlos (parcial)', amountCents: 12500, type: 'INCOME', category: 'SERVICE', date: daysAgo(2) },
  ]

  for (const l of lancamentosData) {
    await prisma.launch.create({
      data: {
        orgId: org.id,
        description: l.description,
        amountCents: Math.abs(l.amountCents),
        type: l.type,
        category: l.category,
        date: l.date,
        createdByUserId: adminUser.id,
      },
    })
  }

  // ── Eventos de Timeline ───────────────────────────────────────────────────
  const timelineData = [
    { action: 'CUSTOMER_CREATED', description: `Cliente ${clientes[0].name} cadastrado`, personId: adminPerson?.id, createdAt: daysAgo(30) },
    { action: 'SERVICE_ORDER_CREATED', description: `OS criada para ${clientes[0].name}`, personId: adminPerson?.id, createdAt: daysAgo(10) },
    { action: 'SERVICE_ORDER_COMPLETED', description: `OS concluída para ${clientes[0].name}`, personId: adminPerson?.id, createdAt: daysAgo(10) },
    { action: 'PAYMENT_RECEIVED', description: `Pagamento de R$ 350,00 recebido de ${clientes[0].name}`, personId: adminPerson?.id, createdAt: daysAgo(8) },
    { action: 'SERVICE_ORDER_CREATED', description: `OS criada para ${clientes[1].name}`, personId: adminPerson?.id, createdAt: daysAgo(7) },
    { action: 'SERVICE_ORDER_COMPLETED', description: `OS concluída para ${clientes[1].name}`, personId: adminPerson?.id, createdAt: daysAgo(7) },
    { action: 'PAYMENT_RECEIVED', description: `Pagamento de R$ 750,00 recebido de ${clientes[1].name}`, personId: adminPerson?.id, createdAt: daysAgo(5) },
    { action: 'SERVICE_ORDER_CREATED', description: `OS de reparo urgente criada para ${clientes[2].name}`, personId: adminPerson?.id, createdAt: daysAgo(3) },
    { action: 'CHARGE_OVERDUE', description: `Cobrança vencida de ${clientes[7].name}`, personId: adminPerson?.id, createdAt: daysAgo(1) },
    { action: 'APPOINTMENT_SCHEDULED', description: `Agendamento criado para ${clientes[3].name}`, personId: adminPerson?.id, createdAt: daysAgo(2) },
  ]

  for (const t of timelineData) {
    await prisma.timelineEvent.create({
      data: {
        action: t.action,
        description: t.description,
        personId: t.personId ?? null,
        orgId: org.id,
        createdAt: t.createdAt,
        metadata: {},
      },
    })
  }

  console.log(`✅ Seed de demonstração concluída:`)
  console.log(`   - ${clientes.length} clientes`)
  console.log(`   - ${agendamentos.length} agendamentos`)
  console.log(`   - ${ordens.length} ordens de serviço`)
  console.log(`   - ${cobrancas.length} cobranças`)
  console.log(`   - 2 pagamentos`)
  console.log(`   - ${despesasData.length} despesas`)
  console.log(`   - ${lancamentosData.length} lançamentos financeiros`)
  console.log(`   - ${timelineData.length} eventos de timeline`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
