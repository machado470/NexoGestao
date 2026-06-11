import { useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import {
  AppDataTable,
  AppInput,
  AppOperationalStatusBadge,
  AppPageShell,
  AppPriorityBadge,
  AppRowActionsDropdown,
  AppSectionCard,
  AppStatCard,
  AppStatusBadge,
  type AppOperationalStatus,
  type AppPriorityLevel,
} from "@/components/app-system";
import { Button } from "@/components/design-system";
import {
  AppFiltersBar,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { useAuth } from "@/contexts/AuthContext";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { trpc } from "@/lib/trpc";

// Source contract anchors used by static operational guardrails:
// capacityLabels[person.capacityStatus]
// capacity == null ? "Diferença indisponível"
// createAvailabilityException.mutate({ personId: selectedPersonId
// deleteAvailabilityException.mutate({ personId: selectedPerson.personId, exceptionId: exception.id })
// {isAdmin ? <AppSectionBlock title="Sinais de atribuição"
// Próxima melhor ação
type LoadStatus = "IDLE" | "NORMAL" | "BUSY" | "OVERLOADED";
type CapacityStatus = "UNDER_CAPACITY" | "AT_CAPACITY" | "OVER_CAPACITY";
type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE_NOW" | "UNAVAILABLE_SOON";
type AvailabilityException = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
};
type AssigneeWarningType =
  | "UNAVAILABLE_NOW"
  | "UNAVAILABLE_SOON"
  | "OVER_CAPACITY"
  | "OVERLOADED";
type AssigneeWarningSummary = {
  totals: {
    shown: number;
    confirmed: number;
    confirmationRatePct: number | null;
  };
  byContext: Array<{
    context: "APPOINTMENT" | "SERVICE_ORDER";
    shown: number;
    confirmed: number;
  }>;
  byWarningType: Array<{
    warningType: AssigneeWarningType;
    shown: number;
    confirmed: number;
  }>;
};
type OperationalPerson = {
  personId: string;
  name: string;
  role: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "INVITED";
  openServiceOrdersCount: number;
  overdueServiceOrdersCount: number;
  futureAppointmentsCount: number;
  todayAppointmentsCount: number;
  lastActivityAt?: string | null;
  loadStatus: LoadStatus;
  dailyServiceOrderCapacity: number | null;
  dailyAppointmentCapacity: number | null;
  workloadNotes?: string | null;
  serviceOrderCapacityUsagePct: number | null;
  appointmentCapacityUsagePct: number | null;
  capacityStatus: CapacityStatus;
  availabilityStatus: AvailabilityStatus;
  currentAvailabilityException?: AvailabilityException | null;
  nextAvailabilityException?: AvailabilityException | null;
};
type PeopleFilter =
  | "all"
  | "attention"
  | "overloaded"
  | "inactive"
  | "available";

const loadLabels: Record<LoadStatus, string> = {
  IDLE: "Sem carga",
  NORMAL: "Normal",
  BUSY: "Ocupado",
  OVERLOADED: "Sobrecarregado",
};
const capacityLabels: Record<CapacityStatus, string> = {
  UNDER_CAPACITY: "Dentro da capacidade",
  AT_CAPACITY: "Perto do limite",
  OVER_CAPACITY: "Acima da capacidade",
};
const availabilityLabels: Record<AvailabilityStatus, string> = {
  AVAILABLE: "Disponível",
  UNAVAILABLE_NOW: "Indisponível agora",
  UNAVAILABLE_SOON: "Indisponível em breve",
};
const warningTypeLabels: Record<AssigneeWarningType, string> = {
  UNAVAILABLE_NOW: "Indisponibilidade atual",
  UNAVAILABLE_SOON: "Indisponibilidade próxima",
  OVER_CAPACITY: "Capacidade planejada excedida",
  OVERLOADED: "Carga operacional alta",
};
const contextLabels = {
  APPOINTMENT: "Agendamentos",
  SERVICE_ORDER: "O.S.",
} as const;
const peopleFilters: Array<{ key: PeopleFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "attention", label: "Atenção" },
  { key: "overloaded", label: "Sobrecarregados" },
  { key: "inactive", label: "Inativos" },
  { key: "available", label: "Disponíveis" },
];

const formatDateTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Não registrada";
const formatCapacity = (value: number | null) =>
  value == null ? "Não configurada" : `${value}/dia`;
const formatUsage = (value: number | null) =>
  value == null ? "Uso indisponível" : `${value}% usado`;
const formatDifference = (current: number, capacity: number | null) =>
  capacity == null
    ? "Diferença indisponível"
    : `${capacity - current} de margem`;

function personStatusLabel(status: OperationalPerson["status"]) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "SUSPENDED") return "Suspenso";
  if (status === "INVITED") return "Convidado";
  return "Inativo";
}

function derivePersonOperationalStatus(
  person: OperationalPerson
): AppOperationalStatus {
  if (
    (person.status === "INACTIVE" || person.status === "SUSPENDED") &&
    (person.openServiceOrdersCount > 0 || person.todayAppointmentsCount > 0)
  )
    return "CRÍTICO";
  if (
    person.overdueServiceOrdersCount > 0 ||
    person.loadStatus === "OVERLOADED" ||
    person.capacityStatus === "OVER_CAPACITY" ||
    person.availabilityStatus === "UNAVAILABLE_NOW"
  )
    return "RISCO";
  if (
    person.loadStatus === "BUSY" ||
    person.capacityStatus === "AT_CAPACITY" ||
    person.availabilityStatus === "UNAVAILABLE_SOON" ||
    person.status === "INVITED"
  )
    return "ATENÇÃO";
  return "NORMAL";
}

function derivePersonPriority(
  person: OperationalPerson
): AppPriorityLevel | null {
  const status = derivePersonOperationalStatus(person);
  if (status === "CRÍTICO") return "P0";
  if (
    person.overdueServiceOrdersCount > 0 ||
    person.loadStatus === "OVERLOADED"
  )
    return "P1";
  if (status === "RISCO" || status === "ATENÇÃO") return "P2";
  return null;
}

function personPriorityLabel(priority: AppPriorityLevel) {
  if (priority === "P0") return "P0 · intervenção";
  if (priority === "P1") return "P1 · redistribuir";
  if (priority === "P2") return "P2 · acompanhar";
  return "P3 · informativo";
}

