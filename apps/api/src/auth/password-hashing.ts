import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'

/** Cost used by every bcrypt.hash call in the API (register, reset, invites, bootstrap, seeds). */
export const BCRYPT_ROUNDS = 10

let dummyHash: Promise<string> | null = null

/**
 * Hash compared when the account (or pending invite) does not exist, so that path also pays one
 * bcrypt comparison at the same cost. Created once per process, lazily, from a random secret
 * nobody knows; never per request. It narrows, but does not eliminate, timing differences: the
 * database lookup, network jitter and stored hashes with other costs still vary.
 */
export function dummyBcryptHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS).catch((error) => {
    dummyHash = null
    throw error
  })
  return dummyHash
}

/**
 * Constant-work comparison: always runs exactly one bcrypt.compare. Returns false for a missing
 * or empty stored hash (after comparing against the dummy one) and for malformed hashes.
 */
export async function compareSecretOrDummy(secret: string, storedHash: string | null | undefined): Promise<boolean> {
  const hasHash = typeof storedHash === 'string' && storedHash.length > 0
  try {
    const target = hasHash ? storedHash : await dummyBcryptHash()
    const matches = await bcrypt.compare(typeof secret === 'string' ? secret : '', target)
    return hasHash && matches === true
  } catch {
    return false
  }
}
