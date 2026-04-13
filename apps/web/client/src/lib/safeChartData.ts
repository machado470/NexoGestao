export type SafeChartResult<T> = {
  data: T[];
  isValid: boolean;
  reason?: string;
};

export function safeChartData(data: any[]): any[];
export function safeChartData<T extends Record<string, unknown>>(
  data: unknown,
  numericKeys: string[]
): SafeChartResult<T>;
export function safeChartData<T extends Record<string, unknown>>(
  data: unknown,
  numericKeys?: string[]
): any[] | SafeChartResult<T> {
  if (!Array.isArray(data)) {
    return numericKeys ? { data: [], isValid: false, reason: "Payload de gráfico não é array" } : [];
  }

  const filtered = data.filter((item) => {
    if (!item) return false;
    return Object.values(item).every((v) => v !== null && v !== undefined && !Number.isNaN(v));
  });

  if (!numericKeys) return filtered;

  const normalized = filtered.map((item) => {
    const candidate = { ...(item as Record<string, unknown>) };
    for (const key of numericKeys) {
      candidate[key] = Number(candidate[key] ?? 0);
    }
    return candidate as T;
  });

  return { data: normalized, isValid: normalized.length === data.length };
}
