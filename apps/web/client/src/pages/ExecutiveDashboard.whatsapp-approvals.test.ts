import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExecutiveDashboard WhatsApp approvals entry point", () => {
  it("keeps the operational card, count, top-priority list and contextual CTA wired", () => {
    const source = readFileSync(
      "client/src/pages/ExecutiveDashboard.tsx",
      "utf8"
    );

    expect(source).toContain("Aprovações WhatsApp");
    expect(source).toContain("pendingWhatsAppApprovals.length");
    expect(source).toContain(".slice(0, 2)");
    expect(source).toContain("buildWhatsAppExecutionPath(execution)");
    expect(source).toContain(
      "Não foi possível carregar aprovações WhatsApp nesta leitura."
    );
  });
});
