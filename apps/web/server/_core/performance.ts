export class RequestDeduplicator<T> {
  private pending = new Map<string, Promise<T>>();

  getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;

    const p = factory().finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }
}
