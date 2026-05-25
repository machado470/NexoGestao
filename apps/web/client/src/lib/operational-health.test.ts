import { describe, expect, it } from "vitest";
import {
  detectOperationalBottleneck,
  getOperationalState,
} from "@/lib/operational-health";

describe("operational health", () => {
  it("returns HEALTHY", () => {
    expect(
      getOperationalState({
        charges: [{ status: "PAID" }],
        serviceOrders: [{ status: "DONE", chargeId: "c1" }],
      })
    ).toBe("HEALTHY");
  });

  it("returns ATTENTION", () => {
    expect(
      getOperationalState({
        charges: Array.from({ length: 4 }).map(() => ({ status: "PENDING", amountCents: 15000 })),
        payments: [{ id: "p1", amountCents: 1000 }],
      })
    ).toBe("ATTENTION");
  });

  it("returns CRITICAL", () => {
    expect(
      getOperationalState({
        riskSummary: { level: "critical" },
        people: [{ utilization: 95 }],
      })
    ).toBe("CRITICAL");
  });

  it("returns STALLED for done service order without charge", () => {
    expect(
      getOperationalState({
        serviceOrders: [{ status: "DONE", id: "os-1" }],
      })
    ).toBe("STALLED");
  });

  it("detects charge to payment bottleneck", () => {
    const result = detectOperationalBottleneck({
      charges: [{ status: "OVERDUE", id: "ch-1", payments: [] }],
      payments: [],
    });
    expect(result.bottleneck).toBe("CHARGE_TO_PAYMENT");
  });

  it("returns UNKNOWN with insufficient data", () => {
    expect(getOperationalState({})).toBe("UNKNOWN");
  });

  it("does not break with missing optional fields", () => {
    expect(() => getOperationalState({ customers: [{ id: "1" }] })).not.toThrow();
  });
});
