export type TrendDirection = "up" | "down" | "flat";

export function resolveTrendDirection(value: number): TrendDirection {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function formatTrend(value: number): string {
  const direction = resolveTrendDirection(value);
  const abs = Math.abs(value).toFixed(1);
  if (direction === "up") return `↑ +${abs}%`;
  if (direction === "down") return `↓ -${abs}%`;
  return `→ ${abs}%`;
}
