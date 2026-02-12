import { PrismaClient, RiskLevel } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('▶️ Seed DEMO iniciado')

  /**
   * Limpeza controlada
   * Apenas domínio atual (JurisFlow)
   */
  await prisma.auditEvent.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.track.deleteMany()
  await prisma.person.deleteMany()

  /**
   * Pessoas
   */
  const ana = await prisma.person.create({
    data: {
      name: 'Ana Souza',
      email: 'ana@demo.com',
      role: 'ADVOGADA',
    },
  })

  const bruno = await prisma.person.create({
    data: {
      name: 'Bruno Lima',
      email: 'bruno@demo.com',
      role: 'ADVOGADO',
    },
  })

  const carla = await prisma.person.create({
    data: {
      name: 'Carla Mendes',
      email: 'carla@demo.com',
      role: 'ESTAGIÁRIA',
    },
  })

  /**
   * Trilhas
   */
  const lgpd = await prisma.track.create({
    data: {
      slug: 'lgpd',
      title: 'LGPD na Prática',
      description: 'Conformidade e boas práticas',
    },
  })

  const etica = await prisma.track.create({
    data: {
      slug: 'etica',
      title: 'Ética Profissional',
      description: 'Conduta e responsabilidades',
    },
  })

  /**
   * Assignments (fonte real de risco)
   */
  await prisma.assignment.create({
    data: {
      personId: ana.id,
      trackId: lgpd.id,
      progress: 85,
      risk: RiskLevel.LOW,
    },
  })

  await prisma.assignment.create({
    data: {
      personId: bruno.id,
      trackId: etica.id,
      progress: 45,
      risk: RiskLevel.HIGH,
    },
  })

  await prisma.assignment.create({
    data: {
      personId: carla.id,
      trackId: lgpd.id,
      progress: 15,
      risk: RiskLevel.CRITICAL,
    },
  })

  /**
   * Auditoria (alinhada ao schema)
   */
  await prisma.auditEvent.createMany({
    data: [
      {
        personId: bruno.id,
        action: 'RISK_HIGH',
        context: 'Progresso abaixo do esperado',
      },
      {
        personId: carla.id,
        action: 'RISK_CRITICAL',
        context: 'Treinamento crítico não iniciado',
      },
    ],
  })

  console.log('✅ Seed DEMO concluído com sucesso')
}

main()
  .catch(err => {
    console.error('❌ Seed DEMO falhou:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
