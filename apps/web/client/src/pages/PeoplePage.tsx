import { useMemo, useState } from "react";
import { Clock3, Plus, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { NextBestActionCard } from "@/components/app/OperationalCommandLayer";
import {
  AppInput,
  AppTimeline,
  AppTimelineItem,
  AppOperationalStatusBadge,
  AppPageShell,
  AppSectionCard,
  AppStatCard,
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
// trpc.nexo.timeline.listByOrg.useQuery({ limit: 5 })
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

type TeamTimelineEvent = {
  id?: string;
  action?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  entityType?: string | null;
  entityName?: string | null;
  serviceOrderId?: string | null;
  customerName?: string | null;
  actorName?: string | null;
  personName?: string | null;
  responsibleName?: string | null;
  createdAt?: string | null;
  occurredAt?: string | null;
  timestamp?: string | null;
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
const peopleFilters: Array<{ key: PeopleFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "attention", label: "Atenção" },
  { key: "overloaded", label: "Sobrecarregados" },
  { key: "inactive", label: "Inativos" },
  { key: "available", label: "Disponíveis" },
];

const compactChipClass =
  "rounded-full border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2.5 py-1 text-xs text-[var(--nexo-text-muted,var(--text-muted))]";

const personInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "?";

const timelineActionLabels: Record<string, string> = {
  OPERATIONAL_STATE_CHANGED: "Operação voltou ao estado saudável",
  GOVERNANCE_RUN_COMPLETED: "Governança reavaliou a operação",
  SERVICE_ORDER_STARTED: "O.S. iniciada",
  SERVICE_ORDER_COMPLETED: "O.S. concluída",
  APPOINTMENT_CONFIRMED: "Agendamento confirmado",
  CHARGE_CREATED: "Cobrança criada",
  PAYMENT_RECEIVED: "Pagamento registrado",
  MESSAGE_SENT: "Mensagem enviada",
  AVAILABILITY_CHANGED: "Disponibilidade atualizada",
};

const unsafeTimelineEnumPattern =
  /\b(UNKNOWN|NORMAL|WARNING|RESTRICTED|SUSPENDED)\b/g;

const getTimelineEventDate = (event: TeamTimelineEvent) =>
  event.occurredAt ?? event.createdAt ?? event.timestamp ?? null;

const getTimelineActor = (event: TeamTimelineEvent) =>
  event.responsibleName ?? event.personName ?? event.actorName ?? "Equipe";

const humanizeTimelineText = (value?: string | null) =>
  value?.replace(unsafeTimelineEnumPattern, "estado operacional").trim() ||
  null;

const getTimelineAction = (event: TeamTimelineEvent) => {
  const key = String(event.action ?? event.type ?? "").toUpperCase();
  return (
    timelineActionLabels[key] ??
    humanizeTimelineText(event.title) ??
    humanizeTimelineText(event.description) ??
    "Evento operacional registrado"
  );
};

const getTimelineContext = (event: TeamTimelineEvent) =>
  event.entityName ??
  event.customerName ??
  event.entityType ??
  event.serviceOrderId ??
  "operação";

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
const formatMoneyFallback = () => "Aguardando vínculo financeiro";
const formatAverageUsage = (values: Array<number | null>) => {
  const usable = values.filter((value): value is number => value != null);
  if (!usable.length) return "Uso indisponível";
  return `${Math.round(usable.reduce((total, value) => total + value, 0) / usable.length)}%`;
};
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
  const score = (person: OperationalPerson) => ({
    overdue: person.overdueServiceOrdersCount,
    overloaded: isPersonOverloaded(person) ? 1 : 0,
    unavailable: person.availabilityStatus !== "AVAILABLE" ? 1 : 0,
    usage: Math.max(
      person.serviceOrderCapacityUsagePct ?? 0,
      person.appointmentCapacityUsagePct ?? 0
    ),
    assigned:
      person.openServiceOrdersCount +
      person.todayAppointmentsCount +
      person.futureAppointmentsCount,
    healthy: derivePersonOperationalStatus(person) === "NORMAL" ? 1 : 0,
  });
  return [...people].sort((a, b) => {
    const scoreA = score(a);
    const scoreB = score(b);
    return (
      scoreB.overdue - scoreA.overdue ||
      scoreB.overloaded - scoreA.overloaded ||
      scoreB.unavailable - scoreA.unavailable ||
      scoreB.usage - scoreA.usage ||
      scoreB.assigned - scoreA.assigned ||
      scoreA.healthy - scoreB.healthy ||
      a.name.localeCompare(b.name)
    );
  });
}

function pickOperationalPerson(people: OperationalPerson[]) {
  return sortByOperationalIntervention(people).find(person =>
    Boolean(derivePersonPriority(person) || hasNoRecentActivitySignal(person))
  );
}

function buildPeopleNextBestAction(
  target: PeopleCommandTarget,
  actions: {
    openPerson: (personId: string) => void;
    openServiceOrders: () => void;
    openAppointments: () => void;
    openTimeline: () => void;
    openSettings: () => void;
    openCreatePerson: () => void;
    focusAttention: () => void;
    focusOverloaded: () => void;
    focusAvailability: () => void;
  }
): PeopleNextBestAction {
  const ordered = target.person
    ? [target.person]
    : sortByOperationalIntervention(target.people);
  if (target.people.length === 0) {
    return {
      title: "Cadastrar responsáveis",
      entity: "Equipe operacional",
      reason: "A operação ainda não possui responsáveis ativos.",
      impact: "Não é possível distribuir O.S., agenda e carga de trabalho.",
      safetyNote:
        "O Nexo apenas abre o cadastro; nenhuma pessoa é criada automaticamente.",
      primaryActionLabel: "Nova pessoa",
      onPrimaryAction: actions.openCreatePerson,
      secondaryActionLabel: "Abrir Configurações",
      onSecondaryAction: actions.openSettings,
    };
  }
  const overduePerson = ordered.find(
    person => person.overdueServiceOrdersCount > 0
  );
  if (overduePerson) {
    return {
      title: "Resolver atrasos atribuídos",
      entity: overduePerson.name,
      reason: "Existem O.S. atrasadas com responsável definido.",
      impact: "A execução parada pode travar cobrança e receita.",
      safetyNote:
        "A ação navega para investigação; não altera prazo, status ou responsável automaticamente.",
      primaryActionLabel: "Ver O.S. atrasadas",
      onPrimaryAction: actions.openServiceOrders,
      secondaryActionLabel: "Abrir Timeline",
      onSecondaryAction: actions.openTimeline,
    };
  }
  const overloadedPerson = ordered.find(isPersonOverloaded);
  if (overloadedPerson) {
    return {
      title: "Redistribuir carga",
      entity: overloadedPerson.name,
      reason: "Há responsáveis acima da capacidade planejada.",
      impact: "Aumenta risco de atraso operacional.",
      safetyNote:
        "Use a leitura como apoio de decisão; não há automação de reatribuição nesta página.",
      primaryActionLabel: "Filtrar sobrecarregados",
      onPrimaryAction: actions.focusOverloaded,
      secondaryActionLabel: "Ver atribuições",
      onSecondaryAction: actions.openServiceOrders,
    };
  }
  const unavailablePerson = ordered.find(
    person => person.availabilityStatus !== "AVAILABLE"
  );
  if (unavailablePerson) {
    return {
      title: "Revisar disponibilidade",
      entity: unavailablePerson.name,
      reason: "Existem responsáveis indisponíveis agora ou em breve.",
      impact: "A agenda pode ficar descoberta.",
      safetyNote:
        "Ausência ou indisponibilidade é tratada como sinal de revisão, não como bloqueio automático.",
      primaryActionLabel: "Filtrar disponíveis/indisponíveis",
      onPrimaryAction: actions.focusAvailability,
      secondaryActionLabel: "Ver agenda",
      onSecondaryAction: actions.openAppointments,
    };
  }
  return {
    title: "Equipe equilibrada",
    entity: target.person?.name ?? "Equipe operacional",
    reason: "Nenhum responsável exige intervenção agora.",
    impact: "Mantenha a distribuição sob acompanhamento.",
    safetyNote:
      "Sem pendência crítica, a recomendação é somente acompanhar; nada é executado automaticamente.",
    primaryActionLabel: "Ver ranking",
    onPrimaryAction: actions.focusAttention,
    secondaryActionLabel: "Abrir Timeline",
    onSecondaryAction: actions.openTimeline,
  };
}

function deriveTeamHealth(header: {
  totalPeople: number;
  activePeople: number;
  overloadedPeople: number;
  overdueServiceOrders: number;
  unavailablePeople: number;
}): { label: string; status: AppOperationalStatus; reading: string } {
  if (header.totalPeople === 0) {
    return {
      label: "Sem responsáveis operacionais",
      status: "ATENÇÃO",
      reading:
        "Cadastre responsáveis para distribuir O.S., agenda e carga de trabalho.",
    };
  }
  if (header.overdueServiceOrders >= 5 || header.overloadedPeople >= 2) {
    return {
      label: "Equipe crítica",
      status: "CRÍTICO",
      reading: `${header.overloadedPeople} responsáveis acima da capacidade e ${header.overdueServiceOrders} O.S. atrasadas podem comprometer a execução.`,
    };
  }
  if (
    header.overdueServiceOrders > 0 ||
    header.overloadedPeople > 0 ||
    header.unavailablePeople > 0
  ) {
    const signals = [
      header.overloadedPeople > 0
        ? `${header.overloadedPeople} responsável(is) acima da capacidade`
        : null,
      header.overdueServiceOrders > 0
        ? `${header.overdueServiceOrders} O.S. atrasada(s)`
        : null,
      header.unavailablePeople > 0
        ? `${header.unavailablePeople} indisponibilidade(s)`
        : null,
    ].filter(Boolean);
    return {
      label: "Equipe exige atenção",
      status: "ATENÇÃO",
      reading: `${signals.join(" e ")} podem comprometer a execução.`,
    };
  }
  return {
    label: "Equipe saudável",
    status: "NORMAL",
    reading: `${header.activePeople} responsável(is) ativo(s), sem sobrecarga, atrasos ou indisponibilidades registradas.`,
  };
}

function personHumanReading(person: OperationalPerson) {
  if (person.availabilityStatus === "UNAVAILABLE_NOW")
    return "Indisponível agora";
  if (person.overdueServiceOrdersCount > 0) return "Com atrasos atribuídos";
  if (isPersonOverloaded(person)) return "Acima da capacidade";
  if (!hasAssignedItems(person)) return "Sem carga atribuída";
  return "Executando normalmente";
}

function capacityNarrative(header: {
  totalPeople: number;
  availablePeople: number;
  overloadedPeople: number;
  unavailablePeople: number;
  averageServiceOrderUsage: string;
  averageAppointmentUsage: string;
}) {
  if (
    header.totalPeople > 0 &&
    header.overloadedPeople === 0 &&
    header.unavailablePeople === 0
  ) {
    return `${header.availablePeople} responsável(is) disponível(is), sem sobrecarga ou indisponibilidade registrada.`;
  }
  return `Uso médio O.S. ${header.averageServiceOrderUsage} · agenda ${header.averageAppointmentUsage}.`;
}

function personOperationalStateLabel(person: OperationalPerson) {
  if (person.status !== "ACTIVE") return "Inativo";
  if (person.availabilityStatus === "UNAVAILABLE_NOW") return "Indisponível";
  if (isPersonOverloaded(person)) return "Sobrecarregado";
  if (derivePersonOperationalStatus(person) !== "NORMAL") return "Atenção";
  return "Saudável";
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
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery(
    { limit: 5 },
    {
      enabled: isAuthenticated,
      retry: false,
      refetchOnWindowFocus: false,
    }
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
  const timelinePayload = normalizeObjectPayload<{
    events?: TeamTimelineEvent[];
    items?: TeamTimelineEvent[];
    timeline?: TeamTimelineEvent[];
    data?: TeamTimelineEvent[];
  }>(timelineQuery.data);
  const teamTimelineEvents = normalizeArrayPayload<TeamTimelineEvent>(
    timelinePayload?.events ??
      timelinePayload?.items ??
      timelinePayload?.timeline ??
      timelinePayload?.data ??
      timelineQuery.data
  ).slice(0, 5);
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
      totalPeople: people.length,
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
      availablePeople: people.filter(
        person =>
          person.status === "ACTIVE" &&
          person.availabilityStatus === "AVAILABLE"
      ).length,
      busyPeople: people.filter(person => person.loadStatus === "BUSY").length,
      openServiceOrders: people.reduce(
        (total, person) => total + person.openServiceOrdersCount,
        0
      ),
      averageServiceOrderUsage: formatAverageUsage(
        people.map(person => person.serviceOrderCapacityUsagePct)
      ),
      averageAppointmentUsage: formatAverageUsage(
        people.map(person => person.appointmentCapacityUsagePct)
      ),
      healthyPeople: people.filter(
        person =>
          person.status === "ACTIVE" &&
          derivePersonOperationalStatus(person) === "NORMAL"
      ).length,
      attentionPeople: people.filter(
        person =>
          person.status === "ACTIVE" &&
          derivePersonOperationalStatus(person) === "ATENÇÃO"
      ).length,
    }),
    [people]
  );
  const filteredPeople = useMemo(() => {
    const search = queryText.trim().toLowerCase();
    return sortByOperationalIntervention(people).filter(person => {
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
  const keyPeople = useMemo(
    () => sortByOperationalIntervention(people).slice(0, 3),
    [people]
  );
  const teamHealth = deriveTeamHealth(header);
  const commandTarget = useMemo(
    () => ({ person: selectedPerson, people, warningSummary }),
    [selectedPerson, people, warningSummary]
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
        openSettings: () => navigate("/settings"),
        openCreatePerson: () => setCreateOpen(true),
        focusAttention: () => setPeopleFilter("attention"),
        focusOverloaded: () => setPeopleFilter("overloaded"),
        focusAvailability: () => setPeopleFilter("available"),
      }),
    [commandTarget, navigate]
  );
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
        description="Centro de execução da equipe: carga, O.S., agenda, atrasos e indisponibilidades. Usuários, acesso e permissões ficam em Configurações."
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
            placeholder="Buscar responsável, função ou nota operacional"
            className="h-9"
          />
          <div className="flex h-9 items-center rounded-md border border-[var(--nexo-border-subtle,var(--border-subtle))] bg-[var(--nexo-control-bg,var(--surface-subtle))] px-3 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
            {filteredPeople.length} pessoa(s)
          </div>
        </div>
      </AppOperationalHeader>

      <AppSectionCard className="border border-[var(--accent-soft)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
            Equipe operacional · Responsáveis, carga e disponibilidade.
          </p>
          <Button variant="secondary" onClick={() => navigate("/settings")}>
            Permissões em Configurações
          </Button>
        </div>
      </AppSectionCard>

      <AppSectionBlock
        title="Visão executiva compacta"
        subtitle="Leitura rápida da sustentação da operação agora"
      >
        <AppSectionCard
          className={`border p-4 ${teamHealth.status === "CRÍTICO" ? "border-[var(--danger,var(--status-critical))]" : "border-[var(--nexo-border-subtle,var(--border-subtle))]"}`}
          data-testid="people-operational-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                  {teamHealth.label}
                </p>
                <AppOperationalStatusBadge status={teamHealth.status} />
              </div>
              <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
                {teamHealth.reading}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Métricas executivas compactas"
            >
              <span className={compactChipClass}>
                Ativos {header.activePeople}
              </span>
              <span className={compactChipClass}>
                Sobrecarregados {header.overloadedPeople}
              </span>
              <span className={compactChipClass}>
                Indisponíveis {header.unavailablePeople}
              </span>
              <span className={compactChipClass}>
                O.S. atrasadas {header.overdueServiceOrders}
              </span>
              <span className={compactChipClass}>
                Agenda hoje {header.todayAppointments}
              </span>
              <span className={compactChipClass}>{formatMoneyFallback()}</span>
            </div>
          </div>
          {summaryQuery.isError ? (
            <AppSectionCard
              className="mt-3 p-3 text-sm"
              data-testid="people-summary-partial-error"
            >
              <p className="font-semibold">
                Resumo operacional indisponível agora.
              </p>
              <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                A página continua exibindo ações e fallbacks sem inventar carga,
                agenda ou O.S.
              </p>
              <Button size="sm" variant="secondary" onClick={refresh}>
                Tentar novamente
              </Button>
            </AppSectionCard>
          ) : null}
        </AppSectionCard>
      </AppSectionBlock>

      <AppSectionBlock
        title="Quem sustenta a operação agora"
        subtitle="Responsáveis-chave em ordem de relevância operacional."
      >
        {people.length === 0 ? (
          <AppSectionCard className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-semibold">
              Sem responsáveis operacionais cadastrados.
            </p>
            <Button onClick={() => setCreateOpen(true)}>Nova pessoa</Button>
          </AppSectionCard>
        ) : (
          <div
            className={`grid gap-3 ${keyPeople.length === 1 ? "xl:grid-cols-1" : keyPeople.length === 2 ? "xl:grid-cols-2" : "xl:grid-cols-3"}`}
            data-testid="people-key-responsibles"
          >
            {keyPeople.map(person => (
              <AppSectionCard
                key={person.personId}
                className={`space-y-3 p-4 ${keyPeople.length === 1 ? "md:p-5" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-base font-semibold text-[var(--accent-primary)]">
                      {personInitials(person.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                        {person.name}
                      </p>
                      <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                        {person.role}
                      </p>
                    </div>
                  </div>
                  <AppOperationalStatusBadge
                    status={derivePersonOperationalStatus(person)}
                  />
                </div>
                <p className="text-sm font-medium text-[var(--nexo-text-primary,var(--text-primary))]">
                  {personHumanReading(person)}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    Estado: {personOperationalStateLabel(person)}
                  </span>
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    Carga: {loadLabels[person.loadStatus]}
                  </span>
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    O.S. {person.openServiceOrdersCount}
                  </span>
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    Atrasadas {person.overdueServiceOrdersCount}
                  </span>
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    Hoje {person.todayAppointmentsCount}
                  </span>
                </div>
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  {person.lastActivityAt
                    ? `Última atividade: ${formatDateTime(person.lastActivityAt)}`
                    : "Sem atividade recente registrada"}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedPersonId(person.personId)}
                  >
                    Ver detalhe
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/timeline")}
                  >
                    Timeline
                  </Button>
                </div>
              </AppSectionCard>
            ))}
          </div>
        )}
      </AppSectionBlock>

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

      <AppSectionBlock
        title="Atividade recente da equipe"
        subtitle="Últimas ações reais registradas na Timeline."
      >
        <AppSectionCard className="p-4" data-testid="people-team-activity">
          {timelineQuery.isLoading ? (
            <AppPageLoadingState description="Carregando ações recentes da equipe..." />
          ) : teamTimelineEvents.length > 0 ? (
            <AppTimeline className="space-y-2">
              {teamTimelineEvents.map((event, index) => (
                <AppTimelineItem
                  key={
                    event.id ??
                    `${getTimelineEventDate(event) ?? "event"}-${index}`
                  }
                  className="flex items-start justify-between gap-3 p-3"
                >
                  <div className="flex gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-[var(--nexo-text-muted,var(--text-muted))]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--nexo-text-primary,var(--text-primary))]">
                        {getTimelineActor(event)} · {getTimelineAction(event)}
                      </p>
                      <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                        {getTimelineContext(event)} ·{" "}
                        {formatDateTime(getTimelineEventDate(event))}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/timeline")}
                  >
                    Abrir Timeline
                  </Button>
                </AppTimelineItem>
              ))}
            </AppTimeline>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  Aguardando eventos da equipe.
                </p>
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  Quando responsáveis executarem O.S., agenda, cobrança ou
                  mensagens, as ações aparecerão aqui.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate("/timeline")}
              >
                Abrir Timeline
              </Button>
            </div>
          )}
        </AppSectionCard>
      </AppSectionBlock>

      <AppSectionBlock
        title="Ranking operacional da equipe"
        subtitle="Quem exige atenção primeiro: sobrecarga, indisponibilidade, atraso, saudáveis e inativos."
      >
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
        {summaryQuery.isLoading ? (
          <AppPageLoadingState title="Consolidando ranking operacional" />
        ) : null}
        {!summaryQuery.isLoading && people.length === 0 ? (
          <AppSectionCard className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
              Sem responsáveis cadastrados.
            </p>
            <p className="max-w-xl text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
              Cadastre responsáveis para acompanhar carga, execução e
              indisponibilidade.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setCreateOpen(true)}>Nova pessoa</Button>
              <Button variant="secondary" onClick={() => navigate("/settings")}>
                Abrir Configurações
              </Button>
            </div>
          </AppSectionCard>
        ) : filteredPeople.length === 0 && !summaryQuery.isLoading ? (
          <AppPageEmptyState
            title="Busca sem resultado"
            description="Nenhuma pessoa corresponde aos filtros operacionais atuais."
          />
        ) : !summaryQuery.isLoading ? (
          <div className="space-y-3" data-testid="people-workload-list">
            {filteredPeople.map(person => {
              const operationalStatus = derivePersonOperationalStatus(person);
              return (
                <AppSectionCard
                  key={person.personId}
                  className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(260px,2fr)_auto] lg:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-primary)]">
                      {personInitials(person.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                        {person.name}
                      </p>
                      <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                        {person.role}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <AppOperationalStatusBadge status={operationalStatus} />
                      <span className="text-sm font-medium text-[var(--nexo-text-primary,var(--text-primary))]">
                        {personHumanReading(person)}
                      </span>
                      <span className={compactChipClass}>
                        {personStatusLabel(person.status)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
                      <p>
                        Operação: O.S. {person.openServiceOrdersCount} · Agenda{" "}
                        {person.todayAppointmentsCount}
                      </p>
                      <p>
                        Risco: Atrasos {person.overdueServiceOrdersCount} ·
                        Sobrecarga {isPersonOverloaded(person) ? "sim" : "não"}
                      </p>
                      <p>
                        Capacidade: O.S.{" "}
                        {formatCapacity(person.dailyServiceOrderCapacity)} ·
                        Agenda {formatCapacity(person.dailyAppointmentCapacity)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedPersonId(person.personId)}
                    >
                      Detalhe
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate("/timeline")}
                    >
                      Timeline
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate("/service-orders")}
                    >
                      Atribuições
                    </Button>
                  </div>
                </AppSectionCard>
              );
            })}
          </div>
        ) : null}
      </AppSectionBlock>

      <AppSectionBlock
        title="Capacidade da operação"
        subtitle={
          selectedPerson
            ? `Detalhe operacional de ${selectedPerson.name}`
            : "Visão agregada da equipe sem exigir seleção."
        }
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
              <AppStatCard
                label="O.S. atribuídas"
                value={`${selectedPerson.openServiceOrdersCount}`}
                helper={`${selectedPerson.overdueServiceOrdersCount} atrasada(s).`}
              />
              <AppStatCard
                label="Agenda de hoje"
                value={`${selectedPerson.todayAppointmentsCount}`}
                helper={`${selectedPerson.futureAppointmentsCount} futura(s).`}
              />
              <AppStatCard
                label="Capacidade planejada"
                value={`O.S. ${formatCapacity(selectedPerson.dailyServiceOrderCapacity)}`}
                helper={`Agenda ${formatCapacity(selectedPerson.dailyAppointmentCapacity)}.`}
              />
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
            <AppSectionCard className="p-4">
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
            </AppSectionCard>
          </div>
        ) : (
          <AppSectionCard
            className="space-y-3 p-4"
            data-testid="people-capacity-availability-assignments"
          >
            <div>
              <p className="font-semibold">
                {header.overloadedPeople === 0 && header.unavailablePeople === 0
                  ? "Capacidade sob controle"
                  : "Gargalos atuais de capacidade"}
              </p>
              <p className="mt-1 text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
                {capacityNarrative(header)}
              </p>
            </div>
            <div className="grid gap-2 text-sm md:grid-cols-4">
              <span>
                Capacidade utilizada: O.S. {header.averageServiceOrderUsage} ·
                Agenda {header.averageAppointmentUsage}
              </span>
              <span>Disponíveis agora: {header.availablePeople}</span>
              <span>
                Gargalos atuais:{" "}
                {header.overloadedPeople + header.overdueServiceOrders}
              </span>
              <span>
                Próximas indisponibilidades:{" "}
                {
                  people.filter(person => person.nextAvailabilityException)
                    .length
                }
              </span>
            </div>
          </AppSectionCard>
        )}
      </AppSectionBlock>

      <AppSectionBlock
        title="Desempenho e impacto da equipe"
        subtitle="Leituras que amadurecem conforme O.S., cobranças e eventos forem registrados."
      >
        <AppSectionCard className="p-4" data-testid="people-performance-impact">
          <p className="font-semibold">Evolução da equipe</p>
          <p className="mt-2 text-sm font-medium">
            Ainda não existe histórico suficiente para gerar indicadores
            confiáveis.
          </p>
          <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
            Assim que houver O.S. concluídas, cobranças vinculadas e eventos
            reais, esta área deixa de ser compacta sem inventar métricas.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => navigate("/timeline")}
          >
            Abrir Timeline
          </Button>
        </AppSectionCard>
      </AppSectionBlock>

      {isAdmin ? (
        <AppSectionBlock
          title="Sinais de atribuição"
          subtitle="Resumo compacto de alertas em atribuições."
        >
          {warningSummaryQuery.isLoading ? (
            <AppPageLoadingState description="Consolidando sinais dos últimos 30 dias..." />
          ) : null}
          {warningSummaryQuery.isError ? (
            <AppSectionCard
              className="p-4 text-sm"
              data-testid="assignee-warning-summary-error"
            >
              <p className="font-semibold">
                Sinais de atribuição indisponíveis agora.
              </p>
              <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                A visão principal continua usando carga, agenda e O.S.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void warningSummaryQuery.refetch()}
              >
                Tentar novamente
              </Button>
            </AppSectionCard>
          ) : null}
          {warningSummary ? (
            warningSummary.totals.shown === 0 &&
            warningSummary.totals.confirmed === 0 &&
            (!mostFrequentWarningType ||
              mostFrequentWarningType.shown === 0) ? (
              <AppSectionCard
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                data-testid="assignee-warning-summary"
              >
                <p className="font-medium">
                  Não houve alertas de atribuição recentemente.
                </p>
                <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                  0 alertas exibidos · 0 confirmações após alerta
                </p>
              </AppSectionCard>
            ) : (
              <div
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                data-testid="assignee-warning-summary"
              >
                <AppStatCard
                  label="Alertas exibidos"
                  value={`${warningSummary.totals.shown}`}
                  helper="Sinais críticos ativos."
                />
                <AppStatCard
                  label="Confirmações após alerta"
                  value={`${warningSummary.totals.confirmed}`}
                  helper="Confirmações após alerta."
                />
                <AppStatCard
                  label="Taxa de confirmação"
                  value={
                    warningSummary.totals.confirmationRatePct == null
                      ? "Sem exibições"
                      : `${warningSummary.totals.confirmationRatePct}%`
                  }
                  helper="Confirmações divididas por alertas."
                />
                <AppSectionCard className="p-4 text-sm">
                  <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                    Sinal mais frequente
                  </p>
                  <p className="font-semibold">
                    {mostFrequentWarningType
                      ? warningTypeLabels[mostFrequentWarningType.warningType]
                      : "Nenhum sinal registrado"}
                  </p>
                </AppSectionCard>
              </div>
            )
          ) : null}
        </AppSectionBlock>
      ) : null}

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
