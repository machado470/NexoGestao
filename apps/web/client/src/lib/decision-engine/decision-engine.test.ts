import { describe, expect, it, vi } from "vitest";
import {
  getAppointmentDecisions,
  getFinanceDecisions,
} from "./decision.resolvers";
import { sortDecisionsBySeverity } from "./useOperationalDecisions";
import { toNextActionCardProps } from "@/components/decision-engine/GlobalNextAction";

describe("decision engine guardrails", () => {
  it("sempre gera ao menos 1 decisão quando há dados críticos", () => {
    const decisions = getFinanceDecisions(
      {
        charges: [{ id: "ch_1", customerId: "c_1", status: "OVERDUE", dueDate: "2026-04-01T10:00:00.000Z" }],
      },
      { navigate: vi.fn() }
    );

    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions[0]?.severity).toBe("critical");
  });

  it("decisão crítica sempre aparece primeiro", () => {
    const highDecision = getAppointmentDecisions(
      {
        appointments: [
          { id: "a_1", customerId: "c_1", startsAt: "2026-04-14T09:00:00.000Z" },
          { id: "a_2", customerId: "c_1", startsAt: "2026-04-14T09:00:00.000Z" },
        ],
      },
      { navigate: vi.fn() }
    )[0];

    const criticalDecision = getFinanceDecisions(
      {
        charges: [{ id: "ch_2", customerId: "c_2", status: "OVERDUE", dueDate: "2026-04-10T10:00:00.000Z" }],
      },
      { navigate: vi.fn() }
    )[0];

    const ordered = sortDecisionsBySeverity([highDecision, criticalDecision].filter(Boolean) as any);
    expect(ordered[0].severity).toBe("critical");
  });

  it("nenhuma decisão é criada sem action válida", () => {
    const decisions = getFinanceDecisions(
      {
        charges: [{ id: "ch_3", customerId: "c_3", status: "OVERDUE" }],
      },
      { navigate: vi.fn() }
    );

    expect(decisions.every((decision) => decision.action?.label && typeof decision.action.execute === "function")).toBe(true);
  });

  it("GlobalNextAction mapeia props corretas para AppNextActionCard", () => {
    const decision = getFinanceDecisions(
      {
        charges: [{ id: "ch_4", customerId: "c_4", status: "OVERDUE" }],
      },
      { navigate: vi.fn() }
    )[0];

    const props = toNextActionCardProps(decision);
    expect(props.title).toBe(decision.title);
    expect(props.description).toBe(decision.description);
    expect(props.severity).toBe(decision.severity);
    expect(props.action.label).toBe(decision.action.label);
  });
});
