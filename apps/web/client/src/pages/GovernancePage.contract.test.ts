import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./GovernancePage.tsx", import.meta.url),
  "utf8"
);

describe("GovernancePage operational supervision center contract", () => {
  it("keeps governance as an operational supervision center without changing data contracts", () => {
    expect(source).toContain("Centro de supervisão operacional");
    expect(source).toContain(
      "Detecta sinais, interpreta impacto e orienta a intervenção"
    );
    expect(source).toContain("NexoOperationalState");
    expect(source).toContain("lastEvaluationLabel");
    expect(source).not.toContain("AGUARDANDO AÇÃO");
  });

  it("renders the FAÇA AGORA matrix with impact, recommendation, priority and action", () => {
    expect(source).toContain("Matriz de intervenção");
    expect(source).toContain("Faça agora");
    expect(source).toContain("action.consequence");
    expect(source).toContain("action.recommendation");
    expect(source).toContain("priorityLabel(action.priority)");
    expect(source).toContain("action.primaryActionLabel");
    expect(source).toContain("buildPriorityActions(signals)");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("Nenhuma ação prioritária");
  });

  it("turns official evidence empty state into an audit panel with reserved future area", () => {
    expect(source).toContain("Evidências oficiais");
    expect(source).toContain("Painel de auditoria");
    expect(source).toContain("Evidências e histórico na mesma trilha");
    expect(source).toContain("Área reservada para anexar a próxima prova");
    expect(source).toContain("Trilha auditável · Abrir Timeline");
    expect(source).toContain("Timeline/Governança sem fabricar histórico");
  });

  it("keeps governance history alive as a decision container even when empty", () => {
    expect(source).toContain("Histórico de governança");
    expect(source).toContain("Container de decisões");
    expect(source).toContain("A próxima execução registrada aparecerá aqui.");
    expect(source).not.toContain("histórico fictício");
  });

  it("turns policies into operational entities with active and neutral status badges", () => {
    expect(source).toContain("Políticas ativas");
    expect(source).toContain("type ActivePolicy");
    expect(source).toContain("objective: string");
    expect(source).toContain("impactando: string");
    expect(source).toContain("lastEvaluation: string");
    expect(source).toContain("Painel de controle");
    expect(source).toContain("{policy.objective}");
    expect(source).toContain("{policy.impactando}");
    expect(source).toContain("{policy.lastEvaluation}");
    expect(source).toContain("var(--app-success)_26%");
    expect(source).toContain("var(--app-accent)_12%");
  });

  it("does not introduce fake data, endpoints or business-rule mutations", () => {
    expect(source).toContain("trpc.governance.summary.useQuery");
    expect(source).toContain("trpc.governance.runs.useQuery");
    expect(source).toContain("trpc.finance.charges.list.useQuery");
    expect(source).not.toContain("mutation");
    expect(source).not.toContain("mock");
  });
});
