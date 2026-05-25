import { describe, expect, it } from "vitest";
import {
  getAttentionSummary,
  getVisibleAttentionItems,
  groupOperationalSignals,
  mergeSimilarAttentionItems,
  suppressOperationalNoise,
} from "@/lib/operational-attention";

describe("operational-attention", () => {
  const now = Date.now();
  const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  it("agrupa por tipo/domínio", () => {
    const grouped = groupOperationalSignals([
      { key: "1", domain: "finances", type: "overdue_charge", severity: "WARNING" },
      { key: "2", domain: "finances", type: "overdue_charge", severity: "WARNING" },
      { key: "3", domain: "service_orders", type: "overdue_os", severity: "ATTENTION" },
    ]);

    expect(grouped.get("finances:overdue_charge")?.length).toBe(2);
    expect(grouped.get("service_orders:overdue_os")?.length).toBe(1);
  });

  it("suprime warning quando há crítico no mesmo domínio", () => {
    const items = suppressOperationalNoise([
      { key: "critical", domain: "finances", severity: "CRITICAL" },
      { key: "warning", domain: "finances", severity: "WARNING" },
      { key: "other-warning", domain: "customers", severity: "WARNING" },
    ]);

    expect(items.map(item => item.key)).toContain("critical");
    expect(items.map(item => item.key)).not.toContain("warning");
    expect(items.map(item => item.key)).toContain("other-warning");
  });

  it("limita itens visíveis e preserva críticos", () => {
    const items = getVisibleAttentionItems(
      [
        { key: "c1", severity: "CRITICAL", domain: "customers", type: "silent", amountCents: 1000 },
        { key: "f1", severity: "WARNING", domain: "finances", type: "overdue_charge", amountCents: 900000, dueDate: daysAgo(10) },
        { key: "f2", severity: "WARNING", domain: "finances", type: "overdue_charge", amountCents: 800000, dueDate: daysAgo(5) },
        { key: "s1", severity: "ATTENTION", domain: "service_orders", type: "overdue_os", dueDate: daysAgo(7) },
      ],
      2
    );

    expect(items).toHaveLength(2);
    expect(items[0]?.key).toBe("c1");
  });

  it("resume itens ocultos", () => {
    const summary = getAttentionSummary([
      { key: "1", domain: "finances", type: "overdue_charge", severity: "WARNING" },
      { key: "2", domain: "finances", type: "overdue_charge", severity: "WARNING" },
      { key: "3", domain: "finances", type: "overdue_charge", severity: "WARNING" },
      { key: "4", domain: "service_orders", type: "overdue_os", severity: "ATTENTION" },
      { key: "5", domain: "customers", type: "silent", severity: "CRITICAL" },
    ]);

    expect(summary.total).toBe(5);
    expect(summary.hidden).toBeGreaterThan(0);
    expect(summary.hiddenMessage).toContain("+");
  });

  it("robustez com dados incompletos", () => {
    const merged = mergeSimilarAttentionItems([
      { key: "a", severity: undefined, domain: null, type: null, context: "Item A" },
      { key: "b", severity: "WARNING", context: "Item B" },
    ]);

    expect(merged.length).toBeGreaterThan(0);
  });
});
