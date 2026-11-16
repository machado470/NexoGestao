import type { ConfigService } from '@nestjs/config'

// Missing/unknown values retain the existing enabled-by-default contract.
export function isStripeDisabled(config: Pick<ConfigService, 'get'>): boolean {
  return String(config.get('STRIPE_ENABLED') ?? '').trim().toLowerCase() === 'false'
}
