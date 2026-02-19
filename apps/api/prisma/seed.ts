// apps/api/prisma/seed.ts
import { PrismaClient, AppointmentStatus, ServiceOrderStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function env(name: string, fallback = ''): string {
  const v = (process.env[name] ?? '').trim()
  return v || fallback
}

/**
 * Base de tempo determinística (por dia) para não quebrar o seed em reruns.
 * - Se rodar de novo no mesmo dia, gera os MESMOS startsAt/endsAt
 * - Evita conflito com constraint de no-overlap
 */
function seedDayBase(): Date {
  const iso = env('SEED_DAY_BASE_ISO', '')
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return d
  }

  // “Hoje” às 09:00:00.000 (timezone do container)
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  return d
}

function addHours(base: Date, h: number) {
  const d = new Date(base.getTime())
  d.setHours(d.getHours() + h)
  return d
}

async function ensureOrg() {
  const slug = env('DEMO_ORG_SLUG', 'default')
  const name = env('DEMO_ORG_NAME', 'NexoGestão')

  const org = await prisma.organization.upsert({
    where: { slug },
    update: { name },
    create: {
      name,
      slug,
      requiresOnboarding: true,
    },
  })

  return org
}

async function ensureDemoAdmin(orgId: string) {
  const email = env('DEMO_ADMIN_EMAIL', 'admin@nexogestao.local').toLowerCase()
  const password = env('DEMO_ADMIN_PASSWORD', 'Admin@123456')
  const name = env('DEMO_ADMIN_NAME', 'Admin')

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existing) {
    return { created: false, email, password, name }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: passwordHash,
        role: 'ADMIN',
        active: true,
        orgId,
      },
    })

    await tx.person.create({
      data: {
        name,
        email,
        role: 'ADMIN',
        active: true,
        orgId,
        userId: user.id,
      },
    })

    await tx.organization.update({
      where: { id: orgId },
      data: { requiresOnboarding: false },
    })
  })

  return { created: true, email, password, name }
}

async function getDemoAdminActor(orgId: string) {
  const email = env('DEMO_ADMIN_EMAIL', 'admin@nexogestao.local').toLowerCase()

  const user = await prisma.user.findFirst({
    where: { orgId, email },
    select: {
      id: true,
      person: { select: { id: true } },
    },
  })

  return {
    actorUserId: user?.id ?? null,
    actorPersonId: user?.person?.id ?? null,
  }
}

async function ensureDemoCustomers(orgId: string) {
  const customers = [
    { name: 'João Silva', phone: '5547999991111', email: 'joao@email.com' },
    { name: 'Maria Costa', phone: '5547999992222', email: 'maria@email.com' },
    { name: 'Clínica Exemplo', phone: '5547999993333', email: 'contato@clinica.com' },
  ]

  let createdCount = 0

  for (const c of customers) {
    const exists = await prisma.customer.findFirst({
      where: { orgId, email: c.email },
      select: { id: true },
    })

    if (exists) continue

    await prisma.customer.create({
      data: {
        orgId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        notes: 'Seed DEMO',
        active: true,
      },
    })

    createdCount++
  }

  return createdCount
}

