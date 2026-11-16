import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common'
import { AuthService } from './auth.service'

describe('Auth email delivery and public account privacy', () => {
  function fixture(configured = true) {
    const user = { id: 'user', orgId: 'org', email: 'known@test.invalid', role: 'ADMIN', emailVerifiedAt: null, person: { id: 'person' } }
    const prisma: any = {
      organization: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'org' }) },
      user: { findUnique: jest.fn(async ({ where }) => where.email === user.email ? user : null), create: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue(user) },
    }
    prisma.$transaction = jest.fn(fn => fn(prisma))
    const jwt = { sign: jest.fn() }
    const service = new AuthService(prisma, jwt as any, {} as any, { get: key => key === 'AUTH_ENFORCE_EMAIL_VERIFICATION' ? 'true' : undefined } as any)
    const send = jest.fn().mockResolvedValue({ data: { id: 'email' }, error: null })
    if (configured) (service as any).resend = { emails: { send } }
    return { service, prisma, send, jwt }
  }
  const registration = { orgName: 'Audit', adminName: 'Admin', email: 'new@test.invalid', password: 'Password123!' }
  let errors: jest.SpyInstance
  beforeEach(() => { errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}) })
  afterEach(() => jest.restoreAllMocks())

  it.each([
    ['provider rejection', { data: null, error: { message: 'sensitive provider response' } }, 'failed'],
    ['missing receipt', { data: null, error: null }, 'failed'],
    ['confirmed acceptance', { data: { id: 'email' }, error: null }, 'sent'],
  ])('reports registration delivery accurately after %s', async (_label, result, status) => {
    const { service, send, prisma, jwt } = fixture()
    send.mockResolvedValue(result)
    const response = await service.register(registration)
    expect(response.emailVerificationStatus).toBe(status)
    expect(prisma.organization.create).toHaveBeenCalledTimes(1)
    expect(jwt.sign).not.toHaveBeenCalled()
    expect(response).not.toHaveProperty('token')
    expect(JSON.stringify(response)).not.toContain('sensitive provider response')
  })
  it('keeps the created account and reports failed on a thrown provider error', async () => {
    const { service, send, prisma } = fixture()
    send.mockRejectedValue(new Error('private-token-in-provider-error'))
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
    expect((await service.register(registration)).emailVerificationStatus).toBe('failed')
    expect(prisma.user.create).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private-token-in-provider-error')
  })
  it('reports unavailable registration delivery when no provider is configured', async () => {
    const { service, send } = fixture(false)
    expect((await service.register(registration)).emailVerificationStatus).toBe('provider_unavailable')
    expect(send).not.toHaveBeenCalled()
  })
  it('rejects a malformed direct registration call as a controlled input error', async () => {
    const { service, prisma } = fixture()
    await expect(service.register({ ...registration, orgName: 123 } as any)).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.organization.create).not.toHaveBeenCalled()
  })

  describe.each(['forgotPassword', 'resendEmailVerification'] as const)('%s', method => {
    it('returns the same global unavailability for known and unknown accounts without querying users', async () => {
      const { service, prisma } = fixture(false)
      const responses: unknown[] = []
      for (const email of ['known@test.invalid', 'unknown@test.invalid']) {
        try { await service[method](email); throw new Error('expected unavailable') }
        catch (error) { expect(error).toBeInstanceOf(ServiceUnavailableException); responses.push(error.getResponse()) }
      }
      expect(responses[0]).toEqual(responses[1])
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })
    it('keeps token-persistence failures private as well', async () => {
      const { service, prisma, send } = fixture()
      prisma.user.update.mockRejectedValue(new Error('private persistence error'))
      expect(await service[method]('known@test.invalid')).toEqual(await service[method]('unknown@test.invalid'))
      expect(send).not.toHaveBeenCalled()
      expect(errors).toHaveBeenCalled()
    })
    it.each(['resolved rejection', 'thrown error', 'acceptance'])('does not disclose account existence on %s', async outcome => {
      const { service, send, prisma } = fixture()
      if (outcome === 'resolved rejection') send.mockResolvedValue({ data: null, error: { message: 'private provider payload' } })
      if (outcome === 'thrown error') send.mockRejectedValue(new Error('private provider payload'))
      const known = await service[method](' Known@Test.Invalid ')
      const unknown = await service[method]('unknown@test.invalid')
      expect(known).toEqual(unknown)
      expect(known.message).toContain('Solicitação recebida')
      expect(known.message).not.toContain('enviado')
      expect(send).toHaveBeenCalledTimes(1)
      expect(prisma.user.update).toHaveBeenCalledTimes(1)
      if (outcome !== 'acceptance') expect(errors).toHaveBeenCalled()
      expect(JSON.stringify(errors.mock.calls)).not.toContain('private provider payload')
    })
  })
  it('returns the same acknowledgement for verified and absent accounts without sending', async () => {
    const { service, prisma, send } = fixture()
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user', emailVerifiedAt: new Date() }).mockResolvedValueOnce(null)
    expect(await service.resendEmailVerification('known@test.invalid')).toEqual(await service.resendEmailVerification('unknown@test.invalid'))
    expect(send).not.toHaveBeenCalled()
  })
})
