import { PrismaClient } from '@prisma/client'
import { provisionWhatsAppProviderAccount } from '../apps/api/src/whatsapp/whatsapp-provider-account.provisioning'

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const provider = argument('provider')
  const accountId = argument('account-id')
  const orgId = argument('org-id')
  const orgSlug = argument('org-slug')
  const prisma = new PrismaClient()
  try {
    const account = await provisionWhatsAppProviderAccount(prisma, {
      provider: provider ?? '',
      accountId: accountId ?? '',
      ...(orgId ? { orgId } : { orgSlug: orgSlug ?? '' }),
    })
    console.log(`Associação confirmada: ${account.provider}/${account.accountId} -> ${account.orgId}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`Falha ao provisionar conta WhatsApp: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
