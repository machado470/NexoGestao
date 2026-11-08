import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createPublicKey, verify, JsonWebKey } from 'crypto'
import { readGoogleOAuthEnv } from '../common/config/google-oauth-env'

type GoogleKey = JsonWebKey & { kid: string; alg?: string; use?: string }

@Injectable()
export class GoogleIdTokenVerifier {
  private keys: GoogleKey[] = []
  private keysExpireAt = 0
  private loading?: Promise<void>

  constructor(private readonly config: ConfigService) {}

  private async loadKeys() {
    if (!this.loading) {
      this.loading = (async () => {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
          signal: AbortSignal.timeout(5000), redirect: 'error',
        })
        if (!response.ok) throw new Error('Google signing keys unavailable')
        const jwks = await response.json() as { keys?: GoogleKey[] }
        if (!Array.isArray(jwks.keys) || !jwks.keys.length) throw new Error('Invalid Google JWKS')
        this.keys = jwks.keys
        this.keysExpireAt = Date.now() + 60 * 60 * 1000
      })().finally(() => { this.loading = undefined })
    }
    await this.loading
  }

  async verify(idToken: string) {
    const clientId = readGoogleOAuthEnv(this.config).clientId
    if (!clientId) throw new ServiceUnavailableException('Login Google não configurado.')
    if (typeof idToken !== 'string' || idToken.length > 16384) {
      throw new UnauthorizedException('Credencial Google inválida.')
    }
    try {
      const parts = idToken.split('.')
      if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid JWT')
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
      if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid JWT header')
      if (this.keysExpireAt <= Date.now()) await this.loadKeys()
      const key = this.keys.find(k => k.kid === header.kid && k.kty === 'RSA' &&
        (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'))
      if (!key || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) {
        throw new Error('Invalid signature')
      }
      const now = Math.floor(Date.now() / 1000)
      if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
          claims.aud !== clientId || (claims.azp !== undefined && claims.azp !== clientId) ||
          !Number.isFinite(claims.exp) || claims.exp <= now ||
          !Number.isFinite(claims.iat) || claims.iat > now + 60 ||
          (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
          typeof claims.sub !== 'string' || !claims.sub ||
          typeof claims.email !== 'string' || !claims.email.trim() || claims.email_verified !== true) {
        throw new Error('Invalid claims')
      }
      return { email: claims.email, sub: claims.sub, emailVerified: true }
    } catch {
      throw new UnauthorizedException('Credencial Google inválida ou expirada.')
    }
  }
}
