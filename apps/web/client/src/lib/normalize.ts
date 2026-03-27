export function normalizeList<T>(payload: any): T[] {
  if (!payload) return [];

  // formato novo (items)
  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  // formato antigo (data)
  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  // fallback direto
  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
}
