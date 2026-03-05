import { Injectable } from '@nestjs/common'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

@Injectable()
export class MemoryCacheService {
  private readonly cache = new Map<string, CacheEntry<any>>()

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
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }

  /**
   * Wrapper para get-or-set: busca no cache ou executa a função e armazena.
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) return cached

    const value = await fn()
    this.set(key, value, ttlMs)
    return value
  }
}
