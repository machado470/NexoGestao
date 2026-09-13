import { PrismaClient } from '@prisma/client'
import { parseProvisionWhatsAppProviderAccountArgs } from '../apps/api/src/whatsapp/whatsapp-provider-account.cli'
import { provisionWhatsAppProviderAccount } from '../apps/api/src/whatsapp/whatsapp-provider-account.provisioning'

async function main() {
  const input = parseProvisionWhatsAppProviderAccountArgs(process.argv.slice(2))
  const prisma = new PrismaClient()
  try {
    const account = await provisionWhatsAppProviderAccount(prisma, input)
    console.log(`Associação confirmada: ${account.provider}/${account.accountId} -> ${account.orgId}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`Falha ao provisionar conta WhatsApp: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
