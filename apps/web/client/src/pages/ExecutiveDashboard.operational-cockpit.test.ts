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
    expect(source).toContain("nextBestActionQuery");
  });

  it("renders operational attention center with severity and fallback", () => {
    expect(source).toContain("Operational Attention Center");
    expect(source).toContain("Executar ação assistida");
    expect(source).toContain("AppStatusBadge label={signal.severity}");
    expect(source).toContain("Sem sinais operacionais ativos no momento");
  });

  it("renders executive runtime and operational health sections", () => {
    expect(source).toContain("Executive runtime");
    expect(source).toContain("Saúde operacional");
    expect(source).toContain("Estado crítico");
    expect(source).toContain("Atenção necessária");
    expect(source).toContain("Operação estável");
  });

  it("keeps contextual CTA routes without exposing sensitive tokens", () => {
    expect(source).toContain('return "/whatsapp"');
    expect(source).toContain('return "/finances?view=charges"');
    expect(source).not.toContain("token");
    expect(source).not.toContain("secret");
    expect(source).not.toContain("payload");
  });
});
