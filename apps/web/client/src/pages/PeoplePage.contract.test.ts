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
    expect(source).toContain('title="Visão executiva compacta"');
    expect(source).toContain('title="Ranking operacional da equipe"');
    expect(source).toContain(
      'title="Capacidade, disponibilidade e atribuições"'
    );
    expect(source).toContain('title="Desempenho e impacto da equipe"');
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).toContain('data-testid="people-workload-list"');
    expect(source).toContain(
      'data-testid="people-capacity-availability-assignments"'
    );
    expect(source).toContain('data-testid="people-performance-impact"');
    expect(source).toContain('title="Quem sustenta a operação agora"');
    expect(source).toContain('data-testid="people-key-responsibles"');
  });

  it("mantém a página como responsabilidade operacional, não permissões", () => {
    expect(source).toContain(
      "Equipe operacional · Responsáveis, carga e disponibilidade."
    );
    expect(source).toContain("Permissões em Configurações");
    expect(source).not.toContain(
      "Equipe operacional, não permissões administrativas"
    );
    expect(source).not.toContain(
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
      "Cadastre responsáveis para acompanhar carga, execução e"
    );
    expect(source).toContain('status: "ATENÇÃO"');
  });

  it("renderiza ranking com pessoa, estado, carga, O.S., atrasos, agenda e ações", () => {
    expect(source).toContain("sortByOperationalIntervention(people).filter");
    expect(source).toContain('data-testid="people-workload-list"');
    expect(source).not.toContain("<AppDataTable");
    expect(source).toContain("personInitials(person.name)");
    expect(source).toContain("Carga {loadLabels[person.loadStatus]}");
    expect(source).toContain("Capacidade O.S.");
    expect(source).toContain("O.S. ativas");
    expect(source).toContain("O.S. atrasadas");
    expect(source).toContain("Agenda hoje");
    expect(source).toContain("Impacto: {formatMoneyFallback()}");
    expect(source).toContain("Abrir Timeline");
    expect(source).toContain("Atribuições");
  });

  it("usa somente dados existentes e fallbacks honestos sem inventar financeiro/performance", () => {
    expect(source).toContain("trpc.people.operationalSummary.useQuery");
    expect(source).toContain("trpc.analytics.assigneeWarningSummary.useQuery");
    expect(source).toContain("trpc.people.listAvailabilityExceptions.useQuery");
    expect(source).toContain("trpc.nexo.timeline.listByOrg.useQuery");
    expect(source).toContain('value == null ? "Não configurada"');
    expect(source).toContain('value == null ? "Uso indisponível"');
    expect(source).toContain('capacity == null ? "Diferença indisponível"');
    expect(source).toContain("Aguardando vínculo financeiro");
    expect(source).toContain("sem leitura confiável disponível");
    expect(source).toContain("Aguardando histórico suficiente");
    expect(source).not.toContain("Sem fonte financeira vinculada");
    expect(source).not.toContain("sem fonte confiável");
    expect(source).not.toContain(
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
    expect(source).toContain("Cadastrar responsáveis");
    expect(source).toContain("Resolver atrasos atribuídos");
    expect(source).toContain("Redistribuir carga");
    expect(source).toContain("Revisar disponibilidade");
    expect(source).toContain("Equipe equilibrada");
  });

  it("compacta erro parcial dos sinais de atribuição", () => {
    expect(source).toContain('title="Sinais de atribuição"');
    expect(source).toContain('data-testid="assignee-warning-summary-error"');
    expect(source).toContain("Sinais de atribuição indisponíveis agora.");
    expect(source).toContain(
      "A visão principal continua usando carga, agenda e O.S."
    );
    expect(source).toContain("Tentar novamente");
    expect(source).toContain("Nenhum sinal crítico registrado em atribuições.");
    expect(source).toContain("0 alertas exibidos");
    expect(source).toContain("0 confirmações após alerta");
    expect(source).not.toContain(
      "Não foi possível carregar people.operationalSummary"
    );
  });

  it("protege atividade recente com timeline real e fallback honesto", () => {
    expect(source).toContain('title="Atividade recente da equipe"');
    expect(source).toContain('data-testid="people-team-activity"');
    expect(source).toContain("teamTimelineEvents.length > 0");
    expect(source).toContain("Aguardando eventos da equipe.");
    expect(source).toContain("Quando responsáveis executarem O.S., agenda,");
    expect(source).toContain("cobrança ou");
    expect(source).toContain("mensagens, as ações aparecerão aqui.");
    expect(source).toContain("Abrir Timeline");
  });

  it("protege desempenho e impacto com fallback operacional positivo", () => {
    expect(source).toContain("Assim que houver O.S. concluídas");
    expect(source).toContain("Quando houver cobranças vinculadas à execução");
    expect(source).toContain(
      "Eventos de O.S., agenda, cobrança e mensagem aparecerão aqui."
    );
  });

  it("mantém nova ordem dos blocos e visão executiva compacta sem cards pesados", () => {
    const executiveIndex = source.indexOf('title="Visão executiva compacta"');
    const keyIndex = source.indexOf('title="Quem sustenta a operação agora"');
    const actionIndex = source.indexOf("<NextBestActionCard");
    const activityIndex = source.indexOf('title="Atividade recente da equipe"');
    const rankingIndex = source.indexOf(
      'title="Ranking operacional da equipe"'
    );
    expect(executiveIndex).toBeLessThan(keyIndex);
    expect(keyIndex).toBeLessThan(actionIndex);
    expect(actionIndex).toBeLessThan(activityIndex);
    expect(activityIndex).toBeLessThan(rankingIndex);
    expect(source).toContain('aria-label="Métricas executivas compactas"');
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
