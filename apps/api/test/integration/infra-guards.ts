function asBool(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const RUN_REAL_INTEGRATION = asBool(process.env.RUN_REAL_INTEGRATION)

export const REAL_INTEGRATION_SKIP_REASON =
  'Real integration/e2e tests are disabled. Set RUN_REAL_INTEGRATION=true and provide Postgres/Redis infrastructure.'

export const describeRealIntegration = RUN_REAL_INTEGRATION ? describe : describe.skip
