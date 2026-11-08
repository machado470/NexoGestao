import { applySessionRevocation } from './session-revocation'

describe('Atomic User session revocation policy', () => {
  it.each(['active', 'role', 'password', 'orgId'])('revokes when %s changes, including Prisma field operations', field => {
    const params = { model: 'User', action: 'update', args: { data: { [field]: { set: 'test' } } } } as any
    applySessionRevocation(params)
    expect(params.args.data.sessionVersion).toEqual({ increment: 1 })
  })
  it.each(['updateMany', 'upsert'])('covers %s without double-incrementing an explicit password revocation', action => {
    const data = { password: 'new-hash', sessionVersion: { increment: 1 } }
    const params = { model: 'User', action, args: action === 'upsert' ? { update: data } : { data } } as any
    applySessionRevocation(params)
    expect(data.sessionVersion).toEqual({ increment: 1 })
  })
  it('does not revoke sessions for unrelated profile or reset-token updates', () => {
    const params = { model: 'User', action: 'update', args: { data: { emailVerifyTokenHash: 'hash', resetToken: 'hash' } } } as any
    applySessionRevocation(params)
    expect(params.args.data.sessionVersion).toBeUndefined()
  })
  it('does not affect new users or another model', () => {
    for (const [model, action] of [['User', 'create'], ['Person', 'update']]) {
      const params = { model, action, args: { data: { active: true } } } as any
      applySessionRevocation(params)
      expect(params.args.data.sessionVersion).toBeUndefined()
    }
  })
})
