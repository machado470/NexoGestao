export function normalizeList<T = any>(data: any): T[] {
  if (!data) return [];

  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.results)) return data.results;

  // fallback inteligente (última chance)
  if (typeof data === "object") {
    const firstArray = Object.values(data).find((v) => Array.isArray(v));
    if (Array.isArray(firstArray)) return firstArray as T[];
  }

  return [];
}
