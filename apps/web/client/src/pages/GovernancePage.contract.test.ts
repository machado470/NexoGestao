import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./GovernancePage.tsx", import.meta.url),
  "utf8"
);

describe("GovernancePage operational supervision center contract", () => {
  it("keeps governance as a four-part operational supervision center without changing data contracts", () => {
    expect(source).toContain("Centro de supervisão operacional");
    expect(source).toContain("Visão executiva");
    expect(source).toContain("Fluxo de decisão da governança");
    expect(source).toContain("Intervenções e ações prioritárias");
    expect(source).toContain("Painel de auditoria");
    expect(source).toContain("trpc.governance.summary.useQuery");
    expect(source).toContain("trpc.governance.runs.useQuery");
  });

  it("shows executive state, impact and next action above the fold", () => {
    expect(source).toContain("stateCopy");
    expect(source).toContain("Operação saudável");
    expect(source).toContain("Operação comprometida");
    expect(source).toContain("Receita em risco");
    expect(source).toContain("Clientes afetados");
    expect(source).toContain("O.S. afetadas");
    expect(source).toContain("Agendamentos afetados");
    expect(source).toContain("Próxima melhor ação");
  });

  it("renders a decision flow as signal, evidence, impact and state", () => {
    expect(source).toContain("Sinal detectado");
    expect(source).toContain("Evidência avaliada");
    expect(source).toContain("Impacto calculado");
    expect(source).toContain("Estado definido");
    expect(source).toContain("Sinais que sustentam a decisão");
    expect(source).toContain("O que isso significa?");
    expect(source).toContain("Recomendação operacional");
  });

  it("keeps interventions compact with priority, impact, recommendation and real CTA", () => {
    expect(source).toContain("Faça agora");
    expect(source).toContain("action.consequence");
    expect(source).toContain("action.recommendation");
    expect(source).toContain("priorityLabel(action.priority)");
    expect(source).toContain("action.primaryActionLabel");
    expect(source).toContain("buildPriorityActions(signals)");
    expect(source).toContain(".slice(0, 3)");
    expect(source).toContain("Nenhuma intervenção urgente");
  });

  it("connects evidence and history in a single audit panel", () => {
    expect(source).toContain("Evidências e histórico na mesma trilha");
    expect(source).toContain("Nenhuma evidência registrada nesta leitura.");
    expect(source).toContain(
      "A próxima execução de governança adicionará provas"
    );
    expect(source).toContain("Histórico de governança");
    expect(source).toContain("A próxima execução registrada aparecerá aqui.");
  });

  it("turns policies into decision rules without fake data or mutations", () => {
    expect(source).toContain("Regras que influenciaram a decisão");
    expect(source).toContain("type ActivePolicy");
    expect(source).toContain("Evidências são registradas em Timeline");
    expect(source).toContain("A regra não fabrica provas");
    expect(source).toContain("trpc.finance.charges.list.useQuery");
    expect(source).not.toContain("mutation");
    expect(source).not.toContain("mock");
  });
});
