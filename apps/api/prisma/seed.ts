import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function rebuildAllAssignmentProgress() {
  const assignments = await prisma.assignment.findMany({
    select: { id: true, trackId: true },
  })

  for (const a of assignments) {
    const totalItems = await prisma.trackItem.count({
      where: { trackId: a.trackId },
    })

    if (totalItems === 0) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: { progress: 0 },
      })
      continue
    }

    const completedCount = await prisma.trackItemCompletion.count({
      where: { assignmentId: a.id },
    })

    const progress = Math.round((completedCount / totalItems) * 100)

    await prisma.assignment.update({
      where: { id: a.id },
      data: { progress },
    })
  }
}

async function main() {
  const passwordHash = await bcrypt.hash('demo', 10)

  // ============================
  // ORGANIZATION (IDEMPOTENTE)
  // ============================
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {
      requiresOnboarding: false,
    },
    create: {
      name: 'Organização Demo',
      slug: 'demo-org',
      requiresOnboarding: false,
    },
  })

  // ============================
  // ADMIN USER + PERSON
  // ============================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {
      password: passwordHash,
      active: true,
      role: 'ADMIN',
      orgId: org.id,
    },
    create: {
      email: 'admin@demo.com',
      password: passwordHash,
      role: 'ADMIN',
      active: true,
      orgId: org.id,
    },
  })

  await prisma.person.upsert({
    where: { userId: adminUser.id },
    update: {
      orgId: org.id,
      active: true,
      role: 'ADMIN',
    },
    create: {
      name: 'Admin Demo',
      role: 'ADMIN',
      active: true,
      orgId: org.id,
      userId: adminUser.id,
    },
  })

  // ============================
  // COLLAB USER + PERSON
  // ============================
  const collabUser = await prisma.user.upsert({
    where: { email: 'collab@demo.com' },
    update: {
      password: passwordHash,
      active: true,
      role: 'COLLABORATOR',
      orgId: org.id,
    },
    create: {
      email: 'collab@demo.com',
      password: passwordHash,
      role: 'COLLABORATOR',
      active: true,
      orgId: org.id,
    },
  })

  const collabPerson = await prisma.person.upsert({
    where: { userId: collabUser.id },
    update: {
      orgId: org.id,
      active: true,
      role: 'COLLABORATOR',
    },
    create: {
      name: 'Colaborador Demo',
      role: 'COLLABORATOR',
      active: true,
      orgId: org.id,
      userId: collabUser.id,
    },
  })

  // ============================
  // TRACK (DRAFT -> ITENS -> ACTIVE)
  // ============================
  const track = await prisma.track.upsert({
    where: {
      slug_version_orgId: {
        slug: 'trilha-governanca-operacional',
        version: 1,
        orgId: org.id,
      },
    },
    update: {
      title: 'Trilha de Governança Operacional',
      status: 'DRAFT',
      orgId: org.id,
    },
    create: {
      title: 'Trilha de Governança Operacional',
      slug: 'trilha-governanca-operacional',
      version: 1,
      status: 'DRAFT',
      orgId: org.id,
    },
  })

  // ============================
  // TRACK ITEMS (IDEMPOTENTE via (trackId, order))
  // ============================
  await prisma.trackItem.upsert({
    where: { trackId_order: { trackId: track.id, order: 1 } },
    update: {
      title: 'Leitura: Visão geral do sistema',
      content: 'Entenda o ciclo operacional: trilha → itens → conclusão → avaliação → risco.',
      type: 'READING',
    },
    create: {
      trackId: track.id,
      title: 'Leitura: Visão geral do sistema',
      content: 'Entenda o ciclo operacional: trilha → itens → conclusão → avaliação → risco.',
      type: 'READING',
      order: 1,
    },
  })

  await prisma.trackItem.upsert({
    where: { trackId_order: { trackId: track.id, order: 2 } },
    update: {
      title: 'Ação: Confirmar entendimento',
      content: 'Marque como concluído após ler e entender a trilha.',
      type: 'ACTION',
    },
    create: {
      trackId: track.id,
      title: 'Ação: Confirmar entendimento',
      content: 'Marque como concluído após ler e entender a trilha.',
      type: 'ACTION',
      order: 2,
    },
  })

  await prisma.trackItem.upsert({
    where: { trackId_order: { trackId: track.id, order: 3 } },
    update: {
      title: 'Checkpoint: Pronto para avaliação',
      content: 'Você concluiu os itens e está apto para a avaliação.',
      type: 'CHECKPOINT',
    },
    create: {
      trackId: track.id,
      title: 'Checkpoint: Pronto para avaliação',
      content: 'Você concluiu os itens e está apto para a avaliação.',
      type: 'CHECKPOINT',
      order: 3,
    },
  })

  // Publicar (depois de ter itens)
  await prisma.track.update({
    where: { id: track.id },
    data: { status: 'ACTIVE' },
  })

  // ============================
  // ASSIGNMENT (idempotente)
  // - NÃO zera progress no update (pra não descolar de completions)
  // ============================
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 10)

  await prisma.assignment.upsert({
    where: {
      personId_trackId: {
        personId: collabPerson.id,
        trackId: track.id,
      },
    },
    update: {
      createdAt: pastDate,
    },
    create: {
      personId: collabPerson.id,
      trackId: track.id,
      progress: 0,
      createdAt: pastDate,
    },
  })

  // ✅ Rebuild progress com base nas completions (fonte de verdade)
  await rebuildAllAssignmentProgress()

  console.log('✅ Seed DEMO aplicado com sucesso')
  console.log('👤 admin@demo.com / demo')
  console.log('👤 collab@demo.com / demo')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
