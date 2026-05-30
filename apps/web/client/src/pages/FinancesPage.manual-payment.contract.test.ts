import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financesPage = readFileSync(new URL("./FinancesPage.tsx", import.meta.url), "utf8");

describe("FinancesPage manual payment contract", () => {
  it("envia a data selecionada e a observação no submit do pagamento", () => {
    expect(financesPage).toContain("paidAt: payDate");
    expect(financesPage).toContain("new Date(`${payDate}T12:00:00`).toISOString()");
    expect(financesPage).toContain("notes: payNotes.trim() || undefined");
  });

  it("mantém fallback para a data atual quando o formulário não informa paidAt", () => {
    expect(financesPage).toContain(": new Date().toISOString()");
  });
});
