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
  AppNextBestActionBlock,
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
  const summaryPayload = normalizeObjectPayload<{ people?: OperationalPerson[] }>(
    summaryQuery.data
  );
  const people = normalizeArrayPayload<OperationalPerson>(
    summaryPayload?.people
  );
  const selectedPerson =
    people.find(person => person.personId === selectedPersonId) ?? null;
  const exceptions = normalizeArrayPayload<AvailabilityException>(
    exceptionsQuery.data
  );
  const isAdmin = role === "ADMIN";
  const rawWarningSummary = normalizeObjectPayload<Partial<AssigneeWarningSummary>>(
    warningSummaryQuery.data
  );
  const warningTypes = normalizeArrayPayload<
    AssigneeWarningSummary["byWarningType"][number]
  >(rawWarningSummary?.byWarningType);
  const warningContexts = normalizeArrayPayload<
    AssigneeWarningSummary["byContext"][number]
  >(rawWarningSummary?.byContext);
  const warningTotals = rawWarningSummary?.totals ?? null;
  const warningSummary = rawWarningSummary
    ? {
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
      } satisfies AssigneeWarningSummary
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
  const nextBestAction = useMemo(() => {
    const ordered = [...people].sort((a, b) => {
      const order: Record<AppPriorityLevel, number> = {
        P0: 0,
        P1: 1,
        P2: 2,
        P3: 3,
      };
      const priorityA = derivePersonPriority(a) ?? "P3";
      const priorityB = derivePersonPriority(b) ?? "P3";
      if (order[priorityA] !== order[priorityB])
        return order[priorityA] - order[priorityB];
      return b.overdueServiceOrdersCount - a.overdueServiceOrdersCount;
    });
    const critical = ordered.find(person => derivePersonPriority(person));
    if (!critical) return null;
    const priority = derivePersonPriority(critical) ?? "P2";
    const overloaded =
      critical.loadStatus === "OVERLOADED" ||
      critical.overdueServiceOrdersCount > 0;
    return {
      person: critical,
      priority,
      action: overloaded
        ? "Verificar redistribuição de carga"
        : "Revisar disponibilidade e capacidade",
      reason: overloaded
        ? `${critical.name} tem ${critical.openServiceOrdersCount} O.S. abertas e ${critical.overdueServiceOrdersCount} atrasada(s).`
        : `${critical.name} está com status ${availabilityLabels[critical.availabilityStatus]} e capacidade ${capacityLabels[critical.capacityStatus]}.`,
      impact: overloaded
        ? "Reduz atraso de execução e evita sobrecarga no responsável."
        : "Evita atribuição manual em pessoa indisponível ou perto do limite.",
      ctaLabel: "Abrir detalhe",
      onClick: () => setSelectedPersonId(critical.personId),
    };
  }, [people]);
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

      <AppNextBestActionBlock
        title="Próxima melhor ação"
        subtitle="Sugestão contextual usando somente carga, capacidade e disponibilidade já carregadas."
        compact
      >
        {nextBestAction ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <AppPriorityBadge
                  priority={nextBestAction.priority}
                  label={personPriorityLabel(nextBestAction.priority)}
                />
                <AppOperationalStatusBadge
                  status={derivePersonOperationalStatus(nextBestAction.person)}
                />
              </div>
              <p className="text-sm font-semibold text-[var(--nexo-text-primary,var(--text-primary))]">
                {nextBestAction.action}
              </p>
              <p className="text-xs text-[var(--nexo-text-secondary,var(--text-secondary))]">
                Motivo: {nextBestAction.reason}
              </p>
              <p className="text-xs text-[var(--nexo-text-secondary,var(--text-secondary))]">
                Impacto: {nextBestAction.impact}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={nextBestAction.onClick}
            >
              {nextBestAction.ctaLabel}
            </Button>
          </div>
        ) : (
          <AppPageEmptyState
            title="Sem intervenção dominante"
            description="Não há pessoa carregada com sobrecarga, atraso ou indisponibilidade exigindo ação imediata."
          />
        )}
      </AppNextBestActionBlock>

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
