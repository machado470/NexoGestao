/*
 Seed executivo de DEMO
 100% compatível com o schema real (FINAL)
*/

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function hoursAgo(h: number) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d
}

async function main() {
  // 1️⃣ Organização base
  const org = await prisma.organization.findFirst()
  if (!org) {
    throw new Error(
      'Organização não encontrada. Rode o seed base primeiro.',
    )
  }

  // 2️⃣ Pessoas (campos obrigatórios)
  await prisma.person.createMany({
    data: [
      { name: 'Ana Silva', orgId: org.id, active: true, role: 'COLLABORATOR' },
      { name: 'Bruno Costa', orgId: org.id, active: true, role: 'COLLABORATOR' },
      { name: 'Carla Mendes', orgId: org.id, active: true, role: 'COLLABORATOR' },
      { name: 'Diego Rocha', orgId: org.id, active: true, role: 'COLLABORATOR' },
      { name: 'Eduarda Lima', orgId: org.id, active: true, role: 'COLLABORATOR' },
      { name: 'Felipe Alves', orgId: org.id, active: true, role: 'COLLABORATOR' },
    ],
  })

  const persons = await prisma.person.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: 'asc' },
  })

  // 3️⃣ Ações corretivas (reason é OBRIGATÓRIO)

  // DONE — histórico crítico
  await prisma.correctiveAction.create({
    data: {
      status: 'DONE',
      reason: 'Falha grave em procedimento interno',
      createdAt: hoursAgo(96),
      resolvedAt: hoursAgo(48),
      person: { connect: { id: persons[0].id } },
    },
  })

  // DONE — resolveu mais rápido
  await prisma.correctiveAction.create({
    data: {
      status: 'DONE',
      reason: 'Atraso pontual em entrega de evidência',
      createdAt: hoursAgo(48),
      resolvedAt: hoursAgo(24),
      person: { connect: { id: persons[1].id } },
    },
  })

  // OPEN — ainda em regime corretivo
  await prisma.correctiveAction.create({
    data: {
      status: 'OPEN',
      reason: 'Checklist obrigatório incompleto',
      createdAt: hoursAgo(36),
      person: { connect: { id: persons[2].id } },
    },
  })

  // AWAITING_REASSESSMENT — resolvida, aguardando sistema
  await prisma.correctiveAction.create({
    data: {
      status: 'AWAITING_REASSESSMENT',
      reason: 'Procedimento desatualizado identificado',
      createdAt: hoursAgo(72),
      resolvedAt: hoursAgo(24),
      person: { connect: { id: persons[3].id } },
    },
  })

  console.log('✅ Seed executivo de DEMO aplicado com sucesso')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
