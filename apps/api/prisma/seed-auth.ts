import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('▶️ Seed AUTH iniciado')

  const password = await bcrypt.hash('123456', 10)

  await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {
      password,
      active: true,
    },
    create: {
      email: 'admin@demo.com',
      password,
      role: UserRole.ADMIN,
      active: true,
    },
  })

  console.log('✅ Usuário ADMIN criado e ATIVO')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
