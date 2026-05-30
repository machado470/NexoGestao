import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PeoplePage.tsx", import.meta.url), "utf8");

describe("PeoplePage operational workload contract", () => {
  it("renderiza o header operacional real", () => {
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).toContain('label="Pessoas ativas"');
    expect(source).toContain('label="Sobrecarregados"');
    expect(source).toContain('label="O.S. atrasadas atribuídas"');
    expect(source).toContain('label="Agendamentos hoje"');
  });

  it("renderiza a tabela de carga por responsável", () => {
    expect(source).toContain('data-testid="people-workload-table"');
    expect(source).toContain("O.S. abertas");
    expect(source).toContain("Próximos agendamentos");
    expect(source).toContain("loadLabels[person.loadStatus]");
  });

  it("não inventa performance individual sem dado confiável", () => {
    expect(source).not.toContain("performanceLabel");
    expect(source).not.toContain("Tempo médio");
    expect(source).not.toContain("estimada");
    expect(source).not.toContain("impacto financeiro");
  });
});
