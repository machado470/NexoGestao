import type { ProvisionWhatsAppProviderAccountInput } from './whatsapp-provider-account.provisioning'

function argument(args: string[], name: string) {
  const index = args.indexOf(`--${name}`)
  const value = index >= 0 ? args[index + 1] : undefined
  return value && !value.startsWith('--') ? value.trim() : ''
}

export function parseProvisionWhatsAppProviderAccountArgs(
  args: string[],
): ProvisionWhatsAppProviderAccountInput {
  const provider = argument(args, 'provider')
  const accountId = argument(args, 'account-id')
  const orgId = argument(args, 'org-id')
  const orgSlug = argument(args, 'org-slug')

  if (!provider) throw new Error('provider é obrigatório')
  if (!accountId) throw new Error('account-id é obrigatório')
  if ((!orgId && !orgSlug) || (orgId && orgSlug)) {
    throw new Error('informe exatamente um de org-id ou org-slug')
  }

  return orgId
    ? { provider, accountId, orgId }
    : { provider, accountId, orgSlug }
}
