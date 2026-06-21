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
const compactSource = source.replace(/\s+/g, " ");

describe("PeoplePage premium operational cockpit contract", () => {
  it("protege os blocos principais premium", () => {
    expect(source).toContain('title="Visão executiva compacta"');
    expect(source).toContain('title="Quem sustenta a operação agora"');
    expect(source).toContain('title="Atividade recente da equipe"');
    expect(source).toContain('title="Ranking operacional da equipe"');
    expect(source).toContain('title="Capacidade da operação"');
    expect(source).toContain('title="Desempenho e impacto da equipe"');
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).toContain('data-testid="people-key-responsibles"');
    expect(source).toContain('data-testid="people-team-activity"');
    expect(source).toContain('data-testid="people-workload-list"');
    expect(source).toContain(
      'data-testid="people-capacity-availability-assignments"'
    );
    expect(source).toContain('data-testid="people-performance-impact"');
  });

  it("mantém a página como responsabilidade operacional, não permissões", () => {
    expect(source).toContain(
      "Equipe operacional · Responsáveis, carga e disponibilidade."
    );
    expect(source).toContain("Permissões em Configurações");
    expect(source).not.toContain("Detail-legacy mantido");
  });

  it("protege visão executiva com narrativa humana e sem saúde enganosa sem pessoas", () => {
    expect(source).toContain("Equipe saudável");
    expect(source).toContain(
      "sem sobrecarga, atrasos ou indisponibilidades registradas"
    );
    expect(source).toContain("Equipe exige atenção");
    expect(source).toContain("podem comprometer a execução");
    expect(source).toContain("Sem responsáveis operacionais");
    expect(source).toContain(
      "Cadastre responsáveis para distribuir O.S., agenda e carga de trabalho."
    );
    expect(source).toContain('status: "ATENÇÃO"');
    expect(source).toContain('aria-label="Métricas executivas compactas"');
  });

  it("protege card único de responsável com presença visual e leitura humana", () => {
    expect(source).toContain('keyPeople.length === 1 ? "xl:grid-cols-1"');
    expect(source).toContain('keyPeople.length === 2 ? "xl:grid-cols-2"');
    expect(source).toContain("h-14 w-14");
    expect(source).toContain("personHumanReading(person)");
    expect(source).toContain("Executando normalmente");
    expect(source).toContain("Acima da capacidade");
    expect(source).toContain("Indisponível agora");
    expect(source).toContain("Com atrasos atribuídos");
    expect(source).toContain("Última atividade:");
    expect(source).toContain("Ver detalhe");
    expect(source).toContain("Timeline");
  });

  it("humaniza eventos da Timeline sem enum cru em atividade recente", () => {
    expect(source).toContain("timelineActionLabels");
    expect(source).toContain("OPERATIONAL_STATE_CHANGED");
    expect(source).toContain("Operação voltou ao estado saudável");
    expect(source).toContain("GOVERNANCE_RUN_COMPLETED");
    expect(source).toContain("Governança reavaliou a operação");
    expect(source).toContain("O.S. iniciada");
    expect(source).toContain("O.S. concluída");
    expect(source).toContain("Agendamento confirmado");
    expect(source).toContain("Cobrança criada");
    expect(source).toContain("Pagamento registrado");
    expect(source).toContain("Mensagem enviada");
    expect(source).toContain("Evento operacional registrado");
    expect(source).toContain("unsafeTimelineEnumPattern");
    expect(source).toContain("humanizeTimelineText");
  });

  it("renderiza ranking com frases humanas e indicadores agrupados", () => {
    expect(source).toContain("sortByOperationalIntervention(people).filter");
    expect(source).toContain('data-testid="people-workload-list"');
    expect(source).not.toContain("<AppDataTable");
    expect(source).toContain("personInitials(person.name)");
    expect(source).toContain("personHumanReading(person)");
    expect(source).toContain("Operação: O.S.");
    expect(source).toContain("Risco: Atrasos");
    expect(source).toContain("Sobrecarga {isPersonOverloaded(person) ?");
    expect(source).toContain("Capacidade: O.S.");
    expect(source).toContain("Detalhe");
    expect(source).toContain("Atribuições");
  });

  it("consolida capacidade e disponibilidade em painel único", () => {
    expect(source).toContain('title="Capacidade da operação"');
    expect(source).toContain("Capacidade sob controle");
    expect(source).toContain("Gargalos atuais de capacidade");
    expect(source).toContain("capacityNarrative(header)");
    expect(source).toContain("Capacidade utilizada: O.S.");
    expect(source).toContain("Disponíveis agora:");
    expect(source).toContain("Gargalos atuais:");
    expect(source).toContain("Próximas indisponibilidades:");
  });

  it("compacta desempenho quando não há dados e não inventa métricas", () => {
    expect(source).toContain("Evolução da equipe");
    expect(compactSource).toContain(
      "Ainda não existe histórico suficiente para gerar indicadores confiáveis."
    );
    expect(source).toContain("sem inventar métricas");
    expect(source).toContain("Abrir Timeline");
    expect(source).toContain("Aguardando vínculo financeiro");
    expect(source).toContain('value == null ? "Não configurada"');
    expect(source).toContain('value == null ? "Uso indisponível"');
    expect(source).toContain('capacity == null ? "Diferença indisponível"');
    expect(source).not.toContain("Math.random");
  });

  it("compacta sinais de atribuição zerados e erro parcial", () => {
    expect(source).toContain('title="Sinais de atribuição"');
    expect(source).toContain('data-testid="assignee-warning-summary-error"');
    expect(source).toContain("Sinais de atribuição indisponíveis agora.");
    expect(source).toContain(
      "A visão principal continua usando carga, agenda e O.S."
    );
    expect(source).toContain("Tentar novamente");
    expect(source).toContain("Não houve alertas de atribuição recentemente.");
    expect(source).toContain("0 alertas exibidos · 0 confirmações após alerta");
  });

  it("mantém próxima melhor ação com problema, consequência, segurança e CTAs", () => {
    expect(source).toContain("<NextBestActionCard");
    expect(source).toContain("reason={nextBestAction.reason}");
    expect(source).toContain("impact={nextBestAction.impact}");
    expect(source).toContain("safetyNote={nextBestAction.safetyNote}");
    expect(source).toContain("Cadastrar responsáveis");
    expect(source).toContain("Resolver atrasos atribuídos");
    expect(source).toContain("Redistribuir carga");
    expect(source).toContain("Revisar disponibilidade");
    expect(source).toContain("Equipe equilibrada");
  });

  it("mantém nova ordem dos blocos", () => {
    const executiveIndex = source.indexOf('title="Visão executiva compacta"');
    const keyIndex = source.indexOf('title="Quem sustenta a operação agora"');
    const actionIndex = source.indexOf("<NextBestActionCard");
    const activityIndex = source.indexOf('title="Atividade recente da equipe"');
    const rankingIndex = source.indexOf(
      'title="Ranking operacional da equipe"'
    );
    const capacityIndex = source.indexOf('title="Capacidade da operação"');
    expect(executiveIndex).toBeLessThan(keyIndex);
    expect(keyIndex).toBeLessThan(actionIndex);
    expect(actionIndex).toBeLessThan(activityIndex);
    expect(activityIndex).toBeLessThan(rankingIndex);
    expect(rankingIndex).toBeLessThan(capacityIndex);
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
    expect(source).not.toContain("trpc.people.redistribute");
  });
});
