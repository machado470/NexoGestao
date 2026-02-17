import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function env(name: string, fallback = ''): string {
  const v = (process.env[name] ?? '').trim()
  return v || fallback
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
  const customersCreated = await ensureDemoCustomers(org.id)

  const collabs = await ensureDemoCollaborators(org.id)
  const tracks = await ensureDemoTracks(org.id)

  const personIds = collabs.people.map(p => p.id)
  const trackIds = tracks.tracks.map(t => t.id)

  const assignmentsCreated = await ensureDemoAssignments(org.id, personIds, trackIds)

  console.log('✅ Seed DEMO aplicado')
  console.log(`👤 Admin DEMO: ${admin.created ? 'CRIADO' : 'JÁ EXISTIA'}`)
  console.log('🔑 Credenciais DEMO:', { email: admin.email, password: admin.password })
  console.log(`👥 Customers DEMO criados agora: ${customersCreated}`)
  console.log(`👥 Collaborators DEMO criados agora: ${collabs.created} (total=${collabs.people.length})`)
  console.log(`📚 Tracks DEMO criadas agora: ${tracks.created} (total=${tracks.tracks.length})`)
  console.log(`🧷 Assignments DEMO criados agora: ${assignmentsCreated}`)
}

main()
  .catch((err) => {
    console.error('❌ Seed falhou:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
