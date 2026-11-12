import { ConfigService } from '@nestjs/config'
import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy persisted session validation', () => {
  const user = { id: 'user-a', orgId: 'org-a', role: 'ADMIN', active: true,
    sessionVersion: 3, person: { id: 'person-a', active: true } }
  const payload = { sub: user.id, orgId: user.orgId, role: user.role,
    personId: user.person.id, sessionVersion: 3, exp: 1_900_000_000 }
  const config = { get: (key: string) => key === 'JWT_SECRET' ? 'test-secret' : 'test' } as ConfigService
  const subject = (persisted: any = user) => new JwtStrategy(config,
    { user: { findUnique: jest.fn().mockResolvedValue(persisted) } } as any)

  it('preserves exp and returns the persisted active identity', async () => {
    await expect(subject().validate(payload)).resolves.toEqual({
      sub: user.id, userId: user.id, orgId: user.orgId, role: user.role,
      personId: user.person.id, sessionVersion: user.sessionVersion, exp: payload.exp,
    })
  })
  it.each([
    ['deleted account', null], ['disabled account', { ...user, active: false }],
    ['disabled person', { ...user, person: { ...user.person, active: false } }],
    ['missing person', { ...user, person: null }], ['changed role', { ...user, role: 'VIEWER' }],
    ['changed organization', { ...user, orgId: 'other-org' }],
    ['changed person', { ...user, person: { id: 'other-person', active: true } }],
    ['revoked session', { ...user, sessionVersion: 4 }],
  ])('rejects %s', async (_label, persisted) => {
    await expect(subject(persisted).validate(payload)).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it.each([undefined, null, '3', -1])('rejects legacy or invalid session version %s', async version => {
    await expect(subject().validate({ ...payload, sessionVersion: version })).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
