export type MetricTrend = "up" | "down" | "neutral";

export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getWindow(days: number, offset = 0, now = new Date()) {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - offset * days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { start, end };
}

export function getDayWindow(offsetDays = 0, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function inRange(date: Date | null, start: Date, end: Date) {
  return Boolean(date && date >= start && date < end);
}

export function percentDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
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
