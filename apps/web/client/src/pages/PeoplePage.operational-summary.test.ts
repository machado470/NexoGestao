import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PeoplePage.tsx", import.meta.url), "utf8");
const editModal = readFileSync(new URL("../components/EditPersonModal.tsx", import.meta.url), "utf8");

describe("PeoplePage operational workload contract", () => {
  it("renderiza o header operacional real", () => {
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).toContain('label="Pessoas ativas"');
    expect(source).toContain('label="Sobrecarregados"');
    expect(source).toContain('label="O.S. atrasadas atribuídas"');
    expect(source).toContain('label="Agendamentos hoje"');
  });

  it("renderiza carga e capacidade por responsável", () => {
    expect(source).toContain('data-testid="people-workload-table"');
    expect(source).toContain("O.S. abertas");
    expect(source).toContain("Próximos agendamentos");
    expect(source).toContain("Capacidade O.S.");
    expect(source).toContain("Capacidade agenda");
    expect(source).toContain("capacityLabels[person.capacityStatus]");
    expect(source).toContain("formatUsage(person.serviceOrderCapacityUsagePct)");
  });

  it("não inventa capacidade quando o resumo não a informa", () => {
    expect(source).toContain('value == null ? "Não configurada"');
    expect(source).toContain('value == null ? "Uso indisponível"');
    expect(source).toContain('capacity == null ? "Diferença indisponível"');
  });

  it("envia os campos mínimos pelo modal estável de edição", () => {
    expect(editModal).toContain("dailyServiceOrderCapacity,");
    expect(editModal).toContain("dailyAppointmentCapacity,");
    expect(editModal).toContain("workloadNotes: formData.workloadNotes.trim() || null");
    expect(editModal).toContain('id="edit-person-service-order-capacity"');
    expect(editModal).toContain('id="edit-person-appointment-capacity"');
    expect(editModal).toContain('id="edit-person-workload-notes"');
  });

  it("não inventa performance individual sem dado confiável", () => {
    expect(source).not.toContain("performanceLabel");
    expect(source).not.toContain("Tempo médio");
    expect(source).not.toContain("impacto financeiro");
  });
});
