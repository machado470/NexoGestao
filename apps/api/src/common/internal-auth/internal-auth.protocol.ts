import { createHash, createHmac, timingSafeEqual } from 'crypto'

/**
 * C7.2d — BFF → API internal authentication, protocol v1 (verifier side).
 *
 * It proves that a request was produced by a BFF holding a shared key. It does NOT prove who the
 * end user is, nor the end user's IP: user identity remains the JWT, and the client IP remains
 * unverified (NO_TRUST) until C7.2e.
 *
 * Header:   X-Nexo-Internal-Auth: v1.<kid>.<ts>.<nonce>.<sig>
 *   kid     [A-Za-z0-9_-]{1,32}        key id (rotation)
 *   ts      10 digits                   unix time, seconds
 *   nonce   22 chars base64url          16 random bytes, single use
 *   sig     43 chars base64url          HMAC-SHA256 over the canonical string
 *
 * Canonical string (fields cannot contain "\n", so the encoding is unambiguous):
 *   NEXO-INTERNAL-AUTH\nv1\n<kid>\n<ts>\n<nonce>\n<METHOD>\n<request-target>\n<sha256(body) hex>
 *
 * request-target is the path + query exactly as sent on the wire (what Express exposes as
 * `originalUrl`). The body hash binds JSON bodies; an absent body hashes as the empty string.
 *
 * The same canonicalization exists in apps/web/server/_core/internalAuth.ts; both suites check
 * the same known-answer vector so the two sides cannot drift silently.
 */
export const INTERNAL_AUTH_HEADER = 'x-nexo-internal-auth'
export const INTERNAL_AUTH_VERSION = 'v1'
/** Accepted clock skew in either direction. */
export const MAX_CLOCK_SKEW_SECONDS = 30
/** A nonce must outlive every instant at which its header could still be accepted (ts ± skew). */
export const NONCE_TTL_MS = (2 * MAX_CLOCK_SKEW_SECONDS + 30) * 1000
export const MAX_HEADER_LENGTH = 256

const KID = /^[A-Za-z0-9_-]{1,32}$/
const TS = /^\d{10}$/
const NONCE = /^[A-Za-z0-9_-]{22}$/
const SIG = /^[A-Za-z0-9_-]{43}$/
const METHOD = /^[A-Z]{3,7}$/
// Request-target as sent by fetch: starts with "/", printable ASCII without spaces.
const TARGET = /^\/[\x21-\x7e]*$/

export type ParsedInternalAuth = { kid: string; ts: number; nonce: string; sig: string }

export function parseInternalAuthHeader(raw: unknown): ParsedInternalAuth | null {
  if (typeof raw !== 'string' || raw.length > MAX_HEADER_LENGTH) return null
  const parts = raw.split('.')
  if (parts.length !== 5 || parts[0] !== INTERNAL_AUTH_VERSION) return null
  const [, kid, ts, nonce, sig] = parts
  if (!KID.test(kid) || !TS.test(ts) || !NONCE.test(nonce) || !SIG.test(sig)) return null
  return { kid, ts: Number(ts), nonce, sig }
}

export function bodyDigest(body: Buffer | string | null | undefined): string {
  return createHash('sha256').update(body ?? '').digest('hex')
}

export function canonicalString(input: { kid: string; ts: number; nonce: string; method: string; target: string; bodySha256: string }): string | null {
  const method = input.method.toUpperCase()
  const ts = String(input.ts)
  if (!KID.test(input.kid) || !TS.test(ts) || !NONCE.test(input.nonce) || !METHOD.test(method) || !TARGET.test(input.target) || !/^[0-9a-f]{64}$/.test(input.bodySha256)) {
    return null
  }
  return ['NEXO-INTERNAL-AUTH', INTERNAL_AUTH_VERSION, input.kid, ts, input.nonce, method, input.target, input.bodySha256].join('\n')
}

export function computeSignature(key: Buffer, canonical: string): string {
  return createHmac('sha256', key).update(canonical).digest('base64url')
}

/** Constant-time comparison of two base64url signatures (fixed 32-byte digests). */
export function signaturesEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, 'base64url')
  const b = Buffer.from(received, 'base64url')
  if (a.length !== 32 || b.length !== 32) return false
  return timingSafeEqual(a, b)
}
