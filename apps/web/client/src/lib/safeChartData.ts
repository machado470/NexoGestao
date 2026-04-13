export type SafeChartResult<T> = {
  data: T[];
  isValid: boolean;
  reason?: string;
};

export function safeChartData<T extends Record<string, unknown>>(
  input: unknown,
  numericKeys: string[] = []
): SafeChartResult<T> {
  if (!Array.isArray(input)) {
    return { data: [], isValid: false, reason: "Payload de gráfico não é array" };
  }

  const normalized: T[] = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      return { data: [], isValid: false, reason: "Item de gráfico inválido" };
    }

    const candidate = { ...(item as Record<string, unknown>) };

    for (const key of numericKeys) {
      const raw = Number(candidate[key] ?? 0);
      if (!Number.isFinite(raw) || Number.isNaN(raw)) {
        return { data: [], isValid: false, reason: `Valor inválido em ${key}` };
      }
      candidate[key] = raw;
    }

    normalized.push(candidate as T);
  }

  return { data: normalized, isValid: true };
}
