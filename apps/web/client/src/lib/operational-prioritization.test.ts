import { describe, expect, it } from "vitest";
import {
  compareOperationalPriority,
  getDominantOperationalAction,
  getOperationalPriorityScore,
  rankOperationalItems,
} from "@/lib/operational-prioritization";

describe("operational prioritization", () => {
  it("prioritizes by normalized severity", () => {
    const critical = getOperationalPriorityScore({ severity: "crítico" });
    const warning = getOperationalPriorityScore({ severity: "warning" });
    expect(critical.total).toBeGreaterThan(warning.total);
  });

  it("orders by overdue days", () => {
    const oldDue = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const recentDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const ordered = rankOperationalItems([
      { id: "recent", severity: "warning", dueDate: recentDue },
      { id: "old", severity: "warning", dueDate: oldDue },
    ]);
    expect(ordered[0]?.id).toBe("old");
  });

  it("breaks ties by financial value", () => {
    const result = compareOperationalPriority(
      { id: "a", severity: "attention", amountCents: 50_00 },
      { id: "b", severity: "attention", amountCents: 150_00 }
    );
    expect(result).toBeGreaterThan(0);
  });

  it("selects overdue collection as dominant action", () => {
    const dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const action = getDominantOperationalAction([
      { severity: "warning", dueDate, amountCents: 40_000 },
      { severity: "attention", scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
    ]);
    expect(action?.label).toBe("Cobrar cliente");
  });

  it("handles items without data safely", () => {
    const action = getDominantOperationalAction([{}]);
    expect(action).not.toBeNull();
    expect(getOperationalPriorityScore({}).total).toBeGreaterThanOrEqual(0);
  });
});
