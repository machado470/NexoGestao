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

describe("PeoplePage temporary availability contract", () => {
  it("renderiza disponibilidade atual, próxima indisponibilidade e lista de exceções", () => {
    expect(source).toContain("availabilityLabels[person.availabilityStatus]");
    expect(source).toContain("Disponibilidade atual");
    expect(source).toContain("Próxima indisponibilidade:");
    expect(source).toContain("Indisponibilidades recentes e futuras");
  });

  it("envia create e delete pelas procedures tenant-scoped", () => {
    expect(source).toContain("trpc.people.createAvailabilityException.useMutation");
    expect(source).toContain("trpc.people.deleteAvailabilityException.useMutation");
    expect(source).toContain("createAvailabilityException.mutate({ personId: selectedPersonId");
    expect(source).toContain("deleteAvailabilityException.mutate({ personId: selectedPerson.personId, exceptionId: exception.id })");
  });
});

describe("PeoplePage assignee warning summary", () => {
  it("renderiza a leitura agregada administrativa com linguagem observacional", () => {
    expect(source).toContain("trpc.analytics.assigneeWarningSummary.useQuery");
    expect(source).toContain('title="Sinais de atribuição"');
    expect(source).toContain('data-testid="assignee-warning-summary"');
    expect(source).toContain('label="Alertas exibidos"');
    expect(source).toContain('label="Confirmações após alerta"');
    expect(source).toContain('label="Taxa de confirmação"');
    expect(source).toContain("Contextos observados");
    expect(source).toContain("Sinal mais frequente");
    expect(source).not.toContain("ranking competitivo");
    expect(source).not.toContain("score de produtividade");
  });
});
