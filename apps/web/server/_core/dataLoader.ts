/**
 * DataLoader para resolver problema N+1 queries
 * Agrupa requisições de dados similares em uma única query
 */

interface BatchFn<K, V> {
  (keys: readonly K[]): Promise<(V | Error)[]>;
}

interface Options<K> {
  batch?: boolean;
  cache?: boolean;
  cacheKeyFn?: (key: K) => string;
}

class DataLoader<K, V> {
  private queue: K[] = [];
  private cache = new Map<string, V>();
  private batchFn: BatchFn<K, V>;
  private options: Required<Options<K>>;
  private batchScheduled = false;

  constructor(
    batchFn: BatchFn<K, V>,
    options: Options<K> = {}
  ) {
    this.batchFn = batchFn;
    this.options = {
      batch: options.batch ?? true,
      cache: options.cache ?? true,
      cacheKeyFn: options.cacheKeyFn ?? ((key: K) => JSON.stringify(key)),
    };
  }

  /**
   * Carrega um valor, agrupando requisições similares
   */
  async load(key: K): Promise<V> {
    const cacheKey = this.options.cacheKeyFn(key);

    // Retorna do cache se disponível
    if (this.options.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Adiciona à fila
    this.queue.push(key);

    // Agenda o batch se não estiver agendado
    if (!this.batchScheduled && this.options.batch) {
      this.batchScheduled = true;
      await new Promise((resolve) => setImmediate(resolve));
      return this.executeBatch().then(() => {
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;
        throw new Error(`Failed to load key: ${cacheKey}`);
      });
    }

    // Se batch está desabilitado, executa imediatamente
    if (!this.options.batch) {
      const result = await this.batchFn([key]);
      if (result[0] instanceof Error) throw result[0];
      return result[0];
    }

    // Espera o batch ser executado
    return new Promise((resolve, reject) => {
      const checkCache = setInterval(() => {
        if (this.cache.has(cacheKey)) {
          clearInterval(checkCache);
          resolve(this.cache.get(cacheKey)!);
        }
      }, 1);
    });
  }

  /**
   * Carrega múltiplos valores
   */
  async loadMany(keys: K[]): Promise<(V | Error)[]> {
    return Promise.all(keys.map((key) => this.load(key).catch((err) => err)));
  }

  /**
   * Executa o batch
   */
  private async executeBatch(): Promise<void> {
    if (this.queue.length === 0) {
      this.batchScheduled = false;
      return;
    }

    const keys = [...new Set(this.queue)]; // Remove duplicatas
    this.queue = [];

    try {
      const results = await this.batchFn(keys);

      keys.forEach((key, index) => {
        const cacheKey = this.options.cacheKeyFn(key);
        const result = results[index];

        if (!(result instanceof Error)) {
          this.cache.set(cacheKey, result);
        }
      });
    } finally {
      this.batchScheduled = false;
    }
  }

  /**
   * Limpa o cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove uma chave do cache
   */
  clearCacheForKey(key: K): void {
    const cacheKey = this.options.cacheKeyFn(key);
    this.cache.delete(cacheKey);
  }

  /**
   * Pré-carrega valores no cache
   */
  prime(key: K, value: V): this {
    const cacheKey = this.options.cacheKeyFn(key);
    this.cache.set(cacheKey, value);
    return this;
  }
}

/**
 * Factory para criar DataLoaders comuns
 */
export const createDataLoaders = (db: any) => ({
  /**
   * Carrega múltiplos clientes por ID
   */
  customerLoader: new DataLoader(
    async (customerIds: readonly number[]) => {
      const customers = await db.query.customers.findMany({
        where: (table: any) => ({
          id: { in: customerIds },
        }),
      });

      return customerIds.map(
        (id) => customers.find((c: any) => c.id === id) || new Error(`Customer ${id} not found`)
      );
    },
    { cacheKeyFn: (id) => `customer:${id}` }
  ),

  /**
   * Carrega múltiplos agendamentos por ID
   */
  appointmentLoader: new DataLoader(
    async (appointmentIds: readonly number[]) => {
      const appointments = await db.query.appointments.findMany({
        where: (table: any) => ({
          id: { in: appointmentIds },
        }),
      });

      return appointmentIds.map(
        (id) =>
          appointments.find((a: any) => a.id === id) ||
          new Error(`Appointment ${id} not found`)
      );
    },
    { cacheKeyFn: (id) => `appointment:${id}` }
  ),

  /**
   * Carrega múltiplos usuários por ID
   */
  userLoader: new DataLoader(
    async (userIds: readonly number[]) => {
      const users = await db.query.users.findMany({
        where: (table: any) => ({
          id: { in: userIds },
        }),
      });

      return userIds.map(
        (id) => users.find((u: any) => u.id === id) || new Error(`User ${id} not found`)
      );
    },
    { cacheKeyFn: (id) => `user:${id}` }
  ),
});

export { DataLoader };
