export function operationalMemoryKey(organizationId: string | undefined, userId: string | undefined, key: string) {
  if (!organizationId?.trim() || !userId?.trim()) return null;
  return `nexo:memory:${encodeURIComponent(organizationId)}:${encodeURIComponent(userId)}:${encodeURIComponent(key)}`;
}
export function readOperationalMemory<T>(key: string | null, fallback: T): T {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch { return fallback; }
}
