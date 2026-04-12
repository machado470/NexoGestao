export type MetricTrend = "up" | "down" | "neutral";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getWindow(days: number, offset = 0, now = new Date()) {
  const safeDays = Math.max(1, Math.floor(toFiniteNumber(days) ?? 1));
  const safeOffset = Math.max(0, Math.floor(toFiniteNumber(offset) ?? 0));
  const safeNow = safeDate(now) ?? new Date();
  const end = new Date(safeNow);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - safeOffset * safeDays);
  const start = new Date(end);
  start.setDate(start.getDate() - safeDays);
  return { start, end };
}

export function getDayWindow(offsetDays = 0, now = new Date()) {
  const safeOffset = Math.max(0, Math.floor(toFiniteNumber(offsetDays) ?? 0));
  const safeNow = safeDate(now) ?? new Date();
  const start = new Date(safeNow);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - safeOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function inRange(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date < end);
}

export function percentDelta(current: number, previous: number): number | null {
  const safeCurrent = toFiniteNumber(current);
  const safePrevious = toFiniteNumber(previous);
  if (safeCurrent === null || safePrevious === null) return null;
  if (safePrevious <= 0) return null;
  return ((safeCurrent - safePrevious) / safePrevious) * 100;
}

export function trendFromDelta(delta: number | null): MetricTrend | undefined {
  if (delta === null || !Number.isFinite(delta)) return undefined;
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

export function formatDelta(delta: number | null): string | undefined {
  if (delta === null || !Number.isFinite(delta)) return undefined;
  const signal = delta > 0 ? "+" : "";
  return `${signal}${delta.toFixed(1).replace(".", ",")}%`;
}
