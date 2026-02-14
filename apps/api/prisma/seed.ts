import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed institucional mínimo:
  // - cria uma organização padrão idempotente
  // - NÃO cria users/persons/tracks demo
  // - criação de admin deve ser feita via /bootstrap/first-admin

  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'NexoGestão',
      slug: 'default',
      requiresOnboarding: true,
    },
  })

  console.log('✅ Seed institucional aplicado com sucesso')
  console.log('🏢 Organization:', { id: org.id, slug: org.slug, name: org.name })
  console.log('➡️ Crie o primeiro admin via POST /bootstrap/first-admin')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
