import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./GovernancePage.tsx", import.meta.url),
  "utf8"
);

describe("GovernancePage operational decision center contract", () => {
  it("consolidates the operational state hero without generic waiting chips", () => {
    expect(source).toContain("Governança operacional");
    expect(source).toContain(
      "Centro de decisão da operação. Monitora risco, aplica políticas e orienta intervenção."
    );
    expect(source).toContain("Estado operacional");
    expect(source).toContain("Última avaliação: sem execução recente");
    expect(source).toContain("Operação governada sem restrição.");
    expect(source).not.toContain("AGUARDANDO AÇÃO");
  });

  it("creates the dominant FAÇA AGORA block with up to three safe navigational interventions", () => {
    expect(source).toContain('title="FAÇA AGORA"');
    expect(source).toContain(
      "Intervenções seguras para reduzir restrição operacional."
    );
    expect(source).toContain("buildPriorityActions(signals)");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("Priorizar cobrança vencida");
    expect(source).toContain("Resolver O.S. atrasadas");
    expect(source).toContain("Confirmar agendamento pendente");
    expect(source).toContain("CTA seguro: apenas navega");
    expect(source).toContain("Nenhuma intervenção prioritária nesta leitura.");
  });

  it("keeps critical signals in a single compact block", () => {
    expect(source).toContain('title="Sinais críticos"');
    expect(source).toContain("Sinal | Severidade | Origem | Ação");
    expect(source).toContain("signals.slice(0, 4)");
    expect(source).toContain("Financeiro");
    expect(source).toContain("Ordens de Serviço");
    expect(source).toContain("Agendamentos");
    expect(source).toContain("Timeline/Governança");
    expect(source).toContain("onClick={() => navigate(signal.path)}");
    expect(source).not.toContain("Impactos identificados");
    expect(source).not.toContain("Por que a operação está RESTRICTED?");
  });

  it("uses the compact human decision pipeline", () => {
    expect(source).toContain(
      "Sinal → Evidência → Impacto → Decisão → Política → Ação"
    );
    ["Sinal", "Evidência", "Impacto", "Decisão", "Política", "Ação"].forEach(
      label => expect(source).toContain(`label: "${label}"`)
    );
    expect(source).toContain("Timeline disponível");
    expect(source).toContain("Sem política específica");
    expect(source).toContain("intervenções sugeridas");
    expect(source).not.toContain(
      "Evento → Timeline → Risco → Governança → Política → Ação"
    );
  });

  it("humanizes risk score and never renders raw Score 56", () => {
    expect(source).toContain("humanRiskLabel");
    expect(source).toContain("Risco ${riskLevel} — ${riskScore}");
    expect(source).not.toContain("Score 56");
    expect(source).not.toContain("label={`Score ${riskScore}`}");
  });

  it("renders official evidence without contradictory empty KPI cards", () => {
    expect(source).toContain('title="Evidências oficiais"');
    expect(source).toContain(
      "Eventos e decisões retornados pela Timeline/Governança que sustentam o estado atual."
    );
    expect(source).toContain(
      "Nenhuma decisão oficial retornada nesta leitura."
    );
    expect(source).toContain("para investigar a trilha completa.");
    expect(source).not.toContain("Total de eventos");
    expect(source).not.toContain("Decisões tomadas");
    expect(source).not.toContain("Impactam receita");
  });

  it("keeps system details compact and avoids fake automation or invented history", () => {
    expect(source).toContain('title="Detalhes de governança"');
    expect(source).toContain("Ação automática registrada:");
    expect(source).toContain("não retornada");
    expect(source).toContain("Política específica:");
    expect(source).toContain("sem executar ações automaticamente");
    expect(source).not.toContain("executada automaticamente");
    expect(source).not.toContain("histórico fictício");
    expect(source).not.toContain("Histórico de execuções");
    expect(source).not.toContain("Políticas ativas");
  });
});
