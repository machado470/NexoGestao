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
  const org = await prisma.organization.findFirst()

  if (!org) {
    throw new Error(
      'Organização não encontrada. Rode o seed base primeiro.',
    )
  }

  await prisma.person.createMany({
    data: [
      { name: 'Ana Silva', orgId: org.id, active: true, role: 'STAFF' },
      { name: 'Bruno Costa', orgId: org.id, active: true, role: 'STAFF' },
      { name: 'Carla Mendes', orgId: org.id, active: true, role: 'STAFF' },
      { name: 'Diego Rocha', orgId: org.id, active: true, role: 'STAFF' },
      { name: 'Eduarda Lima', orgId: org.id, active: true, role: 'STAFF' },
      { name: 'Felipe Alves', orgId: org.id, active: true, role: 'STAFF' },
    ],
  })

  const persons = await prisma.person.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: 'asc' },
  })

  await prisma.correctiveAction.create({
    data: {
      status: 'DONE',
      reason: 'Falha grave em procedimento interno',
      createdAt: hoursAgo(96),
      resolvedAt: hoursAgo(48),
      person: { connect: { id: persons[0].id } },
    },
  })

  await prisma.correctiveAction.create({
    data: {
      status: 'DONE',
      reason: 'Atraso pontual em entrega de evidência',
      createdAt: hoursAgo(48),
      resolvedAt: hoursAgo(24),
      person: { connect: { id: persons[1].id } },
    },
  })

  await prisma.correctiveAction.create({
    data: {
      status: 'OPEN',
      reason: 'Checklist obrigatório incompleto',
      createdAt: hoursAgo(36),
      person: { connect: { id: persons[2].id } },
    },
  })

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
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
