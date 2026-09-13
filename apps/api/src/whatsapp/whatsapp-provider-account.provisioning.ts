const SUPPORTED_PROVIDERS = new Set(['meta_cloud', 'zapi', 'mock'])

type OrganizationSelector = { orgId: string; orgSlug?: never } | { orgId?: never; orgSlug: string }

export type ProvisionWhatsAppProviderAccountInput = OrganizationSelector & {
  provider: string
  accountId: string
}

type ProvisioningPrisma = {
  organization: {
    findUnique(args: unknown): Promise<{ id: string } | null>
  }
  whatsAppProviderAccount: {
    upsert(args: unknown): Promise<{ id: string; orgId: string; provider: string; accountId: string; active: boolean }>
  }
}

export class WhatsAppProviderAccountProvisioningError extends Error {}

function required(value: string | undefined, label: string) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new WhatsAppProviderAccountProvisioningError(`${label} é obrigatório`)
  return normalized
}

/**
 * Provisions an inbound account from trusted administrative configuration only.
 * The empty update makes reruns idempotent without ever changing ownership.
 */
export async function provisionWhatsAppProviderAccount(
  prisma: ProvisioningPrisma,
  input: ProvisionWhatsAppProviderAccountInput,
) {
  const provider = required(input.provider, 'provider').toLowerCase()
  const accountId = required(input.accountId, 'accountId')
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new WhatsAppProviderAccountProvisioningError(`provider inválido: ${provider}`)
  }

  const orgIdInput = String(input.orgId ?? '').trim()
  const orgSlug = String(input.orgSlug ?? '').trim()
  if ((!orgIdInput && !orgSlug) || (orgIdInput && orgSlug)) {
    throw new WhatsAppProviderAccountProvisioningError('informe exatamente um de orgId ou orgSlug')
  }

  const organization = await prisma.organization.findUnique({
    where: orgIdInput ? { id: orgIdInput } : { slug: orgSlug },
    select: { id: true },
  })
  if (!organization) throw new WhatsAppProviderAccountProvisioningError('organização não encontrada')

  const account = await prisma.whatsAppProviderAccount.upsert({
    where: { provider_accountId: { provider, accountId } },
    update: {},
    create: { orgId: organization.id, provider, accountId, active: true },
    select: { id: true, orgId: true, provider: true, accountId: true, active: true },
  })

  if (account.orgId !== organization.id) {
    throw new WhatsAppProviderAccountProvisioningError(
      `conflito de ownership: ${provider}/${accountId} já pertence a outra organização`,
    )
  }
  return account
}
