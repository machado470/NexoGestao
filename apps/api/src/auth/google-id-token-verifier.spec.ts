import { generateKeyPairSync, sign } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { UnauthorizedException } from '@nestjs/common'
import { GoogleIdTokenVerifier } from './google-id-token-verifier'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const claims = () => ({ iss: 'https://accounts.google.com', aud: 'test-client', sub: 'google-sub',
  email: 'admin@example.invalid', email_verified: true,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })
const token = (overrides = {}, header = {}) => {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', ...header })).toString('base64url')
  const p = Buffer.from(JSON.stringify({ ...claims(), ...overrides })).toString('base64url')
  return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`
}
describe('GoogleIdTokenVerifier', () => {
  let fetchMock: jest.SpyInstance
  let verifier: GoogleIdTokenVerifier
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true,
      json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key' }] }),
    } as Response)
    verifier = new GoogleIdTokenVerifier({ get: (key: string) => key === 'GOOGLE_CLIENT_ID' ? 'test-client' : undefined } as ConfigService)
  })
  afterEach(() => jest.restoreAllMocks())
  it('accepts a signed verified identity and caches Google keys', async () => {
    await expect(verifier.verify(token())).resolves.toEqual({ email: 'admin@example.invalid', sub: 'google-sub', emailVerified: true })
    await verifier.verify(token())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each([{ aud: 'attacker' }, { azp: 'attacker' }, { iss: 'https://attacker.invalid' },
    { exp: 0 }, { iat: Math.floor(Date.now() / 1000) + 3600 }, { email_verified: false },
    { email_verified: undefined }, { sub: '' }, { nbf: Math.floor(Date.now() / 1000) + 3600 },
  ])('rejects invalid claims %j', async override => {
    await expect(verifier.verify(token(override))).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it.each([{ alg: 'none' }, { alg: 'HS256' }, { kid: 'unknown' }])('rejects invalid signing header %j', async header => {
    await expect(verifier.verify(token({}, header))).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it('rejects forged signatures and a plain email', async () => {
    const signed = token()
    await expect(verifier.verify(signed.slice(0, signed.lastIndexOf('.') + 1) + Buffer.alloc(256).toString('base64url'))).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(verifier.verify('admin@example.invalid')).rejects.toBeInstanceOf(UnauthorizedException)
  })
  it('fails closed on unavailable Google keys', async () => {
    fetchMock.mockRejectedValue(new Error('unavailable'))
    await expect(verifier.verify(token())).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
