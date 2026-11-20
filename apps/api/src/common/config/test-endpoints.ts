export const ENABLE_TEST_ENDPOINTS_ENV = 'ENABLE_TEST_ENDPOINTS'

// Only these explicit, non-production runtimes may expose test endpoints. An unset or unknown
// NODE_ENV is treated as production-like so a misconfigured deploy fails closed.
const NON_PRODUCTION_NODE_ENVS = new Set(['development', 'test', 'staging'])
const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

/**
 * Test endpoints (e.g. /whatsapp/test/*) are registered only when ALL of these hold:
 * - ENABLE_TEST_ENDPOINTS is explicitly truthy (default: disabled);
 * - NODE_ENV is development, test or staging (production, unset or unknown => disabled);
 * - the Railway environment is not named "production" (extra guard if NODE_ENV is wrong).
 */
export function areTestEndpointsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = String(env[ENABLE_TEST_ENDPOINTS_ENV] ?? '').trim().toLowerCase()
  if (!TRUTHY.has(flag)) return false

  const nodeEnv = String(env.NODE_ENV ?? '').trim().toLowerCase()
  if (!NON_PRODUCTION_NODE_ENVS.has(nodeEnv)) return false

  const railwayEnvironment = String(env.RAILWAY_ENVIRONMENT_NAME ?? env.RAILWAY_ENVIRONMENT ?? '').trim().toLowerCase()
  if (railwayEnvironment === 'production') return false

  return true
}
