import { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'
import { seedDemoOrg } from './seed-demo-org'

const require = createRequire(import.meta.url)
const bcrypt = require('../apps/api/node_modules/bcryptjs')

const prisma = new PrismaClient()

function env(name: string, fallback = ''): string {
  const v = (process.env[name] ?? '').trim()
  return v || fallback
}

async function ensureDefaultAdmin() {
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {
      name: 'NexoGestão',
      requiresOnboarding: false,
    },
    create: {
      name: 'NexoGestão',
      slug: 'default',
      requiresOnboarding: false,
    },
  })

  const email = env('DEMO_ADMIN_EMAIL', 'admin@nexogestao.local').toLowerCase()
  const password = env('DEMO_ADMIN_PASSWORD', 'Admin@123456')
  const name = env('DEMO_ADMIN_NAME', 'Admin')

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: 'ADMIN',
        active: true,
        orgId: org.id,
      },
    })

    await prisma.person.create({
      data: {
        name,
        email,
        role: 'ADMIN',
        active: true,
        orgId: org.id,
        userId: user.id,
      },
    })
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      requiresOnboarding: false,
    },
  })

  return org
}

async function runDemoOrgSeed() {
  const org = await ensureDefaultAdmin()

  const user = await prisma.user.findFirst({
    where: { orgId: org.id, role: 'ADMIN' },
    select: { id: true },
  })

  await seedDemoOrg(org.id, user?.id ?? null)
  console.log('Seed demo-org finalizado')
}

async function runBasicSeed() {
  await ensureDefaultAdmin()
  console.log('Seed básico finalizado')
}

async function main() {
  const seedMode = env('SEED_MODE', 'basic').toLowerCase()

  if (seedMode === 'demo' || seedMode === 'demo-org') {
    await runDemoOrgSeed()
    return
  }

  await runBasicSeed()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
