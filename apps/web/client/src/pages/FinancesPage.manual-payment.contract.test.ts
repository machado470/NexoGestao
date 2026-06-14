import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financesPage = readFileSync(
  new URL("./FinancesPage.tsx", import.meta.url),
  "utf8"
);

const renderedText = financesPage
  .replace(/const RAW_TECHNICAL_PATTERN[\s\S]*?function getChargePrimaryAction/, "function getChargePrimaryAction")
  .replace(/navigate\(`[^`]+`\)/g, "navigate(...) ")
  .replace(/trpc\.[\w.]+/g, "trpc.call");

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

  it("posiciona Financeiro como cockpit operacional de conversão em receita", () => {
    expect(financesPage).toContain("Financeiro operacional");
    expect(financesPage).toContain("Centro de conversão da execução em receita");
    expect(financesPage).toContain("Hero Executivo Financeiro");
    expect(financesPage).toContain("Dinheiro recebido");
    expect(financesPage).toContain("Dinheiro pendente");
    expect(financesPage).toContain("Dinheiro em risco");
    expect(financesPage).toContain("Maior cobrança em atraso");
    expect(financesPage).toContain("Cliente prioritário");
    expect(financesPage).toContain("Próxima ação financeira");
  });

  it("mantém FAÇA AGORA como comando financeiro dominante com CTAs reais", () => {
    expect(financesPage).toContain("FAÇA AGORA");
    expect(financesPage).toContain("Cobrar no WhatsApp contextual");
    expect(financesPage).toContain("Abrir WhatsApp contextual");
    expect(financesPage).toContain("Criar cobrança");
    expect(financesPage).not.toContain("textarea/composer inline");
  });

  it("humaniza Timeline e protege contra vazamentos técnicos na experiência renderizada", () => {
    expect(financesPage).toContain("sanitizeFinancialText");
    expect(financesPage).toContain("humanizeFinancialTimelineEvent");
    expect(financesPage).toContain("getFinancialBusinessLabel");
    expect(financesPage).toContain("safeFinancialEntityName");
    expect(financesPage).toContain("Cobrança criada");
    expect(financesPage).toContain("Cobrança enviada");
    expect(financesPage).toContain("Lembrete de cobrança preparado");
    expect(financesPage).toContain("Lembrete de cobrança enviado");
    expect(financesPage).toContain("Pagamento registrado");
    expect(financesPage).toContain("Cobrança cancelada");
    expect(financesPage).toContain("Ação financeira registrada");
    expect(financesPage).toContain("Evento financeiro registrado");
    for (const leak of [
      "EXECUTION_STARTED",
      "EXECUTION_EXECUTED",
      "action-send-overdue-charge-reminder",
      "action-create-charge-followup",
      "eventType",
      "payload",
      "metadata",
    ]) {
      expect(renderedText).not.toContain(leak);
    }
  });

  it("transforma carteira e detalhe em cockpit sem ID cru ou Cobrança ID", () => {
    expect(financesPage).toContain("Carteira operacional");
    expect(financesPage).toContain("O.S. vinculada");
    expect(financesPage).toContain("Sem O.S. vinculada");
    expect(financesPage).toContain("Origem não informada pela fonte atual");
    expect(financesPage).toContain("Detalhe financeiro de cobrança");
    expect(financesPage).not.toContain("Cobrança ID");
    expect(financesPage).not.toContain('placeholder="Buscar cliente, O.S., status ou ID"');
    expect(renderedText).not.toContain("ID: {");
  });

  it("usa Radar financeiro e WhatsApp com linguagem operacional", () => {
    expect(financesPage).toContain("Radar financeiro");
    expect(financesPage).toContain("Resolver");
    expect(financesPage).toContain(
      "Nenhum histórico de envio disponível nesta leitura. Use o WhatsApp contextual para continuar a cobrança."
    );
    for (const leak of ["backend", "BFF", "endpoint"]) {
      expect(renderedText.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });
});
