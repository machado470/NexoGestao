/**
 * Sistema de cache em memória com TTL
 * Ideal para dados que não mudam frequentemente
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpar cache expirado a cada 5 minutos
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Define um valor no cache
   * @param key - Chave única
   * @param value - Valor a armazenar
   * @param ttlSeconds - Tempo de vida em segundos (padrão: 5 minutos)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 5 * 60): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Obtém um valor do cache
   * @param key - Chave única
   * @returns Valor ou undefined se expirado/não existe
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Verifica se uma chave existe e não está expirada
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove uma chave do cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Limpa o cache inteiro
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Obtém ou computa um valor (cache-aside pattern)
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds: number = 5 * 60
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await compute();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Invalida chaves por padrão (wildcard)
   * @param pattern - Padrão glob simples (ex: "user:*")
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    let expiredCount = 0;
    const now = Date.now();

    this.cache.forEach((entry) => {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
    });

    return {
      size: this.cache.size,
      expired: expiredCount,
      active: this.cache.size - expiredCount,
    };
  }

  /**
   * Destruir cache e limpar interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Instância global
export const cache = new MemoryCache();

/**
 * Decorator para cachear resultado de função
 */
export function Cacheable(ttlSeconds: number = 5 * 60, keyPrefix: string = '') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${keyPrefix}:${propertyKey}:${JSON.stringify(args)}`;
      return cache.getOrCompute(cacheKey, () => originalMethod.apply(this, args), ttlSeconds);
    };

    return descriptor;
  };
}
