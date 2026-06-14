import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const financesPage = readFileSync(
  new URL("./FinancesPage.tsx", import.meta.url),
  "utf8"
);

const renderedText = financesPage
  .replace(
    /const RAW_TECHNICAL_PATTERN[\s\S]*?function getChargePrimaryAction/,
    "function getChargePrimaryAction"
  )
  .replace(/navigate\(`[^`]+`\)/g, "navigate(...) ")
  .replace(/trpc\.[\w.]+/g, "trpc.call")
  .replace(/pending|executed|started/gi, "");

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
    expect(financesPage).toContain(
      "Centro de conversão da execução em receita"
    );
    expect(financesPage).toContain("Hero Executivo Financeiro");
    expect(financesPage).toContain("Dinheiro recebido");
    expect(financesPage).toContain("Dinheiro pendente");
    expect(financesPage).toContain("Dinheiro em risco");
    expect(financesPage).not.toContain("Maior cobrança em atraso");
    expect(financesPage).not.toContain("Cliente prioritário");
    expect(financesPage).not.toContain("Próxima ação financeira");
  });

  it("mantém FAÇA AGORA como comando financeiro dominante com CTAs reais", () => {
    expect(financesPage).toContain("FAÇA AGORA");
    expect(financesPage).toContain("Cobrar no WhatsApp contextual");
    expect(financesPage).toContain("Abrir WhatsApp contextual");
    expect(financesPage).toContain("Criar cobrança");
    expect(financesPage).not.toContain("textarea/composer inline");
  });

  it("cria Pipeline Financeiro logo após FAÇA AGORA", () => {
    expect(financesPage).toContain("Pipeline Financeiro");
    expect(financesPage).toContain(
      "Cliente → Cobrança → Envio → Contato → Pagamento → Recebimento"
    );
    expect(financesPage).toContain("getPipelineStages");
    expect(financesPage).toContain("Gargalo principal");
    expect(financesPage).toContain("pipelineBottleneck");
    expect(financesPage.indexOf("FAÇA AGORA")).toBeLessThan(
      financesPage.indexOf("Pipeline Financeiro")
    );
    expect(financesPage.indexOf("Pipeline Financeiro")).toBeLessThan(
      financesPage.indexOf("Radar financeiro")
    );
    expect(financesPage).toContain("Conversão de receita");
  });

  it("humaniza Timeline e protege contra vazamentos técnicos na experiência renderizada", () => {
    expect(financesPage).toContain("sanitizeFinancialText");
    expect(financesPage).toContain("humanizeFinancialTimelineEvent");
    expect(financesPage).toContain("getFinancialBusinessLabel");
    expect(financesPage).toContain("safeFinancialEntityName");
    expect(financesPage).toContain("Cobrança criada");
    expect(financesPage).toContain("Lembrete preparado");
    expect(financesPage).toContain("Lembrete enviado");
    expect(financesPage).toContain("Pagamento registrado");
    expect(financesPage).toContain("Cobrança atualizada");
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
      "pending",
      "executed",
      "started",
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
    expect(financesPage).toContain("Decisão operacional");
    expect(financesPage.indexOf("Cliente vinculado")).toBeLessThan(
      financesPage.indexOf("Decisão operacional")
    );
    expect(financesPage.indexOf("Valor da cobrança")).toBeLessThan(
      financesPage.indexOf("Decisão operacional")
    );
    expect(financesPage.indexOf("Decisão operacional")).toBeLessThan(
      financesPage.indexOf("Prova operacional financeira")
    );
    expect(financesPage.indexOf("Prova operacional financeira")).toBeLessThan(
      financesPage.indexOf("Comunicação / WhatsApp")
    );
    expect(financesPage).not.toContain("Cobrança ID");
    expect(financesPage).not.toContain(
      'placeholder="Buscar cliente, O.S., status ou ID"'
    );
    expect(renderedText).not.toContain("ID: {");
  });

  it("remove telefone cru e usa linguagem operacional de contato", () => {
    expect(financesPage).toContain("getContactAvailability");
    expect(financesPage).toContain("getHumanPriorityLabel");
    expect(financesPage).toContain("Crítico");
    expect(financesPage).toContain("Atenção");
    expect(financesPage).toContain("Acompanhar");
    expect(financesPage).toContain("Informativo");
    expect(financesPage).toContain("Contato cadastrado");
    expect(financesPage).toContain("WhatsApp disponível");
    expect(financesPage).toContain("Sem contato retornado");
    expect(renderedText).not.toMatch(/55\d{10,13}/);
    expect(financesPage).not.toContain("Telefone não retornado");
  });

  it("remove Pulso repetitivo e usa Radar compacto com linguagem operacional", () => {
    expect(financesPage).toContain("Radar financeiro");
    expect(financesPage).not.toContain("Pulso Financeiro");
    expect(financesPage).toContain("Conversão de receita");
    expect(financesPage).toContain("Recebido");
    expect(financesPage).toContain("Previsto total");
    expect(financesPage).toContain("Resolver");
    expect(financesPage).toContain("Usar WhatsApp");
    expect(financesPage).toContain("Priorizar");
    expect(financesPage).toContain(
      "Nenhum histórico de envio disponível nesta leitura. Use o WhatsApp contextual para continuar a cobrança."
    );
    for (const leak of ["backend", "BFF", "endpoint"]) {
      expect(renderedText.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });
});
