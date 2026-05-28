import { describe, expect, it } from "vitest";
import { detectOperationalInterventions, getPrimaryOperationalIntervention } from "@/lib/operational-interventions";

describe("operational-interventions", () => {
  it("cobrança vencida gera cobrança prioritária", () => {
    const items = detectOperationalInterventions({ charges: [{ status: "OVERDUE", amountCents: 150000, dueDate: "2026-05-01" }] });
    expect(items.some(i => i.type === "SEND_PAYMENT_REMINDER")).toBe(true);
    expect(items.some(i => i.type === "PRIORITIZE_COLLECTION")).toBe(true);
  });

  it("cliente sem resposta gera follow-up", () => {
    const items = detectOperationalInterventions({ customers: [{ id: "c1", noResponse: true }] });
    expect(items.some(i => i.type === "FOLLOW_UP_CUSTOMER")).toBe(true);
  });

  it("gargalo O.S.→cobrança gera RESOLVE_STALLED_FLOW", () => {
    const items = detectOperationalInterventions({ serviceOrders: [{ id: "1", status: "DONE" }] });
    expect(items.some(i => i.type === "RESOLVE_STALLED_FLOW")).toBe(true);
  });

  it("risco crítico gera ESCALATE_OPERATIONAL_RISK", () => {
    const items = detectOperationalInterventions({ riskSummary: { level: "critical" }, charges: [{ status: "PENDING" }] });
    expect(items.some(i => i.type === "ESCALATE_OPERATIONAL_RISK")).toBe(true);
  });

  it("itens sem contexto não geram intervenção inválida", () => {
    const items = detectOperationalInterventions({});
    expect(items).toHaveLength(0);
  });

  it("priorização correta da intervenção dominante", () => {
    const items = detectOperationalInterventions({
      riskSummary: { level: "critical" },
      serviceOrders: [{ status: "DONE" }],
      charges: [{ status: "OVERDUE", amountCents: 10000 }],
    });
    const primary = getPrimaryOperationalIntervention(items);
    expect(primary).not.toBeNull();
    expect(["ESCALATE_OPERATIONAL_RISK", "RESOLVE_STALLED_FLOW"]).toContain(primary?.type);
  });
});
