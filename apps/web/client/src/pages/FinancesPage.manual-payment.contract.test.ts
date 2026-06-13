import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financesPage = readFileSync(
  new URL("./FinancesPage.tsx", import.meta.url),
  "utf8"
);

describe("FinancesPage manual payment contract", () => {
  it("envia a data selecionada e a observação no submit do pagamento", () => {
    expect(financesPage).toContain("paidAt: payDate");
    expect(financesPage).toContain(
      "new Date(`${payDate}T12:00:00`).toISOString()"
    );
    expect(financesPage).toContain("notes: payNotes.trim() || undefined");
  });

  it("mantém fallback para a data atual quando o formulário não informa paidAt", () => {
    expect(financesPage).toContain(": new Date().toISOString()");
  });

  it("posiciona Financeiro como centro operacional de conversão em receita, sem ERP pesado", () => {
    expect(financesPage).toContain("Financeiro operacional");
    expect(financesPage).toContain(
      "Centro de conversão da execução em receita"
    );
    expect(financesPage).toContain("sem ERP contábil pesado");
    expect(financesPage).toContain("sem automação inventada");
  });

  it("mantém alertas, tabela e detalhe focados em cobrança, pagamento, atraso e fallback honesto", () => {
    expect(financesPage).toContain("Alertas compactos de receita");
    expect(financesPage).toContain(
      "Cobranças vencidas, pendentes, pagamentos sem registro"
    );
    expect(financesPage).toContain("Origem / O.S.");
    expect(financesPage).toContain("Fonte não informou O.S.");
    expect(financesPage).toContain("Detalhe financeiro de cobrança");
    expect(financesPage).toContain("fallback honesto");
  });
});
