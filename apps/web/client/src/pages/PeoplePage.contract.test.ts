import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./PeoplePage.tsx", import.meta.url),
  "utf8"
);
const editModal = readFileSync(
  new URL("../components/EditPersonModal.tsx", import.meta.url),
  "utf8"
);

describe("PeoplePage operational responsibility center contract", () => {
  it("protege os 4 blocos principais aprovados", () => {
    expect(source).toContain('title="Visão executiva da equipe"');
    expect(source).toContain('title="Ranking operacional da equipe"');
    expect(source).toContain(
      'title="Capacidade, disponibilidade e atribuições"'
    );
    expect(source).toContain('title="Desempenho e impacto da equipe"');
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).toContain('data-testid="people-workload-table"');
    expect(source).toContain(
      'data-testid="people-capacity-availability-assignments"'
    );
    expect(source).toContain('data-testid="people-performance-impact"');
  });

  it("mantém a página como responsabilidade operacional, não permissões", () => {
    expect(source).toContain(
      "Equipe operacional, não permissões administrativas"
    );
    expect(source).toContain(
      "Acessos e permissões continuam em Configurações."
    );
    expect(source).not.toContain("Detail-legacy mantido");
    expect(source).not.toContain(
      "serve somente para observação operacional das decisões manuais"
    );
  });

  it("não mostra saúde normal enganosa quando não há pessoas", () => {
    expect(source).toContain("Sem responsáveis operacionais cadastrados.");
    expect(source).toContain("Sem responsáveis cadastrados.");
    expect(source).toContain(
      "Cadastre responsáveis para acompanhar carga, execução e indisponibilidade."
    );
    expect(source).toContain('status: "ATENÇÃO"');
  });

  it("renderiza ranking com pessoa, estado, carga, O.S., atrasos, agenda e ações", () => {
    expect(source).toContain("sortByOperationalIntervention(people).filter");
    expect(source).toContain("Responsável");
    expect(source).toContain("Função operacional");
    expect(source).toContain("Estado");
    expect(source).toContain("Carga atual");
    expect(source).toContain("Capacidade planejada");
    expect(source).toContain("O.S. ativas");
    expect(source).toContain("O.S. atrasadas");
    expect(source).toContain("Agenda hoje");
    expect(source).toContain("Valor 7 dias");
    expect(source).toContain("Abrir Timeline");
    expect(source).toContain("Filtrar atribuições");
  });

  it("usa somente dados existentes e fallbacks honestos sem inventar financeiro/performance", () => {
    expect(source).toContain("trpc.people.operationalSummary.useQuery");
    expect(source).toContain("trpc.analytics.assigneeWarningSummary.useQuery");
    expect(source).toContain("trpc.people.listAvailabilityExceptions.useQuery");
    expect(source).toContain('value == null ? "Não configurada"');
    expect(source).toContain('value == null ? "Uso indisponível"');
    expect(source).toContain('capacity == null ? "Diferença indisponível"');
    expect(source).toContain("Sem fonte financeira vinculada");
    expect(source).toContain("sem fonte confiável");
    expect(source).toContain(
      "Sem histórico operacional suficiente para medir desempenho ainda."
    );
  });

  it("mantém próxima melhor ação com problema, consequência, segurança e CTAs", () => {
    expect(source).toContain("<NextBestActionCard");
    expect(source).toContain("reason={nextBestAction.reason}");
    expect(source).toContain("impact={nextBestAction.impact}");
    expect(source).toContain("safetyNote={nextBestAction.safetyNote}");
    expect(source).toContain(
      "primaryActionLabel={nextBestAction.primaryActionLabel}"
    );
    expect(source).toContain(
      "secondaryActionLabel={nextBestAction.secondaryActionLabel}"
    );
    expect(source).toContain("Redistribuir responsabilidades");
    expect(source).toContain("Destravar execução");
    expect(source).toContain("Rebalancear carga");
  });

  it("compacta erro parcial dos sinais de atribuição", () => {
    expect(source).toContain('title="Sinais de atribuição"');
    expect(source).toContain('data-testid="assignee-warning-summary-error"');
    expect(source).toContain("Sinais de atribuição indisponíveis agora.");
    expect(source).toContain(
      "A página continua usando carga, agenda e O.S. disponíveis."
    );
    expect(source).toContain("Tentar novamente");
    expect(source).not.toContain(
      "Não foi possível carregar people.operationalSummary"
    );
  });

  it("preserva edição de capacidade e indisponibilidade sem nova mutação operacional", () => {
    expect(editModal).toContain("dailyServiceOrderCapacity,");
    expect(editModal).toContain("dailyAppointmentCapacity,");
    expect(editModal).toContain(
      "workloadNotes: formData.workloadNotes.trim() || null"
    );
    expect(source).toContain(
      "trpc.people.createAvailabilityException.useMutation"
    );
    expect(source).toContain(
      "trpc.people.deleteAvailabilityException.useMutation"
    );
    expect(source).toContain("createAvailabilityException.mutate({");
    expect(source).toContain("deleteAvailabilityException.mutate({");
    expect(source).not.toContain("Math.random");
  });
});