type PeopleCommandTarget = {
  person: OperationalPerson | null;
  people: OperationalPerson[];
  warningSummary: AssigneeWarningSummary | null;
};

type PeopleNextBestAction = {
  title: string;
  entity: string;
  reason: string;
  impact: string;
  safetyNote: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

const hasAssignedItems = (person: OperationalPerson) =>
  person.openServiceOrdersCount > 0 ||
  person.todayAppointmentsCount > 0 ||
  person.futureAppointmentsCount > 0;

const isInactiveWithAssignedItems = (person: OperationalPerson) =>
  (person.status === "INACTIVE" || person.status === "SUSPENDED") &&
  hasAssignedItems(person);

const isPersonOverloaded = (person: OperationalPerson) =>
  person.loadStatus === "OVERLOADED" ||
  person.capacityStatus === "OVER_CAPACITY";

const hasNoRecentActivitySignal = (person: OperationalPerson) =>
  !person.lastActivityAt && hasAssignedItems(person);

function sortByOperationalIntervention(
  people: OperationalPerson[]
): OperationalPerson[] {
  const order: Record<AppPriorityLevel, number> = {
    P0: 0,
    P1: 1,
    P2: 2,
    P3: 3,
  };
  return [...people].sort((a, b) => {
    const priorityA = derivePersonPriority(a) ?? "P3";
    const priorityB = derivePersonPriority(b) ?? "P3";
    if (order[priorityA] !== order[priorityB]) {
      return order[priorityA] - order[priorityB];
    }
    if (b.overdueServiceOrdersCount !== a.overdueServiceOrdersCount) {
      return b.overdueServiceOrdersCount - a.overdueServiceOrdersCount;
    }
    return (
      b.openServiceOrdersCount +
      b.todayAppointmentsCount +
      b.futureAppointmentsCount -
      (a.openServiceOrdersCount +
        a.todayAppointmentsCount +
        a.futureAppointmentsCount)
    );
  });
}

function pickOperationalPerson(people: OperationalPerson[]) {
  return sortByOperationalIntervention(people).find(person =>
    Boolean(derivePersonPriority(person) || hasNoRecentActivitySignal(person))
  );
}

function buildPeopleState(target: PeopleCommandTarget): {
  level: OperationalStateLevel;
  reason: string;
  impact: string;
  title: string;
  detailsLabel: string;
} {
  if (target.person) {
    const person = target.person;
    if (person.status === "SUSPENDED") {
      return {
        level: "SUSPENDED",
        title: `Estado de ${person.name}`,
        reason: `${person.name} está suspenso e mantém ${person.openServiceOrdersCount} O.S. aberta(s) e ${person.futureAppointmentsCount + person.todayAppointmentsCount} agendamento(s) atribuídos.`,
        impact:
          "Responsabilidade crítica pode ficar sem execução real enquanto itens seguem vinculados a uma pessoa suspensa.",
        detailsLabel: "Revisar responsabilidade",
      };
    }
    if (isInactiveWithAssignedItems(person)) {
      return {
        level: "RESTRICTED",
        title: `Estado de ${person.name}`,
        reason: `${person.name} está ${personStatusLabel(person.status).toLowerCase()} com itens operacionais atribuídos.`,
        impact:
          "A operação pode perder dono real em O.S. e agendamentos já vinculados à pessoa.",
        detailsLabel: "Redistribuir itens",
      };
    }
    if (person.overdueServiceOrdersCount > 0) {
      return {
        level: "RESTRICTED",
        title: `Estado de ${person.name}`,
        reason: `${person.name} concentra ${person.overdueServiceOrdersCount} O.S. atrasada(s).`,
        impact:
          "A execução tende a atrasar cliente, agenda, financeiro e governança se a fila não for destravada.",
        detailsLabel: "Ver O.S. atribuídas",
      };
    }
    if (
      isPersonOverloaded(person) ||
      person.availabilityStatus === "UNAVAILABLE_NOW"
    ) {
      return {
        level: "RESTRICTED",
        title: `Estado de ${person.name}`,
        reason: `${loadLabels[person.loadStatus]} · ${capacityLabels[person.capacityStatus]} · ${availabilityLabels[person.availabilityStatus]}.`,
        impact:
          "Novas atribuições podem aumentar fila parada ou colocar demanda em responsável indisponível.",
        detailsLabel: "Rebalancear carga",
      };
    }
    if (
      person.loadStatus === "BUSY" ||
      person.capacityStatus === "AT_CAPACITY" ||
      person.availabilityStatus === "UNAVAILABLE_SOON" ||
      hasNoRecentActivitySignal(person)
    ) {
      return {
        level: "WARNING",
        title: `Estado de ${person.name}`,
        reason: hasNoRecentActivitySignal(person)
          ? "Há itens atribuídos, mas a última atividade não foi registrada nesta leitura."
          : `${loadLabels[person.loadStatus]} · ${capacityLabels[person.capacityStatus]} · ${availabilityLabels[person.availabilityStatus]}.`,
        impact:
          "A pessoa ainda pode executar, mas a fila precisa de acompanhamento antes de receber nova carga.",
        detailsLabel: "Acompanhar pessoa",
      };
    }
    return {
      level: "NORMAL",
      title: `Estado de ${person.name}`,
      reason: `${person.name} está ativo, sem atraso vinculado e com carga dentro da capacidade carregada.`,
      impact:
        "Responsabilidade rastreável e sem intervenção imediata apontada pelos sinais disponíveis.",
      detailsLabel: "Ver detalhe",
    };
  }

  const interventionPerson = pickOperationalPerson(target.people);
  const overloaded = target.people.filter(isPersonOverloaded).length;
  const inactiveAssigned = target.people.filter(
    isInactiveWithAssignedItems
  ).length;
  const overdue = target.people.reduce(
    (total, person) => total + person.overdueServiceOrdersCount,
    0
  );
  if (inactiveAssigned > 0 || overdue > 0 || overloaded > 0) {
    return {
      level: "RESTRICTED",
      title: "Estado operacional da equipe",
      reason: interventionPerson
        ? `${interventionPerson.name} é o principal ponto de intervenção por status, atraso ou carga.`
        : `${inactiveAssigned} pessoa(s) inativa(s) com itens, ${overdue} O.S. atrasada(s) e ${overloaded} pessoa(s) acima da capacidade.`,
      impact:
        "A responsabilidade operacional precisa ser redistribuída ou destravada antes de a fila crescer.",
      detailsLabel: "Abrir responsável crítico",
    };
  }
  const attention = target.people.filter(
    person => derivePersonOperationalStatus(person) === "ATENÇÃO"
  ).length;
  if (attention > 0 || target.warningSummary?.totals.shown) {
    return {
      level: "WARNING",
      title: "Estado operacional da equipe",
      reason: `${attention} pessoa(s) em atenção e ${target.warningSummary?.totals.shown ?? 0} alerta(s) de atribuição observado(s).`,
      impact:
        "A equipe está operando, mas disponibilidade, capacidade e decisões manuais pedem acompanhamento.",
      detailsLabel: "Filtrar atenção",
    };
  }
  return {
    level: "NORMAL",
    title: "Estado operacional da equipe",
    reason:
      "Equipe carregada sem atraso, sobrecarga ou indisponibilidade crítica nos sinais disponíveis.",
    impact:
      "A responsabilidade está distribuída de forma rastreável conforme os dados já retornados pela página.",
    detailsLabel: "Revisar equipe",
  };
}

function buildPeopleRisk(target: PeopleCommandTarget): {
  title: string;
  reason: string;
  impact: string;
  ctaLabel: string;
} {
  const person = target.person ?? pickOperationalPerson(target.people) ?? null;
  if (person && isInactiveWithAssignedItems(person)) {
    return {
      title: "Pessoa inativa ainda segura operação",
      reason: `${person.name} está ${personStatusLabel(person.status).toLowerCase()} com ${person.openServiceOrdersCount} O.S. aberta(s) e ${person.todayAppointmentsCount + person.futureAppointmentsCount} agendamento(s).`,
      impact:
        "Execução, agenda e governança ficam sem dono real se os itens permanecerem atribuídos.",
      ctaLabel: "Abrir pessoa",
    };
  }
  if (person && person.overdueServiceOrdersCount > 0) {
    return {
      title: "Atraso vinculado a responsável",
      reason: `${person.name} tem ${person.overdueServiceOrdersCount} O.S. atrasada(s) entre ${person.openServiceOrdersCount} aberta(s).`,
      impact:
        "Atrasos de execução podem atrasar agenda, cobrança e prova operacional na Timeline.",
      ctaLabel: "Ver O.S.",
    };
  }
  if (person && isPersonOverloaded(person)) {
    return {
      title: "Sobrecarga concentrada",
      reason: `${person.name} aparece como ${loadLabels[person.loadStatus].toLowerCase()} e ${capacityLabels[person.capacityStatus].toLowerCase()}.`,
      impact:
        "A fila pode parar no mesmo responsável e elevar retrabalho ou intervenção de governança.",
      ctaLabel: "Rebalancear",
    };
  }
  if (
    person &&
    person.todayAppointmentsCount + person.futureAppointmentsCount > 0
  ) {
    return {
      title: "Agenda precisa de acompanhamento",
      reason: `${person.name} tem ${person.todayAppointmentsCount} agendamento(s) hoje e ${person.futureAppointmentsCount} futuro(s).`,
      impact:
        "Confirmações e execução devem ser acompanhadas para evitar entrada operacional sem dono.",
      ctaLabel: "Ver agenda",
    };
  }
  return {
    title: "Sem risco dominante carregado",
    reason:
      "Os sinais disponíveis não indicam pessoa inativa com itens, O.S. atrasada ou sobrecarga dominante.",
    impact:
      "A página mantém a revisão da equipe como controle preventivo sem inventar risco genérico.",
    ctaLabel: target.person ? "Revisar pessoa" : "Revisar equipe",
  };
}

function buildPeopleNextBestAction(
  target: PeopleCommandTarget,
  actions: {
    openPerson: (personId: string) => void;
    openServiceOrders: () => void;
    openAppointments: () => void;
    openTimeline: () => void;
    focusAttention: () => void;
  }
): PeopleNextBestAction {
  const ordered = target.person
    ? [target.person]
    : sortByOperationalIntervention(target.people);
  const inactiveAssigned = ordered.find(isInactiveWithAssignedItems);
  if (inactiveAssigned) {
    return {
      title: "Redistribuir responsabilidades",
      entity: inactiveAssigned.name,
      reason: `${inactiveAssigned.name} não está ativo e ainda possui itens operacionais atribuídos.`,
      impact:
        "Retira O.S. e agenda de uma pessoa sem execução ativa e devolve dono real à operação.",
      safetyNote:
        "O Nexo apenas orienta a revisão; nenhuma redistribuição é executada automaticamente.",
      primaryActionLabel: "Abrir pessoa",
      onPrimaryAction: () => actions.openPerson(inactiveAssigned.personId),
      secondaryActionLabel: "Ver O.S.",
      onSecondaryAction: actions.openServiceOrders,
    };
  }
  const overduePerson = ordered.find(
    person => person.overdueServiceOrdersCount > 0
  );
  if (overduePerson) {
    return {
      title: "Destravar execução",
      entity: overduePerson.name,
      reason: `${overduePerson.name} tem ${overduePerson.overdueServiceOrdersCount} O.S. atrasada(s).`,
      impact:
        "Reduz atraso visível em execução, financeiro e prova oficial da operação.",
      safetyNote:
        "A ação navega para investigação; não altera prazo, status ou responsável automaticamente.",
      primaryActionLabel: "Ver O.S. atribuídas",
      onPrimaryAction: actions.openServiceOrders,
      secondaryActionLabel: "Abrir pessoa",
      onSecondaryAction: () => actions.openPerson(overduePerson.personId),
    };
  }
  const overloadedPerson = ordered.find(isPersonOverloaded);
  if (overloadedPerson) {
    return {
      title: "Rebalancear carga",
      entity: overloadedPerson.name,
      reason: `${overloadedPerson.name} está ${loadLabels[overloadedPerson.loadStatus].toLowerCase()} e ${capacityLabels[overloadedPerson.capacityStatus].toLowerCase()}.`,
      impact:
        "Evita concentração de fila e reduz risco de atraso por responsável único.",
      safetyNote:
        "Use a leitura como apoio de decisão; não há automação de reatribuição nesta página.",
      primaryActionLabel: "Abrir pessoa",
      onPrimaryAction: () => actions.openPerson(overloadedPerson.personId),
      secondaryActionLabel: "Ver O.S.",
      onSecondaryAction: actions.openServiceOrders,
    };
  }
  const appointmentPerson = ordered.find(
    person => person.todayAppointmentsCount + person.futureAppointmentsCount > 0
  );
  if (appointmentPerson) {
    return {
      title: "Confirmar agenda",
      entity: appointmentPerson.name,
      reason: `${appointmentPerson.name} tem ${appointmentPerson.todayAppointmentsCount} agendamento(s) hoje e ${appointmentPerson.futureAppointmentsCount} futuro(s).`,
      impact:
        "Mantém a entrada operacional conectada ao responsável antes de virar execução.",
      safetyNote:
        "WhatsApp permanece congelado; esta ação só navega para conferência de agenda.",
      primaryActionLabel: "Ver agendamentos",
      onPrimaryAction: actions.openAppointments,
      secondaryActionLabel: "Abrir pessoa",
      onSecondaryAction: () => actions.openPerson(appointmentPerson.personId),
    };
  }
  const noRecentActivity = ordered.find(hasNoRecentActivitySignal);
  if (noRecentActivity) {
    return {
      title: "Revisar disponibilidade",
      entity: noRecentActivity.name,
      reason:
        "Há itens atribuídos, mas a última atividade não foi registrada nesta leitura.",
      impact:
        "Ajuda a confirmar se a pessoa pode assumir a fila já vinculada ao seu nome.",
      safetyNote:
        "Ausência de atividade é tratada como sinal de revisão, não como bloqueio automático.",
      primaryActionLabel: "Abrir pessoa",
      onPrimaryAction: () => actions.openPerson(noRecentActivity.personId),
      secondaryActionLabel: "Abrir Timeline",
      onSecondaryAction: actions.openTimeline,
    };
  }
  return {
    title: "Revisar equipe",
    entity: target.person?.name ?? "Equipe operacional",
    reason:
      "Não há pendência dominante nos sinais de responsabilidade carregados.",
    impact:
      "Mantém a equipe sob controle preventivo e confirma se a distribuição segue saudável.",
    safetyNote:
      "Sem pendência crítica, a recomendação é somente revisar; nada é executado automaticamente.",
    primaryActionLabel: target.person ? "Revisar pessoa" : "Filtrar atenção",
    onPrimaryAction: target.person
      ? () => actions.openPerson(target.person?.personId ?? "")
      : actions.focusAttention,
    secondaryActionLabel: "Abrir Timeline",
    onSecondaryAction: actions.openTimeline,
  };
}

function buildPeopleFlowStages(target: PeopleCommandTarget): Array<{
  id: string;
  label: string;
  summary: string;
  state: OperationalFlowStageState;
  countOrValue?: string;
  hrefLabel?: string;
  onClick?: () => void;
}> {
  const people = target.person ? [target.person] : target.people;
  const personLabel = target.person?.name ?? `${people.length} pessoa(s)`;
  const todayAppointments = people.reduce(
    (total, person) => total + person.todayAppointmentsCount,
    0
  );
  const futureAppointments = people.reduce(
    (total, person) => total + person.futureAppointmentsCount,
    0
  );
  const openServiceOrders = people.reduce(
    (total, person) => total + person.openServiceOrdersCount,
    0
  );
  const overdueServiceOrders = people.reduce(
    (total, person) => total + person.overdueServiceOrdersCount,
    0
  );
  const warningSignals = target.warningSummary?.totals.shown ?? 0;
  const hasEvents = people.some(
    person =>
      person.lastActivityAt ||
      person.currentAvailabilityException ||
      person.nextAvailabilityException
  );
  const hasOperationalRisk = people.some(
    person =>
      isInactiveWithAssignedItems(person) ||
      person.overdueServiceOrdersCount > 0 ||
      isPersonOverloaded(person) ||
      person.availabilityStatus !== "AVAILABLE"
  );
  return [
    {
      id: "person",
      label: "Pessoa",
      summary: target.person
        ? `${target.person.role} · ${personStatusLabel(target.person.status)}.`
        : "Equipe carregada como mapa de responsáveis reais.",
      state: people.length > 0 ? "done" : "idle",
      countOrValue: personLabel,
    },
    {
      id: "appointments",
      label: "Agendamentos",
      summary:
        todayAppointments + futureAppointments > 0
          ? `${todayAppointments} hoje e ${futureAppointments} futuro(s) atribuídos.`
          : "Sem agendamentos atribuídos nos dados carregados.",
      state:
        todayAppointments > 0
          ? "warning"
          : futureAppointments > 0
            ? "active"
            : "idle",
      countOrValue: `${todayAppointments + futureAppointments}`,
    },
    {
      id: "service-orders",
      label: "O.S.",
      summary:
        overdueServiceOrders > 0
          ? `${overdueServiceOrders} atrasada(s) vinculada(s) a responsável.`
          : openServiceOrders > 0
            ? `${openServiceOrders} aberta(s) sem atraso informado.`
            : "Sem O.S. aberta atribuída nesta leitura.",
      state:
        overdueServiceOrders > 0
          ? "blocked"
          : openServiceOrders > 0
            ? "warning"
            : "idle",
      countOrValue: `${openServiceOrders}`,
    },
    {
      id: "finance",
      label: "Financeiro",
      summary:
        "Esta página não recebeu cobranças por responsável; financeiro fica como etapa de navegação segura.",
      state: "idle",
      countOrValue: "—",
    },
    {
      id: "timeline",
      label: "Timeline",
      summary: hasEvents
        ? "Há sinais reais de atividade/indisponibilidade para prova contextual."
        : "Sem eventos oficiais retornados para Pessoas nesta leitura.",
      state: hasEvents ? "done" : "idle",
    },
    {
      id: "governance",
      label: "Risco/Governança",
      summary: hasOperationalRisk
        ? "Há atraso, sobrecarga, indisponibilidade ou status que pede intervenção."
        : "Responsabilidade sem risco dominante nos sinais disponíveis.",
      state: hasOperationalRisk
        ? "warning"
        : warningSignals > 0
          ? "warning"
          : "done",
      countOrValue: warningSignals ? `${warningSignals} alerta(s)` : undefined,
    },
  ];
}

function buildPeopleTimelineEvents(target: PeopleCommandTarget) {
  const people = target.person
    ? [target.person]
    : sortByOperationalIntervention(target.people);
  return people
    .flatMap(person => {
      const events: Array<{
        id: string;
        type: string;
        occurredAt: string;
        entity: string;
        actor?: string;
        summary: string;
      }> = [];
      if (person.lastActivityAt) {
        events.push({
          id: `${person.personId}-last-activity`,
          type: "Atividade",
          occurredAt: formatDateTime(person.lastActivityAt),
          entity: person.name,
          actor: person.name,
          summary:
            "Última atividade registrada para a pessoa nos dados operacionais carregados.",
        });
      }
      if (person.overdueServiceOrdersCount > 0) {
        events.push({
          id: `${person.personId}-overdue-os`,
          type: "O.S.",
          occurredAt: "Sinal atual",
          entity: `${person.overdueServiceOrdersCount} O.S. atrasada(s)`,
          actor: person.name,
          summary:
            "Evento contextual derivado da contagem real de O.S. atrasadas atribuídas; não substitui a Timeline oficial.",
        });
      }
      if (person.todayAppointmentsCount + person.futureAppointmentsCount > 0) {
        events.push({
          id: `${person.personId}-appointments`,
          type: "Agenda",
          occurredAt: "Sinal atual",
          entity: `${person.todayAppointmentsCount + person.futureAppointmentsCount} agendamento(s) atribuídos`,
          actor: person.name,
          summary:
            "Evento contextual derivado dos agendamentos vinculados ao responsável nesta leitura.",
        });
      }
      if (person.currentAvailabilityException) {
        events.push({
          id: `${person.personId}-${person.currentAvailabilityException.id}`,
          type: "Indisponibilidade",
          occurredAt: formatDateTime(
            person.currentAvailabilityException.startsAt
          ),
          entity: person.name,
          actor: person.name,
          summary: `Indisponibilidade atual registrada até ${formatDateTime(person.currentAvailabilityException.endsAt)}${person.currentAvailabilityException.reason ? ` · ${person.currentAvailabilityException.reason}` : ""}.`,
        });
      } else if (person.nextAvailabilityException) {
        events.push({
          id: `${person.personId}-${person.nextAvailabilityException.id}`,
          type: "Indisponibilidade",
          occurredAt: formatDateTime(person.nextAvailabilityException.startsAt),
          entity: person.name,
          actor: person.name,
          summary: `Próxima indisponibilidade registrada até ${formatDateTime(person.nextAvailabilityException.endsAt)}${person.nextAvailabilityException.reason ? ` · ${person.nextAvailabilityException.reason}` : ""}.`,
        });
      }
      return events;
    })
    .slice(0, 4);
}

export default function PeoplePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isInitializing, role } = useAuth();
  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPersonId, setEditPersonId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>("all");
  const [queryText, setQueryText] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const summaryQuery = trpc.people.operationalSummary.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const warningSummaryQuery = trpc.analytics.assigneeWarningSummary.useQuery(
    undefined,
    {
      enabled: isAuthenticated && role === "ADMIN",
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const exceptionsQuery = trpc.people.listAvailabilityExceptions.useQuery(
    { personId: selectedPersonId ?? "" },
    { enabled: isAuthenticated && Boolean(selectedPersonId), retry: false }
  );
  const createAvailabilityException =
    trpc.people.createAvailabilityException.useMutation({
      onSuccess: async () => {
        setStartsAt("");
        setEndsAt("");
        setReason("");
        await Promise.all([
          utils.people.operationalSummary.invalidate(),
          utils.people.listAvailabilityExceptions.invalidate(),
        ]);
      },
    });
  const deleteAvailabilityException =
    trpc.people.deleteAvailabilityException.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.people.operationalSummary.invalidate(),
          utils.people.listAvailabilityExceptions.invalidate(),
        ]);
      },
    });
  const summaryPayload = normalizeObjectPayload<{
    people?: OperationalPerson[];
  }>(summaryQuery.data);
  const people = normalizeArrayPayload<OperationalPerson>(
    summaryPayload?.people
  );
  const selectedPerson =
    people.find(person => person.personId === selectedPersonId) ?? null;
  const exceptions = normalizeArrayPayload<AvailabilityException>(
    exceptionsQuery.data
  );
  const isAdmin = role === "ADMIN";
  const rawWarningSummary = normalizeObjectPayload<
    Partial<AssigneeWarningSummary>
  >(warningSummaryQuery.data);
  const warningTypes = normalizeArrayPayload<
    AssigneeWarningSummary["byWarningType"][number]
  >(rawWarningSummary?.byWarningType);
  const warningContexts = normalizeArrayPayload<
    AssigneeWarningSummary["byContext"][number]
  >(rawWarningSummary?.byContext);
  const warningTotals = rawWarningSummary?.totals ?? null;
  const warningSummary = rawWarningSummary
    ? ({
        totals: {
          shown: Number(warningTotals?.shown ?? 0),
          confirmed: Number(warningTotals?.confirmed ?? 0),
          confirmationRatePct:
            warningTotals?.confirmationRatePct == null
              ? null
              : Number(warningTotals.confirmationRatePct),
        },
        byContext: warningContexts,
        byWarningType: warningTypes,
      } satisfies AssigneeWarningSummary)
    : null;
  const mostFrequentWarningType = warningTypes.length
    ? warningTypes.reduce(
        (current, warningType) =>
          warningType.shown > current.shown ? warningType : current,
        warningTypes[0]
      )
    : null;
  const header = useMemo(
    () => ({
      activePeople: people.filter(person => person.status === "ACTIVE").length,
      overloadedPeople: people.filter(
        person => person.loadStatus === "OVERLOADED"
      ).length,
      overdueServiceOrders: people.reduce(
        (total, person) => total + person.overdueServiceOrdersCount,
        0
      ),
      todayAppointments: people.reduce(
        (total, person) => total + person.todayAppointmentsCount,
        0
      ),
      unavailablePeople: people.filter(
        person => person.availabilityStatus !== "AVAILABLE"
      ).length,
    }),
    [people]
  );
  const filteredPeople = useMemo(() => {
    const search = queryText.trim().toLowerCase();
    return people.filter(person => {
      if (
        peopleFilter === "attention" &&
        derivePersonOperationalStatus(person) === "NORMAL"
      )
        return false;
      if (peopleFilter === "overloaded" && person.loadStatus !== "OVERLOADED")
        return false;
      if (peopleFilter === "inactive" && person.status === "ACTIVE")
        return false;
      if (
        peopleFilter === "available" &&
        person.availabilityStatus !== "AVAILABLE"
      )
        return false;
      if (!search) return true;
      return `${person.name} ${person.role} ${person.workloadNotes ?? ""}`
        .toLowerCase()
        .includes(search);
    });
  }, [people, peopleFilter, queryText]);
  const commandTarget = useMemo(
    () => ({ person: selectedPerson, people, warningSummary }),
    [selectedPerson, people, warningSummary]
  );
  const commandState = useMemo(
    () => buildPeopleState(commandTarget),
    [commandTarget]
  );
  const commandRisk = useMemo(
    () => buildPeopleRisk(commandTarget),
    [commandTarget]
  );
  const commandFlowStages = useMemo(
    () => buildPeopleFlowStages(commandTarget),
    [commandTarget]
  );
  const commandTimelineEvents = useMemo(
    () => buildPeopleTimelineEvents(commandTarget),
    [commandTarget]
  );
  const nextBestAction = useMemo(
    () =>
      buildPeopleNextBestAction(commandTarget, {
        openPerson: personId => {
          if (personId) setSelectedPersonId(personId);
        },
        openServiceOrders: () => navigate("/service-orders"),
        openAppointments: () => navigate("/appointments"),
        openTimeline: () => navigate("/timeline"),
        focusAttention: () => setPeopleFilter("attention"),
      }),
    [commandTarget, navigate]
  );
  const stateDetailsAction = () => {
    if (selectedPerson) {
      if (commandState.detailsLabel.includes("O.S.")) {
        navigate("/service-orders");
        return;
      }
      setSelectedPersonId(selectedPerson.personId);
      return;
    }
    const interventionPerson = pickOperationalPerson(people);
    if (interventionPerson && commandState.level === "RESTRICTED") {
      setSelectedPersonId(interventionPerson.personId);
      return;
    }
    setPeopleFilter("attention");
  };
  const riskAction = () => {
    if (commandRisk.ctaLabel.includes("O.S.")) {
      navigate("/service-orders");
      return;
    }
    if (commandRisk.ctaLabel.includes("agenda")) {
      navigate("/appointments");
      return;
    }
    const interventionPerson = selectedPerson ?? pickOperationalPerson(people);
    if (interventionPerson) {
      setSelectedPersonId(interventionPerson.personId);
      return;
    }
    setPeopleFilter("attention");
  };
  const refresh = () => void summaryQuery.refetch();
  const submitAvailability = () =>
    selectedPersonId &&
    createAvailabilityException.mutate({
      personId: selectedPersonId,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      reason: reason.trim() || null,
    });

  if (isInitializing)
    return (
      <AppPageShell>
        <AppPageLoadingState title="Carregando equipe operacional" />
      </AppPageShell>
    );
  if (!isAuthenticated)
    return (
      <AppPageShell>
        <AppPageErrorState
          description="Sua sessão expirou. Entre novamente para supervisionar a equipe."
          onAction={() => navigate("/login")}
        />
      </AppPageShell>
    );

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Pessoas"
        description="Controle de quem executa a operação, carga atual, capacidade planejada e indisponibilidades temporárias."
        primaryAction={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova pessoa
          </Button>
        }
        density="compact"
      >
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <AppInput
            value={queryText}
            onChange={event => setQueryText(event.target.value)}
            placeholder="Buscar pessoa, função ou nota operacional"
            className="h-9"
          />
          <div className="flex h-9 items-center rounded-md border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] px-3 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
            {filteredPeople.length} pessoa(s)
          </div>
        </div>
      </AppOperationalHeader>

      <AppSectionCard
        className="space-y-3"
        data-testid="people-operational-header"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
              Saúde da equipe
            </p>
            <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
              Carga real, atrasos e indisponibilidade como sinais separados.
            </p>
          </div>
          <AppOperationalStatusBadge
            status={
              header.overdueServiceOrders > 0 || header.overloadedPeople > 0
                ? "RISCO"
                : header.unavailablePeople > 0
                  ? "ATENÇÃO"
                  : "NORMAL"
            }
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <AppStatCard
            label="Pessoas ativas"
            value={`${header.activePeople}`}
            helper="Responsáveis cadastrados na operação."
          />
          <AppStatCard
            label="Sobrecarregados"
            value={`${header.overloadedPeople}`}
            helper="Carga operacional atual alta ou com atraso."
          />
          <AppStatCard
            label="O.S. atrasadas atribuídas"
            value={`${header.overdueServiceOrders}`}
            helper="O.S. abertas vencidas com responsável."
          />
          <AppStatCard
            label="Agendamentos hoje"
            value={`${header.todayAppointments}`}
            helper="Agenda ativa de hoje por responsável."
          />
          <AppStatCard
            label="Indisponibilidades"
            value={`${header.unavailablePeople}`}
            helper="Pessoas indisponíveis agora ou em breve."
          />
        </div>
      </AppSectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <OperationalStateCard
          level={commandState.level}
          title={commandState.title}
          reason={commandState.reason}
          impact={commandState.impact}
          detailsLabel={commandState.detailsLabel}
          onDetails={stateDetailsAction}
        />
        <OperationalRiskCard
          title={commandRisk.title}
          reason={commandRisk.reason}
          impact={commandRisk.impact}
          ctaLabel={commandRisk.ctaLabel}
          onClick={riskAction}
        />
      </div>

      <NextBestActionCard
        title={nextBestAction.title}
        entity={nextBestAction.entity}
        reason={nextBestAction.reason}
        impact={nextBestAction.impact}
        safetyNote={nextBestAction.safetyNote}
        primaryActionLabel={nextBestAction.primaryActionLabel}
        onPrimaryAction={nextBestAction.onPrimaryAction}
        secondaryActionLabel={nextBestAction.secondaryActionLabel}
        onSecondaryAction={nextBestAction.onSecondaryAction}
      />

      <OperationalFlowCard
        title="Fluxo de responsabilidade"
        subtitle="Pessoa → Agendamentos → O.S. → Cobranças/Financeiro → Timeline → Risco/Governança"
        stages={commandFlowStages.map(stage => ({
          ...stage,
          hrefLabel:
            stage.id === "appointments"
              ? "Abrir agenda"
              : stage.id === "service-orders"
                ? "Abrir O.S."
                : stage.id === "finance"
                  ? "Abrir financeiro"
                  : stage.id === "timeline"
                    ? "Abrir Timeline"
                    : stage.id === "governance"
                      ? "Abrir governança"
                      : undefined,
          onClick:
            stage.id === "appointments"
              ? () => navigate("/appointments")
              : stage.id === "service-orders"
                ? () => navigate("/service-orders")
                : stage.id === "finance"
                  ? () => navigate("/finances")
                  : stage.id === "timeline"
                    ? () => navigate("/timeline")
                    : stage.id === "governance"
                      ? () => navigate("/governance")
                      : undefined,
        }))}
      />

      <AppFiltersBar className="gap-2 border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-card-bg,var(--surface-base))] px-3 py-3">
        {peopleFilters.map(filter => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setPeopleFilter(filter.key)}
            className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${peopleFilter === filter.key ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]" : "bg-[var(--nexo-control-bg,var(--surface-subtle))] text-[var(--nexo-text-muted,var(--text-muted))]"}`}
          >
            {filter.label}
          </button>
        ))}
      </AppFiltersBar>

      {isAdmin ? (
        <AppSectionBlock
          title="Sinais de atribuição"
          subtitle="Leitura agregada dos alertas passivos exibidos durante atribuições manuais. Serve somente para observação operacional das decisões manuais."
        >
          {warningSummaryQuery.isLoading ? (
            <AppPageLoadingState description="Consolidando sinais dos últimos 30 dias..." />
          ) : null}
          {warningSummaryQuery.isError ? (
            <AppPageErrorState
              description="Não foi possível carregar os sinais agregados agora."
              onAction={() => void warningSummaryQuery.refetch()}
            />
          ) : null}
          {warningSummary ? (
            <div
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              data-testid="assignee-warning-summary"
            >
              <AppStatCard
                label="Alertas exibidos"
                value={`${warningSummary.totals.shown}`}
                helper="Avisos passivos durante atribuições manuais."
              />
              <AppStatCard
                label="Confirmações após alerta"
                value={`${warningSummary.totals.confirmed}`}
                helper="Decisões manuais mantidas após o aviso."
              />
              <AppStatCard
                label="Taxa de confirmação"
                value={
                  warningSummary.totals.confirmationRatePct == null
                    ? "Sem exibições"
                    : `${warningSummary.totals.confirmationRatePct}%`
                }
                helper="Confirmações divididas por alertas exibidos."
              />
              <AppSectionCard className="p-4 text-sm">
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Contextos observados
                </p>
                {warningSummary.byContext.map(context => (
                  <p key={context.context} className="mt-1">
                    <span className="font-semibold">
                      {contextLabels[context.context]}
                    </span>
                    : {context.shown} exibidos · {context.confirmed} confirmados
                  </p>
                ))}
                <p className="mt-3 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Sinal mais frequente
                </p>
                <p className="font-semibold">
                  {mostFrequentWarningType && mostFrequentWarningType.shown > 0
                    ? warningTypeLabels[mostFrequentWarningType.warningType]
                    : "Nenhum sinal registrado"}
                </p>
              </AppSectionCard>
            </div>
          ) : null}
        </AppSectionBlock>
      ) : null}

      {summaryQuery.isLoading ? (
        <AppPageLoadingState title="Consolidando carga por responsável" />
      ) : null}
      {summaryQuery.isError ? (
        <AppPageErrorState
          description="Não foi possível carregar o resumo operacional da equipe."
          onAction={refresh}
        />
      ) : null}
      {!summaryQuery.isLoading && !summaryQuery.isError ? (
        <AppSectionBlock
          title="Fila de pessoas"
          subtitle="Responsabilidade, carga e ações reais por responsável."
        >
          {people.length === 0 ? (
            <AppPageEmptyState
              title="Nenhuma pessoa cadastrada"
              description="Cadastre responsáveis para transformar a execução em capacidade operacional visível."
            />
          ) : filteredPeople.length === 0 ? (
            <AppPageEmptyState
              title="Busca sem resultado"
              description="Nenhuma pessoa corresponde aos filtros operacionais atuais."
            />
          ) : (
            <AppDataTable
              className="min-w-[1480px]"
              data-testid="people-workload-table"
            >
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Função</th>
                  <th>Status</th>
                  <th>Status operacional</th>
                  <th>Prioridade</th>
                  <th>Disponibilidade</th>
                  <th>O.S. abertas</th>
                  <th>O.S. atrasadas</th>
                  <th>Agenda hoje</th>
                  <th>Próximos agendamentos</th>
                  <th>Capacidade O.S.</th>
                  <th>Capacidade agenda</th>
                  <th>Última atividade</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map(person => {
                  const operationalStatus =
                    derivePersonOperationalStatus(person);
                  const priority = derivePersonPriority(person);
                  return (
                    <tr key={person.personId}>
                      <td className="font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                        {person.name}
                      </td>
                      <td>{person.role}</td>
                      <td>
                        <AppStatusBadge
                          label={personStatusLabel(person.status)}
                        />
                      </td>
                      <td>
                        <AppOperationalStatusBadge status={operationalStatus} />
                      </td>
                      <td>
                        {priority ? (
                          <AppPriorityBadge
                            priority={priority}
                            label={personPriorityLabel(priority)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <AppStatusBadge
                          label={availabilityLabels[person.availabilityStatus]}
                        />
                      </td>
                      <td>{person.openServiceOrdersCount}</td>
                      <td>{person.overdueServiceOrdersCount}</td>
                      <td>{person.todayAppointmentsCount}</td>
                      <td>{person.futureAppointmentsCount}</td>
                      <td>
                        {formatCapacity(person.dailyServiceOrderCapacity)}
                        <br />
                        <span className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                          {formatUsage(person.serviceOrderCapacityUsagePct)}
                        </span>
                      </td>
                      <td>
                        {formatCapacity(person.dailyAppointmentCapacity)}
                        <br />
                        <span className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                          {formatUsage(person.appointmentCapacityUsagePct)}
                        </span>
                      </td>
                      <td>{formatDateTime(person.lastActivityAt)}</td>
                      <td>
                        <AppRowActionsDropdown
                          triggerLabel="Ações da pessoa"
                          items={[
                            {
                              label: "Ver detalhe",
                              onSelect: () =>
                                setSelectedPersonId(person.personId),
                              tone: "primary",
                            },
                            {
                              label: "Ver O.S. atribuídas",
                              onSelect: () => navigate("/service-orders"),
                            },
                            {
                              label: "Ver agendamentos",
                              onSelect: () => navigate("/appointments"),
                            },
                            {
                              label: "Editar",
                              onSelect: () => setEditPersonId(person.personId),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AppDataTable>
          )}
        </AppSectionBlock>
      ) : null}

      <AppSectionBlock
        title="Responsabilidade e carga"
        subtitle="Detail-legacy mantido: disponibilidade temporária é um sinal separado da capacidade; não é escala completa."
      >
        {selectedPerson ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AppSectionCard className="p-4">
                <Users className="mb-2 h-4 w-4" />
                <p className="font-semibold">{selectedPerson.name}</p>
                <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
                  {selectedPerson.role} ·{" "}
                  {personStatusLabel(selectedPerson.status)}
                </p>
              </AppSectionCard>
              <AppSectionCard className="p-4">
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Carga atual de O.S. / capacidade
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {selectedPerson.openServiceOrdersCount} /{" "}
                  {formatCapacity(selectedPerson.dailyServiceOrderCapacity)}
                </p>
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  {formatDifference(
                    selectedPerson.openServiceOrdersCount,
                    selectedPerson.dailyServiceOrderCapacity
                  )}
                </p>
              </AppSectionCard>
              <AppSectionCard className="p-4">
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Disponibilidade atual
                </p>
                <p className="mt-1 font-semibold">
                  {availabilityLabels[selectedPerson.availabilityStatus]}
                </p>
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Próxima indisponibilidade:{" "}
                  {formatDateTime(
                    selectedPerson.nextAvailabilityException?.startsAt
                  )}
                </p>
              </AppSectionCard>
              <AppSectionCard className="p-4">
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Capacidade planejada
                </p>
                <AppStatusBadge
                  label={capacityLabels[selectedPerson.capacityStatus]}
                />
                <p className="mt-2 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  {selectedPerson.workloadNotes || "Sem nota operacional."}
                </p>
                <p className="mt-2 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Última atividade:{" "}
                  {formatDateTime(selectedPerson.lastActivityAt)}
                </p>
              </AppSectionCard>
            </div>
            {isAdmin ? (
              <AppSectionCard
                className="grid gap-2 p-4 md:grid-cols-4"
                data-testid="availability-exception-form"
              >
                <label className="text-sm">
                  Início
                  <input
                    aria-label="Início"
                    type="datetime-local"
                    value={startsAt}
                    onChange={event => setStartsAt(event.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] p-2 text-[var(--nexo-text-primary,var(--text-primary))]"
                  />
                </label>
                <label className="text-sm">
                  Fim
                  <input
                    aria-label="Fim"
                    type="datetime-local"
                    value={endsAt}
                    onChange={event => setEndsAt(event.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] p-2 text-[var(--nexo-text-primary,var(--text-primary))]"
                  />
                </label>
                <label className="text-sm">
                  Motivo
                  <input
                    aria-label="Motivo"
                    value={reason}
                    maxLength={200}
                    onChange={event => setReason(event.target.value)}
                    className="mt-1 w-full rounded-md border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] p-2 text-[var(--nexo-text-primary,var(--text-primary))]"
                  />
                </label>
                <Button
                  className="self-end"
                  disabled={
                    !startsAt ||
                    !endsAt ||
                    createAvailabilityException.isPending
                  }
                  onClick={submitAvailability}
                >
                  Adicionar indisponibilidade
                </Button>
              </AppSectionCard>
            ) : null}
            <div>
              <p className="mb-2 text-sm font-semibold">
                Indisponibilidades recentes e futuras
              </p>
              {exceptionsQuery.isLoading ? (
                <AppPageLoadingState description="Carregando indisponibilidades..." />
              ) : exceptions.length === 0 ? (
                <AppPageEmptyState
                  title="Sem indisponibilidade"
                  description="Nenhuma indisponibilidade registrada para a pessoa selecionada."
                />
              ) : (
                <div className="space-y-2">
                  {exceptions.map(exception => (
                    <AppSectionCard
                      key={exception.id}
                      className="flex items-center justify-between gap-3 p-3 text-sm"
                    >
                      <span>
                        {formatDateTime(exception.startsAt)} até{" "}
                        {formatDateTime(exception.endsAt)} ·{" "}
                        {exception.reason || "Sem motivo informado"}
                      </span>
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            deleteAvailabilityException.mutate({
                              personId: selectedPerson.personId,
                              exceptionId: exception.id,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" /> Remover
                        </Button>
                      ) : null}
                    </AppSectionCard>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <AppPageEmptyState
            title="Selecione uma pessoa"
            description="Abra o detalhe para comparar atribuições reais, capacidade planejada e indisponibilidades temporárias."
          />
        )}
      </AppSectionBlock>

      <EntityTimelineCard
        title={
          selectedPerson
            ? "Últimos eventos oficiais da pessoa"
            : "Prova operacional da responsabilidade"
        }
        subtitle="Usa eventos oficiais quando disponíveis; na ausência deles, exibe no máximo quatro sinais contextuais derivados dos dados reais carregados e orienta abrir a Timeline completa."
        events={commandTimelineEvents}
        fullTimelineLabel="Abrir Timeline completa"
        onFullTimeline={() => navigate("/timeline")}
      />
      <CreatePersonModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
      />
      <EditPersonModal
        open={Boolean(editPersonId)}
        personId={editPersonId}
        onClose={() => setEditPersonId(null)}
        onSaved={refresh}
      />
    </AppPageShell>
  );
}
