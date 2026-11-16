import { SentryService } from './sentry.service'
import * as Sentry from '@sentry/node'

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn().mockReturnValue('local-event-id'),
  withScope: jest.fn(callback => callback({ setExtras: jest.fn() })),
  setUser: jest.fn(), setTag: jest.fn(), captureMessage: jest.fn(),
}))
jest.mock('@sentry/profiling-node', () => ({ nodeProfilingIntegration: jest.fn(() => ({ name: 'ProfilingIntegration' })) }))

describe('Sentry integration after SDK 10 migration', () => {
  const service = (dsn?: string) => new SentryService({ get: (key: string, fallback?: string) => key === 'SENTRY_DSN' ? dsn : fallback } as any)
  beforeEach(() => jest.clearAllMocks())

  it('remains disabled without configuration', async () => {
    const subject = service()
    await subject.onModuleInit()
    expect(subject.isInitialized).toBe(false)
    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('initializes profiling and preserves credential redaction and error context', async () => {
    const subject = service('https://public@example.invalid/1')
    await subject.onModuleInit()
    const options = (Sentry.init as jest.Mock).mock.calls[0][0]
    expect(options.integrations).toEqual([{ name: 'ProfilingIntegration' }])
    expect(options.profilesSampleRate).toBe(0.1)
    const event = { request: { headers: { authorization: 'private', cookie: 'private', 'x-request-id': 'request-id' } } }
    expect(options.beforeSend(event)).toEqual({ request: { headers: { 'x-request-id': 'request-id' } } })
    const error = new Error('local-test')
    expect(subject.captureException(error, { route: '/test' })).toBe('local-event-id')
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
    expect(subject.isInitialized).toBe(true)
  })

  it('does not mark a failed SDK initialization as active', async () => {
    ;(Sentry.init as jest.Mock).mockImplementationOnce(() => { throw new Error('SDK unavailable') })
    const subject = service('https://public@example.invalid/1')
    await subject.onModuleInit()
    expect(subject.isInitialized).toBe(false)
    expect(subject.captureException(new Error('not sent'))).toBeUndefined()
  })
})
