import { useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useLocation } from "wouter";
import CreatePersonModal from "@/components/CreatePersonModal";
import EditPersonModal from "@/components/EditPersonModal";
import { NextBestActionCard } from "@/components/app/OperationalCommandLayer";
import {
  AppDataTable,
  AppInput,
  AppOperationalStatusBadge,
  AppPageShell,
  AppRowActionsDropdown,
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
      label: "Sem equipe cadastrada",
      status: "ATENÇÃO",
      reading: "Sem responsáveis operacionais cadastrados.",
    };
  }
  if (header.overdueServiceOrders >= 5 || header.overloadedPeople >= 2) {
    return {
      label: "Crítica",
      status: "CRÍTICO",
      reading: `${header.overloadedPeople} responsável(is) sobrecarregado(s) e ${header.overdueServiceOrders} O.S. atrasada(s).`,
    };
  }
  if (
    header.overdueServiceOrders > 0 ||
    header.overloadedPeople > 0 ||
    header.unavailablePeople > 0
  ) {
    const attention = header.overloadedPeople + header.unavailablePeople;
    return {
      label: "Atenção",
      status: "ATENÇÃO",
      reading:
        attention > 0
          ? `${attention} responsável(is) exigem atenção.`
          : "Atrasos atribuídos exigem intervenção.",
    };
  }
  return {
    label: "Saudável",
    status: "NORMAL",
    reading: "Equipe saudável, sem sobrecarga ou atrasos carregados.",
  };
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
        title="Visão executiva da equipe"
        subtitle="Situação da equipe agora"
      >
        <AppSectionCard
          className="space-y-3"
          data-testid="people-operational-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                Saúde da equipe: {teamHealth.label}
              </p>
              <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                {teamHealth.reading}{" "}
                {people.length === 0
                  ? "Cadastre responsáveis para acompanhar carga, execução e indisponibilidade."
                  : `Carga acima da capacidade em ${header.overloadedPeople} pessoa(s).`}
              </p>
            </div>
            <AppOperationalStatusBadge status={teamHealth.status} />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <AppStatCard
              label="Responsáveis ativos"
              value={`${header.activePeople}`}
              helper="Responsáveis executando a operação."
            />
            <AppStatCard
              label="Sobrecarregados"
              value={`${header.overloadedPeople}`}
              helper="Carga acima da capacidade."
            />
            <AppStatCard
              label="Indisponíveis"
              value={`${header.unavailablePeople}`}
              helper="Agora ou em breve."
            />
            <AppStatCard
              label="O.S. atrasadas"
              value={`${header.overdueServiceOrders}`}
              helper="Atrasos atribuídos."
            />
            <AppStatCard
              label="Agenda hoje"
              value={`${header.todayAppointments}`}
              helper="Agendamentos atribuídos hoje."
            />
            <AppStatCard
              label="Receita gerada"
              value="—"
              helper="A equipe ainda não possui execução financeira suficiente para análise."
            />
          </div>
          {summaryQuery.isError ? (
            <AppSectionCard
              className="p-3 text-sm"
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

      <AppSectionBlock
        title="Responsáveis-chave"
        subtitle="Pessoas que sustentam a operação agora."
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
            className="grid gap-3 xl:grid-cols-3"
            data-testid="people-key-responsibles"
          >
            {keyPeople.map(person => (
              <AppSectionCard key={person.personId} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                      {person.name}
                    </p>
                    <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                      {person.role}
                    </p>
                  </div>
                  <AppOperationalStatusBadge
                    status={derivePersonOperationalStatus(person)}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[var(--nexo-control-bg,var(--surface-subtle))] px-2 py-1">
                    {personOperationalStateLabel(person)}
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

      <AppSectionBlock
        title="Ranking operacional da equipe"
        subtitle="Quem exige atenção primeiro: sobrecarga, indisponibilidade, atraso, saudáveis e inativos."
      >
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
          <AppDataTable
            className="min-w-[1180px]"
            data-testid="people-workload-table"
          >
            <thead>
              <tr>
                <th>Responsável</th>
                <th>Estado</th>
                <th>Carga atual</th>
                <th>Capacidade planejada</th>
                <th>O.S. ativas</th>
                <th>O.S. atrasadas</th>
                <th>Agenda hoje</th>
                <th>Valor 7 dias</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeople.map(person => {
                const operationalStatus = derivePersonOperationalStatus(person);
                return (
                  <tr key={person.personId}>
                    <td>
                      <div className="space-y-1">
                        <p className="font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                          {person.name}
                        </p>
                        <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                          {person.role}
                        </p>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <AppOperationalStatusBadge status={operationalStatus} />
                        <p className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                          {personOperationalStateLabel(person)} ·{" "}
                          {personStatusLabel(person.status)}
                        </p>
                      </div>
                    </td>
                    <td>
                      {loadLabels[person.loadStatus]} · O.S.{" "}
                      {formatUsage(person.serviceOrderCapacityUsagePct)} ·
                      Agenda {formatUsage(person.appointmentCapacityUsagePct)}
                    </td>
                    <td>
                      O.S. {formatCapacity(person.dailyServiceOrderCapacity)} ·
                      Agenda {formatCapacity(person.dailyAppointmentCapacity)}
                    </td>
                    <td>{person.openServiceOrdersCount}</td>
                    <td>{person.overdueServiceOrdersCount}</td>
                    <td>{person.todayAppointmentsCount}</td>
                    <td className="text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                      Aguardando vínculo
                    </td>
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
                            label: "Abrir Timeline",
                            onSelect: () => navigate("/timeline"),
                          },
                          {
                            label: "Filtrar atribuições",
                            onSelect: () => navigate("/service-orders"),
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
        ) : null}
      </AppSectionBlock>

      <AppSectionBlock
        title="Capacidade, disponibilidade e atribuições"
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
          <div
            className="grid gap-3 xl:grid-cols-3"
            data-testid="people-capacity-availability-assignments"
          >
            <AppSectionCard className="p-4">
              <p className="font-semibold">Capacidade da equipe</p>
              <p className="mt-2 text-sm">
                Média O.S.: {header.averageServiceOrderUsage}
              </p>
              <p className="text-sm">
                Média agenda: {header.averageAppointmentUsage}
              </p>
              <p className="mt-2 text-xs text-[var(--nexo-text-muted,var(--text-muted))]">
                Saudável {header.healthyPeople} · Atenção{" "}
                {header.attentionPeople} · Sobrecarregado{" "}
                {header.overloadedPeople} · Indisponível{" "}
                {header.unavailablePeople}
              </p>
            </AppSectionCard>
            <AppSectionCard className="p-4">
              <p className="font-semibold">Atribuições ativas</p>
              <p className="mt-2 text-sm">
                O.S. abertas atribuídas: {header.openServiceOrders}
              </p>
              <p className="text-sm">
                O.S. vencidas/atrasadas: {header.overdueServiceOrders}
              </p>
              <p className="text-sm">
                Agendamentos hoje: {header.todayAppointments}
              </p>
              <p className="text-sm">
                Agendamentos não confirmados: sem leitura confiável disponível
                nesta visão.
              </p>
              <p className="text-sm">
                Cobranças pendentes atribuídas: aguardando vínculo financeiro
              </p>
            </AppSectionCard>
            <AppSectionCard className="p-4">
              <p className="font-semibold">Disponibilidade</p>
              <p className="mt-2 text-sm">
                Disponíveis agora: {header.availablePeople}
              </p>
              <p className="text-sm">Em atendimento: {header.busyPeople}</p>
              <p className="text-sm">
                Indisponíveis: {header.unavailablePeople}
              </p>
              <p className="text-sm">
                Próximas indisponibilidades:{" "}
                {
                  people.filter(person => person.nextAvailabilityException)
                    .length
                }
              </p>
            </AppSectionCard>
          </div>
        )}
      </AppSectionBlock>

      <AppSectionBlock
        title="Desempenho e impacto da equipe"
        subtitle="Leituras que amadurecem conforme O.S., cobranças e eventos forem registrados."
      >
        <div
          className="grid gap-3 xl:grid-cols-3"
          data-testid="people-performance-impact"
        >
          <AppSectionCard className="p-4">
            <p className="font-semibold">Desempenho</p>
            <p className="mt-2 text-sm font-medium">
              Aguardando histórico suficiente
            </p>
            <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
              Assim que houver O.S. concluídas, esta área mostra conclusão,
              atrasos e taxa de entrega.
            </p>
          </AppSectionCard>
          <AppSectionCard className="p-4">
            <p className="font-semibold">Impacto financeiro</p>
            <p className="mt-2 text-sm font-medium">
              Aguardando vínculo financeiro
            </p>
            <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
              Quando houver cobranças vinculadas à execução, esta área mostrará
              valor movimentado por responsável.
            </p>
          </AppSectionCard>
          <AppSectionCard className="p-4">
            <p className="font-semibold">Histórico da equipe</p>
            <p className="mt-2 text-sm font-medium">
              Aguardando eventos da equipe
            </p>
            <p className="text-sm text-[var(--nexo-text-muted,var(--text-muted))]">
              Eventos de O.S., agenda, cobrança e mensagem aparecerão aqui.
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
        </div>
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
            <div
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              data-testid="assignee-warning-summary"
            >
              <AppStatCard
                label="Alertas exibidos"
                value={`${warningSummary.totals.shown}`}
                helper={
                  warningSummary.totals.shown === 0
                    ? "Nenhum sinal crítico registrado em atribuições. 0 alertas exibidos"
                    : "Sinais críticos ativos."
                }
              />
              <AppStatCard
                label="Confirmações após alerta"
                value={`${warningSummary.totals.confirmed}`}
                helper={
                  warningSummary.totals.confirmed === 0
                    ? "0 confirmações após alerta"
                    : "Confirmações após alerta."
                }
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
                  {mostFrequentWarningType && mostFrequentWarningType.shown > 0
                    ? warningTypeLabels[mostFrequentWarningType.warningType]
                    : "Nenhum sinal registrado"}
                </p>
              </AppSectionCard>
            </div>
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
