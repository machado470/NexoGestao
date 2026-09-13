import { shutdownTracing, startTracing } from './tracing'

describe('OpenTelemetry lifecycle', () => {
  const originalEnabled = process.env.OTEL_ENABLED

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.OTEL_ENABLED
    else process.env.OTEL_ENABLED = originalEnabled
  })

  it('is a no-op when OTEL is disabled', async () => {
    process.env.OTEL_ENABLED = 'false'
    await expect(startTracing()).resolves.toBe(false)
  })

  it('keeps shutdown idempotent when the SDK was not started', async () => {
    await expect(shutdownTracing()).resolves.toBeUndefined()
    await expect(shutdownTracing()).resolves.toBeUndefined()
  })
})
