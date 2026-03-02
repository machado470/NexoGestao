/**
 * Otimizações de Performance
 * Caching, lazy loading, compressão, batch queries
 */

import { cache } from './cache';
import { logger } from './logger';

/**
 * Wrapper para lazy loading de dados
 * Carrega dados sob demanda com cache
 */
export async function lazyLoad<T>(
  key: string,
  loader: () => Promise<T>,
  ttl: number = 3600000 // 1 hora
): Promise<T> {
  // Verificar cache
  const cached = cache.get<T>(key);
  if (cached) {
    logger.api.debug('Cache hit', { key });
    return cached;
  }

  // Carregar dados
  logger.api.debug('Cache miss, loading data', { key });
  const data = await loader();

  // Salvar em cache
  cache.set(key, data, ttl);

  return data;
}

/**
 * Implementa cursor-based pagination
 * Mais eficiente que offset-based para grandes datasets
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Codifica cursor (base64)
 */
export function encodeCursor(id: number | string): string {
  return Buffer.from(String(id)).toString('base64');
}

/**
 * Decodifica cursor
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

/**
 * Implementa compressão de resposta
 * Reduz tamanho da payload em ~70%
 */
export function shouldCompress(size: number): boolean {
  // Comprimir se > 1KB
  return size > 1024;
}

/**
 * Calcula tamanho de objeto em bytes
 */
export function getObjectSize(obj: any): number {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

/**
 * Implementa batch processing para operações em lote
 * Reduz overhead de múltiplas operações
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private timeout: number;
  private processor: (items: T[]) => Promise<R[]>;
  private timer?: NodeJS.Timeout;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 100,
    timeout: number = 5000 // 5 segundos
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.timeout = timeout;
  }

  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      if (this.queue.length >= this.batchSize) {
        this.flush().catch(reject);
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush().catch(reject), this.timeout);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    if (this.timer) clearTimeout(this.timer);

    try {
      const batch = this.queue.splice(0, this.batchSize);
      const results = await this.processor(batch);
      
      logger.api.debug('Batch processed', {
        size: batch.length,
        results: results.length,
      });
    } catch (error) {
      logger.api.error('Batch processing error', error as Error);
      throw error;
    } finally {
      this.processing = false;

      if (this.queue.length > 0) {
        this.timer = setTimeout(() => this.flush(), this.timeout);
      }
    }
  }
}

/**
 * Implementa request deduplication
 * Evita múltiplas requisições para o mesmo recurso
 */
export class RequestDeduplicator<T> {
  private pending: Map<string, Promise<T>> = new Map();

  async execute<R>(
    key: string,
    fn: () => Promise<R>
  ): Promise<R> {
    // Se já existe requisição pendente, retornar a mesma promise
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<R>;
    }

    // Criar nova promise
    const promise = fn()
      .finally(() => {
        // Remover da lista de pendentes após conclusão
        this.pending.delete(key);
      });

    this.pending.set(key, promise as any);
    return promise;
  }
}

/**
 * Implementa connection pooling para banco de dados
 * Reutiliza conexões em vez de criar novas
 */
export class ConnectionPool {
  private available: any[] = [];
  private inUse: Set<any> = new Set();
  private maxSize: number;
  private factory: () => Promise<any>;

  constructor(factory: () => Promise<any>, maxSize: number = 10) {
    this.factory = factory;
    this.maxSize = maxSize;
  }

  async acquire(): Promise<any> {
    // Se há conexão disponível, reutilizar
    if (this.available.length > 0) {
      const conn = this.available.pop()!;
      this.inUse.add(conn);
      return conn;
    }

    // Se não atingiu limite, criar nova
    if (this.inUse.size < this.maxSize) {
      const conn = await this.factory();
      this.inUse.add(conn);
      return conn;
    }

    // Aguardar conexão ficar disponível
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          const conn = this.available.pop()!;
          this.inUse.add(conn);
          resolve(conn);
        }
      }, 100);
    });
  }

  release(conn: any): void {
    this.inUse.delete(conn);
    this.available.push(conn);
  }

  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Implementa memoization para funções puras
 * Cacheia resultados baseado em argumentos
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 3600000
): T {
  const memo = new Map<string, { result: any; timestamp: number }>();

  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    const cached = memo.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }

    const result = fn(...args);
    memo.set(key, { result, timestamp: Date.now() });

    return result;
  }) as T;
}

/**
 * Implementa debounce para funções chamadas frequentemente
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): T {
  let timeout: NodeJS.Timeout;

  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  }) as T;
}

/**
 * Implementa throttle para limitar frequência de chamadas
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): T {
  let inThrottle: boolean;

  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

/**
 * Calcula e registra métricas de performance
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  start(label: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }

      this.metrics.get(label)!.push(duration);

      logger.api.debug('Performance metric', {
        label,
        duration: `${duration.toFixed(2)}ms`,
      });
    };
  }

  getStats(label: string) {
    const durations = this.metrics.get(label) || [];
    
    if (durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / durations.length,
      p50: sorted[Math.floor(durations.length * 0.5)],
      p95: sorted[Math.floor(durations.length * 0.95)],
      p99: sorted[Math.floor(durations.length * 0.99)],
    };
  }

  getAllStats() {
    const stats: Record<string, any> = {};

    for (const [label] of this.metrics) {
      stats[label] = this.getStats(label);
    }

    return stats;
  }
}

// Instância global de performance monitor
export const performanceMonitor = new PerformanceMonitor();
