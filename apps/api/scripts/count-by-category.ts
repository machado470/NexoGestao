import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const map = { 1: 'sinalizacao', 2: 'direcao-defensiva', 3: 'mecanica' } as const

async function main() {
  for (const id of Object.keys(map).map(Number)) {
    const total = await prisma.question.count({ where: { categoryId: id } })
    console.log(`cat ${id} (${map[id]}): ${total}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
