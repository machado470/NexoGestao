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
  it("protege hero dominante fundido com narrativa operacional", () => {
    expect(source).toContain("Cockpit humano da equipe");
    expect(source).toContain("Centro de Responsáveis da Operação");
    expect(source).toContain("teamHeroNarrative(people, header)");
    expect(source).toContain("sustenta 100% da operação atual");
    expect(source).toContain(
      "Nenhum atraso, sobrecarga ou indisponibilidade foi detectado"
    );
    expect(source).toContain('aria-label="Métricas executivas compactas"');
    expect(source).toContain("Ativos {header.activePeople}");
    expect(source).toContain("Sobrecarga {header.overloadedPeople}");
    expect(source).toContain("O.S. atrasadas {header.overdueServiceOrders}");
    expect(source).toContain("Agenda hoje {header.todayAppointments}");
    expect(source).toContain("Indisponíveis {header.unavailablePeople}");
    expect(source).toContain('data-testid="people-operational-header"');
    expect(source).not.toContain(
      'title="Topo — Centro de Responsáveis da Operação"'
    );
  });

  it("mantém a página como responsabilidade operacional, não permissões", () => {
    expect(source).toContain("Permissões em Configurações");
    expect(source).toContain("Nova pessoa");
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
  });

  it("protege responsável único com layout largo e leitura humana", () => {
    expect(source).toContain('keyPeople.length === 1 ? "xl:grid-cols-1"');
    expect(source).toContain('keyPeople.length === 2 ? "xl:grid-cols-2"');
    expect(source).toContain("md:grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(source).toContain("h-16 w-16");
    expect(source).toContain("personOperationalSentence(person)");
    expect(source).toContain(
      "Responsável principal pela execução operacional da equipe."
    );
    expect(source).toContain(
      "Capacidade disponível. Nenhum atraso registrado."
    );
    expect(source).toContain("Última atividade:");
    expect(source).toContain("Ver detalhe");
    expect(source).toContain("Timeline");
  });

  it("protege próxima ação saudável sem visual de alerta", () => {
    expect(source).toContain("hasOperationalProblem ?");
    expect(source).toContain('data-testid="people-healthy-next-action"');
    expect(source).toContain("Equipe equilibrada");
    expect(source).toContain("Nenhuma intervenção necessária neste momento.");
    expect(source).toContain("border-[var(--success,var(--status-normal))]/25");
    expect(source).toContain("<NextBestActionCard");
    expect(source).toContain("reason={nextBestAction.reason}");
    expect(source).toContain("impact={nextBestAction.impact}");
    expect(source).toContain("safetyNote={nextBestAction.safetyNote}");
  });

  it("humaniza eventos da Timeline sem enum cru em atividade recente", () => {
    expect(source).toContain("timelineActionLabels");
    expect(source).toContain("OPERATIONAL_STATE_CHANGED");
    expect(source).toContain("Operação voltou ao estado saudável");
    expect(source).toContain("GOVERNANCE_RUN_COMPLETED");
    expect(source).toContain("Governança reavaliou a operação");
    expect(source).toContain(
      "Governança reavaliou a equipe e manteve a leitura"
    );
    expect(source).toContain("Evento operacional registrado");
    expect(source).toContain("unsafeTimelineEnumPattern");
    expect(source).toContain("humanizeTimelineText");
  });

  it("renderiza ranking com frases humanas e sem labels rígidos excessivos", () => {
    expect(source).toContain("sortByOperationalIntervention(people).filter");
    expect(source).toContain('data-testid="people-workload-list"');
    expect(source).not.toContain("<AppDataTable");
    expect(source).toContain("personInitials(person.name)");
    expect(source).toContain("rankingNarrative(person)");
    expect(source).toContain(
      "Sem carga atribuída atualmente. Capacidade totalmente disponível. Nenhum atraso registrado."
    );
    expect(compactSource).toContain(
      "O.S. {person.openServiceOrdersCount} · Agenda"
    );
    expect(source).not.toContain("Operação: O.S.");
    expect(source).not.toContain("Risco: Atrasos");
    expect(source).not.toContain("Capacidade: O.S.");
    expect(source).toContain("Detalhe");
    expect(source).toContain("Atribuições");
  });

  it("compacta capacidade, evolução e sinais quando saudáveis ou zerados", () => {
    expect(source).toContain('title="Capacidade da operação"');
    expect(source).toContain("Capacidade sob controle");
    expect(source).toContain("Gargalos atuais de capacidade");
    expect(source).toContain("capacityNarrative(header)");
    expect(source).toContain("sem gargalos · sem indisponibilidades previstas");
    expect(source).toContain(
      'data-testid="people-capacity-availability-assignments"'
    );
    expect(source).not.toContain('title="Capacidade, evolução e sinais"');
    expect(source).toContain("Evolução da equipe");
    expect(compactSource).toContain(
      "Ainda não existe histórico suficiente para gerar indicadores confiáveis."
    );
    expect(source).toContain("sem inventar métricas");
    expect(source).toContain("Abrir Timeline");
    expect(source).toContain("Não houve alertas de atribuição recentemente.");
    expect(source).toContain("0 alertas exibidos · 0 confirmações após alerta");
  });

  it("preserva fallbacks honestos, ausência de dados falsos e tokens", () => {
    expect(source).toContain("Aguardando vínculo financeiro");
    expect(source).toContain('value == null ? "Não configurada"');
    expect(source).toContain('value == null ? "Uso indisponível"');
    expect(source).toContain('capacity == null ? "Diferença indisponível"');
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("bg-black");
    expect(source).not.toContain("bg-zinc-900");
    expect(source).not.toContain("bg-slate-900");
  });

  it("mantém sinais de atribuição com erro parcial e retry", () => {
    expect(source).toContain('title="Sinais de atribuição"');
    expect(source).toContain('data-testid="assignee-warning-summary-error"');
    expect(source).toContain("Sinais de atribuição indisponíveis agora.");
    expect(source).toContain(
      "A visão principal continua usando carga, agenda e O.S."
    );
    expect(source).toContain("Tentar novamente");
  });

  it("mantém nova ordem dos blocos", () => {
    const heroIndex = source.indexOf('data-testid="people-operational-header"');
    const keyIndex = source.indexOf('title="Quem sustenta a operação agora"');
    const actionIndex = source.indexOf("hasOperationalProblem ?");
    const activityIndex = source.indexOf('data-testid="people-team-activity"');
    const rankingIndex = source.indexOf(
      'title="Ranking operacional — todos os responsáveis"'
    );
    const capacityIndex = source.indexOf('title="Capacidade da operação"');
    expect(heroIndex).toBeLessThan(keyIndex);
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
