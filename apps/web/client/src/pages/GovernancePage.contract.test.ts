import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./GovernancePage.tsx", import.meta.url),
  "utf8"
);

describe("GovernancePage operational decision center contract", () => {
  it("removes generic hero chips and renders the executive operational hero", () => {
    expect(source).toContain("Governança operacional");
    expect(source).toContain(
      "Centro de decisão da operação. Monitora risco, aplica políticas e orienta intervenção."
    );
    expect(source).toContain("Estado operacional atual");
    expect(source).toContain("Cobranças vencidas");
    expect(source).toContain("O.S. atrasadas");
    expect(source).toContain("Agendamentos pendentes");
    expect(source).toContain("Última execução");
    expect(source).not.toContain("AGUARDANDO AÇÃO");
  });

  it("centralizes the restricted explanation with real signal origins", () => {
    expect(source).toContain("Por que a operação está RESTRICTED?");
    expect(source).toContain("Cobrança vencida sem resolução");
    expect(source).toContain("O.S. atrasadas");
    expect(source).toContain("Agendamento não confirmado");
    expect(source).toContain("Sem execução recente registrada");
    expect(source).toContain("Origem do sinal:");
  });

  it("uses the humanized decision pipeline", () => {
    expect(source).toContain(
      "Sinal → Evidência → Impacto → Decisão → Política → Ação"
    );
    ["Sinal", "Evidência", "Impacto", "Decisão", "Política", "Ação"].forEach(
      label => expect(source).toContain(`label: "${label}"`)
    );
    expect(source).not.toContain(
      "Evento → Timeline → Risco → Governança → Política → Ação"
    );
  });

  it("shows human risk score instead of a raw score", () => {
    expect(source).toContain("humanRiskLabel");
    expect(source).toContain("Risco ${riskLevel} — ${riskScore}");
    expect(source).not.toContain("label={`Score ${riskScore}`}");
  });

  it("keeps critical signs compact and navigational", () => {
    expect(source).toContain("Sinais críticos no momento");
    expect(source).toContain("signals.slice(0, 4)");
    expect(source).toContain("Detectado há");
    expect(source).toContain("onClick={() => navigate(signal.path)}");
    expect(source).toContain("Abrir cobrança");
    expect(source).toContain("Ver O.S. atrasadas");
    expect(source).toContain("Abrir agendamento");
  });

  it("does not invent history or promise fake automation", () => {
    expect(source).toContain(
      "Nenhuma decisão oficial retornada nesta leitura."
    );
    expect(source).toContain("Sem execução oficial retornada.");
    expect(source).toContain("histórico fictício");
    expect(source).toContain("sem executar ações automaticamente");
    expect(source).not.toContain("executada automaticamente");
  });

  it("renders compact operational proof, impacts, policies and system actions", () => {
    expect(source).toContain("Impactos identificados");
    expect(source).toContain("Risco de caixa");
    expect(source).toContain("Perda de previsibilidade");
    expect(source).toContain("Bloqueio de automações");
    expect(source).toContain("Risco de governança");
    expect(source).toContain("Prova operacional");
    expect(source).toContain("Total de eventos");
    expect(source).toContain("Eventos críticos");
    expect(source).toContain("Impactam receita");
    expect(source).toContain("Decisões tomadas");
    expect(source).toContain("Políticas ativas");
    expect(source).toContain("Alertas gerados");
    expect(source).toContain("Ações automáticas registradas");
    expect(source).toContain("Restrições aplicadas");
  });
});
