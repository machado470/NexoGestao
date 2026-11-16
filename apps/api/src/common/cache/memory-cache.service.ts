import { Injectable } from '@nestjs/common'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

@Injectable()
export class MemoryCacheService {
  private readonly cache = new Map<string, CacheEntry<any>>()

  private readonly pending = new Map<string, Promise<unknown>>()

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.value as T
  }

  delete(key: string): void {
    this.cache.delete(key)
    this.pending.delete(key)
  }

  deleteByPrefix(prefix: string): void {
    for (const key of new Set([...this.cache.keys(), ...this.pending.keys()])) {
      if (key.startsWith(prefix)) {
        this.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
    this.pending.clear()
  }

  /**
   * Wrapper para get-or-set: busca no cache ou executa a função e armazena.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached

    const existing = this.pending.get(key)
    if (existing) return existing as Promise<T>

    // Defer the factory so synchronous exceptions also release the reservation.
    const pending = Promise.resolve().then(fn).then(value => {
      // Invalidation during computation must not repopulate stale data.
      if (this.pending.get(key) === pending) this.set(key, value, ttlMs)
      return value
    }).finally(() => {
      if (this.pending.get(key) === pending) this.pending.delete(key)
    })
    this.pending.set(key, pending)
    return pending
  }
}
