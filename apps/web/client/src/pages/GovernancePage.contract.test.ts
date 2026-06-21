import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./GovernancePage.tsx", import.meta.url),
  "utf8"
);

describe("GovernancePage operational supervision center contract", () => {
  it("keeps governance as an operational supervision center without changing data contracts", () => {
    expect(source).toContain("Centro de supervisão operacional");
    expect(source).toContain("Visão executiva");
    expect(source).toContain("Próxima supervisão");
    expect(source).toContain("Ações que o sistema fará");
    expect(source).toContain("Diagnóstico operacional");
    expect(source).toContain("Políticas ativas");
    expect(source).toContain("Histórico e evidências");
    expect(source).toContain("trpc.governance.summary.useQuery");
    expect(source).toContain("trpc.governance.runs.useQuery");
  });

  it("keeps the executive hero compact and explains warning caused by missing evaluation", () => {
    expect(source).toContain("p-4 md:p-5");
    expect(source).toContain("Governança aguardando leitura");
    expect(source).toContain(
      "Nenhuma execução recente da governança foi registrada."
    );
    expect(source).toContain(
      "A operação está em atenção porque ainda não há validação automática recente."
    );
    expect(source).toContain(
      "Sem sinais críticos carregados; atenção causada por ausência de leitura recente."
    );
    expect(source).toContain("impactMetricsAreZero");
  });

  it("groups zero impact metrics compactly while preserving operational signals", () => {
    expect(source).toContain("Receita em risco");
    expect(source).toContain("Clientes afetados");
    expect(source).toContain("O.S. afetadas");
    expect(source).toContain("WhatsApp com falha");
    expect(source).toContain("Agendamentos afetados");
    expect(source).toContain("Sem impacto operacional ativo nesta leitura");
  });

  it("shows continuity and recent activity with honest fallbacks", () => {
    expect(source).toContain("O que acontece agora");
    expect(source).toContain("Próxima avaliação");
    expect(source).toContain("Gatilho observado");
    expect(source).toContain("Fila de governança");
    expect(source).toContain("Nas últimas 24h");
    expect(source).toContain(
      "Sem base suficiente para calcular atividade recente."
    );
    expect(source).toContain("Aguardando próxima execução registrada.");
  });

  it("renders a direct operational diagnosis instead of a machine reasoning flow", () => {
    expect(source).toContain("Motivo principal");
    expect(source).toContain("Evidência encontrada");
    expect(source).toContain("Consequência operacional");
    expect(source).toContain("Impacto");
    expect(source).toContain("Decisão");
    expect(source).toContain("Ação recomendada");
    expect(source).toContain("Por que estou nesse estado?");
    expect(source).not.toContain("Sinal detectado → Evidência encontrada");
    expect(source).not.toContain("ArrowRight");
  });

  it("keeps interventions and compact policies without fake data or mutations", () => {
    expect(source).toContain("buildPriorityActions(signals)");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("Nenhuma intervenção urgente");
    expect(source).toContain("Controles compactos usados nesta leitura");
    expect(source).toContain("✓ {policy.name}");
    expect(source).toContain("Evidências são registradas em Timeline");
    expect(source).toContain("a regra não fabrica provas");
    expect(source).toContain("trpc.finance.charges.list.useQuery");
    expect(source).toContain("trpc.dashboard.kpis.useQuery");
    expect(source).toContain("Falhas WhatsApp");
    expect(source).not.toContain("mutation");
    expect(source).not.toContain("mock");
  });
});
