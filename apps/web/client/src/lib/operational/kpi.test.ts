import { describe, expect, it } from "vitest";
import { formatDelta, getDayWindow, getWindow, percentDelta, safeDate, trendFromDelta } from "./kpi";

describe("kpi utils hardening", () => {
  it("safeDate retorna null para datas inválidas", () => {
    expect(safeDate(undefined)).toBeNull();
    expect(safeDate(null)).toBeNull();
    expect(safeDate("not-a-date")).toBeNull();
  });

  it("getWindow faz fallback para parâmetros inválidos", () => {
    const { start, end } = getWindow(Number.NaN as unknown as number, -5 as unknown as number, "invalid" as unknown as Date);
    expect(Number.isNaN(start.getTime())).toBe(false);
    expect(Number.isNaN(end.getTime())).toBe(false);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("getDayWindow aceita entrada inválida sem quebrar", () => {
    const { start, end } = getDayWindow(Number.NaN as unknown as number, "invalid" as unknown as Date);
    expect(Number.isNaN(start.getTime())).toBe(false);
    expect(Number.isNaN(end.getTime())).toBe(false);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("percentDelta retorna null para divisão por zero e NaN", () => {
    expect(percentDelta(100, 0)).toBeNull();
    expect(percentDelta(Number.NaN, 100)).toBeNull();
    expect(percentDelta(100, Number.NaN)).toBeNull();
  });

  it("formatDelta e trendFromDelta retornam fallback seguro para delta inválido", () => {
    expect(formatDelta(null)).toBeUndefined();
    expect(formatDelta(Number.NaN)).toBeUndefined();
    expect(trendFromDelta(null)).toBeUndefined();
    expect(trendFromDelta(Number.NaN)).toBeUndefined();
  });
});
