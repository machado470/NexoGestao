import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10)

  await prisma.user.upsert({
    where: { email: 'aluno@jurisflow.com' },
    update: {},
    create: {
      name: 'Aluno Jurídico',
      email: 'aluno@jurisflow.com',
      passwordHash,
      role: Role.STUDENT,
      isActive: true,
    },
  })

  console.log('👨‍⚖️ Usuário STUDENT criado com sucesso')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
