import { describe, expect, it } from "vitest";
import { getCriticalIncidents, getDegradedQueues, shouldBlockOperationalAction } from "./OperationalCockpitPage";

describe("OperationalCockpitPage selectors", () => {
  it("destaca incidentes CRITICAL", () => {
    const list = getCriticalIncidents([
      { id: "1", severity: "INFO" },
      { id: "2", severity: "CRITICAL" },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("2");
  });

  it("retorna apenas filas degradadas", () => {
    const list = getDegradedQueues([
      { name: "a", status: "healthy" },
      { name: "b", status: "degraded" },
      { name: "c", status: "stalled" },
    ]);
    expect(list.map(item => item.name)).toEqual(["b", "c"]);
  });

  it("empty states permanecem vazios", () => {
    expect(getCriticalIncidents([])).toEqual([]);
    expect(getDegradedQueues([])).toEqual([]);
  });

  it("bloqueia ação duplicada quando loading ou ação concorrente", () => {
    expect(shouldBlockOperationalAction("loading", false)).toBe(true);
    expect(shouldBlockOperationalAction("idle", true)).toBe(true);
    expect(shouldBlockOperationalAction("idle", false)).toBe(false);
  });
});