async function ensureDemoAppointments(orgId: string) {
  const customers = await prisma.customer.findMany({
    where: { orgId, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  if (customers.length === 0) return 0

  const base = seedDayBase()

  // 6 agendamentos distribuídos entre os customers (determinísticos por dia)
  const plan: Array<{
    customerIndex: number
    startsAt: Date
    durationMin: number
    status: AppointmentStatus
    notes: string
  }> = [
    { customerIndex: 0, startsAt: addHours(base, 2), durationMin: 45, status: 'CONFIRMED', notes: 'Reunião inicial' },
    { customerIndex: 1, startsAt: addHours(base, 5), durationMin: 30, status: 'SCHEDULED', notes: 'Alinhamento rápido' },
    { customerIndex: 2, startsAt: addHours(base, 8), durationMin: 60, status: 'SCHEDULED', notes: 'Diagnóstico operacional' },
    { customerIndex: 0, startsAt: addHours(base, 26), durationMin: 30, status: 'CONFIRMED', notes: 'Revisão de semana' },
    { customerIndex: 1, startsAt: addHours(base, 30), durationMin: 45, status: 'CANCELED', notes: 'Cancelado pelo cliente' },
    { customerIndex: 2, startsAt: addHours(base, -6), durationMin: 30, status: 'DONE', notes: 'Concluído' },
  ]

  let created = 0

  for (const p of plan) {
    const c = customers[Math.min(p.customerIndex, customers.length - 1)]
    const endsAt = new Date(p.startsAt.getTime() + p.durationMin * 60 * 1000)

    // evita duplicar (org + customer + startsAt) — agora startsAt é determinístico no dia
    const exists = await prisma.appointment.findFirst({
      where: { orgId, customerId: c.id, startsAt: p.startsAt },
      select: { id: true },
    })
    if (exists) continue

    await prisma.appointment.create({
      data: {
        orgId,
        customerId: c.id,
        startsAt: p.startsAt,
        endsAt,
        status: p.status,
        notes: p.notes,
      },
    })

    created++
  }

  return created
}

async function ensureDemoCollaborators(orgId: string) {
  // cria só se ainda não existe nenhum colaborador
  const existing = await prisma.person.count({
    where: { orgId, role: 'COLLABORATOR', active: true },
  })

  if (existing > 0) {
    const people = await prisma.person.findMany({
      where: { orgId, role: 'COLLABORATOR', active: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })
    return { created: 0, people }
  }

  const names = [
    'Ana Silva',
    'Bruno Costa',
    'Carla Mendes',
    'Diego Rocha',
    'Eduarda Lima',
    'Felipe Alves',
  ]

  for (const name of names) {
    await prisma.person.create({
      data: {
        name,
        orgId,
        active: true,
        role: 'COLLABORATOR',
      },
    })
  }

  const people = await prisma.person.findMany({
    where: { orgId, role: 'COLLABORATOR', active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })

  return { created: names.length, people }
}

async function ensureDemoTracks(orgId: string) {
  // cria só se ainda não existe nenhuma track
  const existing = await prisma.track.count({ where: { orgId } })
  if (existing > 0) {
    const tracks = await prisma.track.findMany({
      where: { orgId },
      select: { id: true, title: true, status: true, slug: true, version: true },
      orderBy: { createdAt: 'asc' },
    })
    return { created: 0, tracks }
  }

  const createdTracks: { id: string; title: string }[] = []

  // Track 1
  const t1 = await prisma.track.create({
    data: {
      orgId,
      title: 'Trilha Base — Governança e Rotina',
      description: 'O mínimo viável para operar com consistência.',
      slug: 'trilha-base-governanca-e-rotina',
      version: 1,
      status: 'ACTIVE',
    },
    select: { id: true, title: true },
  })

  await prisma.trackItem.createMany({
    data: [
      {
        trackId: t1.id,
        order: 1,
        type: 'READING',
        title: 'Leitura: Como funciona o ciclo operacional',
        content: 'Entenda o fluxo: atribuição → execução → evidência → auditoria.',
      },
      {
        trackId: t1.id,
        order: 2,
        type: 'ACTION',
        title: 'Ação: Executar checklist e registrar evidência',
        content: 'Faça o checklist e registre a evidência mínima.',
      },
      {
        trackId: t1.id,
        order: 3,
        type: 'CHECKPOINT',
        title: 'Checkpoint: Confirmação final',
        content: 'Confirme que a execução foi concluída e está rastreável.',
      },
    ],
  })

  createdTracks.push(t1)

  // Track 2
  const t2 = await prisma.track.create({
    data: {
      orgId,
      title: 'Trilha Risco — Redução de Incidentes',
      description: 'Treino direcionado para reduzir falhas recorrentes.',
      slug: 'trilha-risco-reducao-de-incidentes',
      version: 1,
      status: 'ACTIVE',
    },
    select: { id: true, title: true },
  })

  await prisma.trackItem.createMany({
    data: [
      {
        trackId: t2.id,
        order: 1,
        type: 'READING',
        title: 'Leitura: Principais causas de falha',
        content: 'Falta de padrão, falta de evidência, pressa e improviso.',
      },
      {
        trackId: t2.id,
        order: 2,
        type: 'ACTION',
        title: 'Ação: Aplicar padrão e revisar',
        content: 'Aplique um padrão simples e revise antes de finalizar.',
      },
      {
        trackId: t2.id,
        order: 3,
        type: 'CHECKPOINT',
        title: 'Checkpoint: Autoavaliação rápida',
        content: 'Marque o que melhorou e o que ainda está fraco.',
      },
    ],
  })

  createdTracks.push(t2)

  const tracks = await prisma.track.findMany({
    where: { orgId },
    select: { id: true, title: true, status: true, slug: true, version: true },
    orderBy: { createdAt: 'asc' },
  })

  return { created: createdTracks.length, tracks }
}

async function ensureDemoAssignments(orgId: string, personIds: string[], trackIds: string[]) {
  if (personIds.length === 0 || trackIds.length === 0) return 0

  let created = 0

  for (const personId of personIds) {
    for (const trackId of trackIds) {
      const exists = await prisma.assignment.findFirst({
        where: { personId, trackId },
        select: { id: true },
      })
      if (exists) continue

      await prisma.assignment.create({
        data: {
          personId,
          trackId,
          progress: 0,
          risk: 'LOW',
        },
      })
      created++
    }
  }

  return created
}

function pickAssigneeId(collabIds: string[], seed: number) {
  if (collabIds.length === 0) return null
  const idx = Math.abs(seed) % collabIds.length
  return collabIds[idx]
}

function shouldHaveAssignee(status: ServiceOrderStatus) {
  return status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'DONE'
}

function startedAtFor(base: Date, status: ServiceOrderStatus) {
  if (status === 'IN_PROGRESS' || status === 'DONE') return addHours(base, -2)
  return null
}

function finishedAtFor(base: Date, status: ServiceOrderStatus) {
  if (status === 'DONE' || status === 'CANCELED') return addHours(base, -1)
  return null
}

async function ensureDemoServiceOrders(orgId: string, actor: { actorUserId: string | null; actorPersonId: string | null }) {
  const customers = await prisma.customer.findMany({
    where: { orgId, active: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })
  if (customers.length === 0) return 0

  const collabs = await prisma.person.findMany({
    where: { orgId, role: 'COLLABORATOR', active: true },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  const collabIds = collabs.map(c => c.id)

  const appts = await prisma.appointment.findMany({
    where: { orgId },
    select: { id: true, customerId: true, startsAt: true, status: true },
    orderBy: { startsAt: 'asc' },
    take: 50,
  })

  const base = seedDayBase()

  const plan: Array<{
    customerIndex: number
    title: string
    status: ServiceOrderStatus
    useAppointment?: boolean
  }> = [
    { customerIndex: 0, title: 'O.S. — Limpeza / execução padrão', status: 'OPEN' },
    { customerIndex: 1, title: 'O.S. — Revisão e checklist', status: 'ASSIGNED' },
    { customerIndex: 2, title: 'O.S. — Atendimento no local', status: 'IN_PROGRESS', useAppointment: true },
    { customerIndex: 0, title: 'O.S. — Finalização + evidência', status: 'DONE', useAppointment: true },
  ]

  function pickAppointmentId(customerId: string, desired: ServiceOrderStatus): string | null {
    const byCustomer = appts.filter(a => a.customerId === customerId)
    if (byCustomer.length === 0) return null

    if (desired === 'DONE') {
      const done = byCustomer.find(a => a.status === 'DONE')
      if (done) return done.id
    }

    if (desired === 'IN_PROGRESS') {
      const ok = byCustomer.find(a => a.status === 'CONFIRMED' || a.status === 'SCHEDULED')
      if (ok) return ok.id
    }

    return byCustomer[0].id
  }

  let created = 0

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i]
    const c = customers[Math.min(p.customerIndex, customers.length - 1)]

    const existing = await prisma.serviceOrder.findFirst({
      where: { orgId, customerId: c.id, title: p.title },
      select: { id: true },
    })
    if (existing) continue

    let appointmentId: string | null = null
    if (p.useAppointment) {
      appointmentId = pickAppointmentId(c.id, p.status)
    }

    const assignedToPersonId =
      shouldHaveAssignee(p.status) ? pickAssigneeId(collabIds, i + p.customerIndex * 10) : null

    const so = await prisma.serviceOrder.create({
      data: {
        orgId,
        customerId: c.id,
        appointmentId,
        assignedToPersonId,
        title: p.title,
        status: p.status,
        priority: 2,

        scheduledFor: appointmentId ? null : addHours(base, 10),

        startedAt: startedAtFor(base, p.status),
        finishedAt: finishedAtFor(base, p.status),
      },
      select: { id: true, title: true, customerId: true, appointmentId: true, assignedToPersonId: true, status: true, priority: true, scheduledFor: true },
    })

    // ✅ Loga timeline igual a API faria
    await prisma.timelineEvent.create({
      data: {
        orgId,
        action: 'SERVICE_ORDER_CREATED',
        personId: actor.actorPersonId, // pode ser null — tudo bem
        description: `O.S. criada (seed): ${so.title} (${c.name})`,
        metadata: {
          serviceOrderId: so.id,
          customerId: so.customerId,
          appointmentId: so.appointmentId,
          assignedToPersonId: so.assignedToPersonId,
          status: so.status,
          priority: so.priority,
          scheduledFor: so.scheduledFor,

          // padrão novo
          actorUserId: actor.actorUserId,
          actorPersonId: actor.actorPersonId,

          // compat legado
          createdBy: actor.actorUserId,

          seed: true,
          seedSource: 'prisma/seed.ts',
        },
      },
    })

    created++
  }

  return created
}

async function main() {
  const seedMode = (process.env.SEED_MODE || 'none').toLowerCase()

  const org = await ensureOrg()

  console.log('✅ Seed institucional aplicado com sucesso')
  console.log('🏢 Organization:', { id: org.id, slug: org.slug, name: org.name })

  if (seedMode !== 'demo') {
    console.log('🌱 Seed DEMO não executado (SEED_MODE!=demo)')
    console.log('➡️ Bootstrap manual disponível: POST /bootstrap/first-admin')
    return
  }

  console.log('🌱 SEED_MODE=demo -> aplicando seed DEMO...')

  const admin = await ensureDemoAdmin(org.id)
  const actor = await getDemoAdminActor(org.id)

  const customersCreated = await ensureDemoCustomers(org.id)
  const appointmentsCreated = await ensureDemoAppointments(org.id)

  const collabs = await ensureDemoCollaborators(org.id)
  const tracks = await ensureDemoTracks(org.id)

  const personIds = collabs.people.map(p => p.id)
  const trackIds = tracks.tracks.map(t => t.id)

  const assignmentsCreated = await ensureDemoAssignments(org.id, personIds, trackIds)
  const serviceOrdersCreated = await ensureDemoServiceOrders(org.id, actor)

  console.log('✅ Seed DEMO aplicado')
  console.log(`👤 Admin DEMO: ${admin.created ? 'CRIADO' : 'JÁ EXISTIA'}`)
  console.log('🔑 Credenciais DEMO:', { email: admin.email, password: admin.password })
  console.log(`👥 Customers DEMO criados agora: ${customersCreated}`)
  console.log(`📅 Appointments DEMO criados agora: ${appointmentsCreated}`)
  console.log(`👥 Collaborators DEMO criados agora: ${collabs.created} (total=${collabs.people.length})`)
  console.log(`📚 Tracks DEMO criadas agora: ${tracks.created} (total=${tracks.tracks.length})`)
  console.log(`🧷 Assignments DEMO criados agora: ${assignmentsCreated}`)
  console.log(`🧾 ServiceOrders DEMO criadas agora: ${serviceOrdersCreated}`)
  console.log('🎯 Seed actor:', actor)
  console.log('🕒 Seed day base:', seedDayBase().toISOString())
}

main()
  .catch((err) => {
    console.error('❌ Seed falhou:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
