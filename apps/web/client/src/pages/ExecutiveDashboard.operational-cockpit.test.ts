import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExecutiveDashboard operational cockpit", () => {
  const source = readFileSync("client/src/pages/ExecutiveDashboard.tsx", "utf8");

  it("consumes operational signals and next best action endpoints", () => {
    expect(source).toContain('/internal/operational-signals?limit=8');
    expect(source).toContain('/internal/operational-signals/next-best-action');
    expect(source).toContain("operationalSignalsQuery");
    expect(source).toContain("/internal/operational-actions/request");
    expect(source).toContain("/internal/operational-actions/execute");
    expect(source).toContain("/internal/operational-actions/cancel");
    expect(source).toContain("/internal/operational-actions/recover-stuck");
    expect(source).toContain("nextBestActionQuery");
  });

  it("renders assisted actions health block with diagnostics endpoint", () => {
    expect(source).toContain("Saúde das ações assistidas");
    expect(source).toContain("/internal/operational-actions/diagnostics");
    expect(source).toContain("pendingRequestedCount");
    expect(source).toContain("stuckExecutingCount");
    expect(source).toContain("failedLast24hCount");
    expect(source).toContain("recoveredLast24hCount");
    expect(source).toContain("recentStuckExecuting");
    expect(source).toContain("Marcar como recuperado");
    expect(source).toContain("avgRequestedToExecutedMs");
    expect(source).toContain("topFailedActionTypes");
    expect(source).toContain("recentFailures");
    expect(source).toContain("Atualizar");
    expect(source).toContain("Tentar novamente");
  });

  it("treats diagnostics healthy and critical states", () => {
    expect(source).toContain("Sem ações travadas");
    expect(source).toContain("Nenhuma falha recente");
    expect(source).toContain("Estado crítico: existem ações travadas ou falhas recentes");
    expect(source).toContain("Saudável: sem travas e sem falhas recentes relevantes");
  });

  it("keeps contextual CTA routes without exposing sensitive tokens", () => {
    expect(source).toContain('return "/whatsapp"');
    expect(source).toContain('return "/finances?view=charges"');
    expect(source).not.toContain("token");
    expect(source).not.toContain("secret");
    expect(source).not.toContain("orgId:");
  });
});
