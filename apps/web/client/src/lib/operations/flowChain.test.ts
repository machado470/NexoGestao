import { describe, expect, it } from "vitest";
import { buildNextActionSuggestions, runFlowChain } from "./flowChain";

describe("flowChain", () => {
  it("bloqueia execução duplicada em memória por idempotência", async () => {
    const first = await runFlowChain({
      actionId: "generate_charge",
      actionLabel: "Gerar cobrança",
      executionKey: "test:idem:charge",
      onExecute: () => undefined,
      throwOnError: false,
    });

    const second = await runFlowChain({
      actionId: "generate_charge",
      actionLabel: "Gerar cobrança",
      executionKey: "test:idem:charge",
      onExecute: () => {
        throw new Error("não deveria executar novamente");
      },
      throwOnError: false,
    });

    expect(first.latestStatus).toBe("success");
    expect(second.snapshots[0]?.message).toContain("idempotente");
  });

  it("gera próxima ação sem repetir histórico já executado", () => {
    const suggestions = buildNextActionSuggestions({
      actionId: "complete_service",
      facts: { hasOpenCharge: false },
      history: [{ actionId: "generate_charge", status: "success" }],
    });

    expect(suggestions).toHaveLength(0);
  });

  it("respeita confirmação explícita para ação crítica", async () => {
    const result = await runFlowChain({
      actionId: "generate_charge",
      actionLabel: "Gerar cobrança",
      criticality: "high",
      onConfirm: async () => false,
      onExecute: () => undefined,
      throwOnError: false,
    });

    expect(result.latestStatus).toBe("failed");
    expect(result.canRetry).toBe(true);
  });
});
