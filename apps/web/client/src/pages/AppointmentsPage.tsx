import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  explainOperationalError,
  OperationalInlineFeedback,
  OperationalNextAction,
  OperationalRelationSummary,
} from "@/components/operating-system/OperationalRefinementBlocks";
import {
  getAppointmentSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import {
  OPERATIONAL_NEXT_ACTION_CLASS,
  OPERATIONAL_PRIMARY_CTA_CLASS,
  resolveOperationalActionLabel,
  toSingleLineAction,
} from "@/lib/operations/operational-list";
import {
  AppOperationalBar,
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  appSelectionPillClasses,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { SecondaryButton } from "@/components/design-system";
import { inRange, safeDate } from "@/lib/operational/kpi";
import { toast } from "sonner";

type TabKey = "agenda" | "confirmed" | "pending" | "conflicts" | "history";
type WindowFilter = "all" | "today" | "next7" | "overdue";

type AppointmentLike = {
  id?: string;
  customerId?: string;
  customer?: { id?: string; name?: string };
  assignedToPersonId?: string | null;
  personId?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: string | null;
  priority?: number | string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type OperationalSignal = {
  key: string;
  label: string;
  tone: "danger" | "warning" | "info" | "healthy";
};

type NextActionIntent =
  | "confirm"
  | "status"
  | "service_order"
  | "communication"
  | "reschedule"
  | "none";

type NextActionDecision = {
  title: string;
  reason: string;
  impact: string;
  urgency: string;
  intent: NextActionIntent;
  healthy?: boolean;
  secondary: NextActionIntent[];
};

function mapOperationalState(item: AppointmentLike, hasConflict: boolean) {
  const severity = getAppointmentSeverity(item);
  const status = String(item?.status ?? "").toUpperCase();

  if (status === "DONE") return "Concluído";
  if (status === "CANCELED") return "Cancelado";
  if (status === "NO_SHOW") return "Não compareceu";
  if (status === "CONFIRMED") return hasConflict ? "Em risco" : "Confirmado";
  if (hasConflict || severity === "critical") return "Em risco";
  return status === "SCHEDULED" ? "Pendente" : getOperationalSeverityLabel(severity);
}

function getSignalToneClasses(tone: OperationalSignal["tone"]) {
  if (tone === "danger") return "bg-[var(--dashboard-danger)]/15 text-[var(--dashboard-danger)]";
  if (tone === "warning") return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  if (tone === "info") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [activeTab, setActiveTab] = useOperationalMemoryState<TabKey>(
    "nexo.appointments.tab.v1",
    "agenda"
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState("nexo.appointments.search.v1", "");
  const [statusFilter, setStatusFilter] = useOperationalMemoryState("nexo.appointments.status-filter.v1", "all");
  const [windowFilter, setWindowFilter] = useOperationalMemoryState<WindowFilter>(
    "nexo.appointments.window-filter.v1",
    "today"
  );
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.appointments.customer-filter.v1",
    "all"
  );
  const [focusedAppointmentId, setFocusedAppointmentId] = useOperationalMemoryState<string | null>(
    "nexo.appointments.active-id.v1",
    null
  );
  const [openServiceOrderCreate, setOpenServiceOrderCreate] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = useState<"neutral" | "success" | "error">("neutral");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const updateAppointment = trpc.nexo.appointments.update.useMutation();

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const appointments = useMemo(
    () => normalizeArrayPayload<AppointmentLike>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const hasData = appointments.length > 0;
  const showInitialLoading = appointmentsQuery.isLoading && !hasData;
  const showErrorState = appointmentsQuery.error && !hasData;

  usePageDiagnostics({
    page: "appointments",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && appointments.length === 0,
    dataCount: appointments.length,
  });

  const appointmentsBySlot = useMemo(
    () =>
      appointments.reduce<Record<string, number>>((acc, item) => {
        const slot = safeDate(item?.startsAt)?.toISOString().slice(0, 16) ?? "";
        if (!slot) return acc;
        acc[slot] = (acc[slot] ?? 0) + 1;
        return acc;
      }, {}),
    [appointments]
  );

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const next7End = new Date(dayEnd);
  next7End.setDate(next7End.getDate() + 7);

  const appointmentWithContext = useMemo(() => {
    return appointments.map(item => {
      const slot = safeDate(item?.startsAt)?.toISOString().slice(0, 16) ?? "";
      const hasConflict = Boolean(slot && (appointmentsBySlot[slot] ?? 0) > 1);
      const status = String(item?.status ?? "").toUpperCase();
      const start = safeDate(item?.startsAt);
      const minutesToStart = start ? Math.floor((start.getTime() - now.getTime()) / (1000 * 60)) : Number.NaN;
      const isDelayed = Boolean(start && start < now && ["SCHEDULED", "CONFIRMED"].includes(status));
      const startsSoon = Number.isFinite(minutesToStart) && minutesToStart >= 0 && minutesToStart <= 120;
      const serviceOrder = serviceOrders.find(
        order =>
          String(order?.appointmentId ?? "") === String(item?.id ?? "") ||
          (String(order?.customerId ?? "") === String(item?.customerId ?? "") &&
            ["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE"].includes(String(order?.status ?? "").toUpperCase()))
      );
      const hasServiceOrder = Boolean(serviceOrder?.id);
      const requiresCommunication = status === "SCHEDULED" || startsSoon || isDelayed;
      const operationalState = mapOperationalState(item, hasConflict || isDelayed);

      const signals: OperationalSignal[] = [];
      if (startsSoon) signals.push({ key: "starts_soon", label: "Agendamento próximo", tone: "warning" });
      if (isDelayed) signals.push({ key: "delayed", label: "Atrasado sem avanço", tone: "danger" });
      if (status === "SCHEDULED") signals.push({ key: "not_confirmed", label: "Não confirmado", tone: "warning" });
      if (requiresCommunication) signals.push({ key: "pending_contact", label: "Comunicação pendente", tone: "info" });
      if (!item?.customerId) signals.push({ key: "customer_dependency", label: "Dependente de cliente", tone: "warning" });
      if (status === "CONFIRMED" && !hasServiceOrder) {
        signals.push({ key: "service_order_dependency", label: "Dependente de O.S.", tone: "info" });
      }
      if (status === "CANCELED") signals.push({ key: "canceled", label: "Cancelado", tone: "danger" });
      if (Number(item?.priority ?? 0) >= 3 || hasConflict) {
        signals.push({ key: "priority_high", label: "Prioridade elevada", tone: "warning" });
      }
      if (signals.length === 0) signals.push({ key: "healthy", label: "Saudável", tone: "healthy" });

      const decision: NextActionDecision = (() => {
        if (status === "SCHEDULED") {
          return {
            title: "Confirmar agendamento",
            reason: "Atendimento ainda não confirmado com cliente.",
            impact: "Reduz no-show e protege a janela da agenda.",
            urgency: startsSoon ? "Alta · janela próxima" : "Prioridade do turno",
            intent: "confirm",
            secondary: ["communication", "reschedule"],
          };
        }
        if (isDelayed && status !== "DONE" && status !== "CANCELED") {
          return {
            title: "Atualizar status do atendimento",
            reason: "A hora já passou e o fluxo não avançou no sistema.",
            impact: "Tira o item do limbo operacional e corrige fila.",
            urgency: "Urgente",
            intent: "status",
            secondary: ["communication"],
          };
        }
        if (status === "CONFIRMED" && !hasServiceOrder) {
          return {
            title: "Iniciar ordem de serviço",
            reason: "Agendamento confirmado sem O.S. vinculada.",
            impact: "Conecta agenda com execução e cobrança.",
            urgency: startsSoon ? "Alta · execução iminente" : "Sequência operacional",
            intent: "service_order",
            secondary: ["communication"],
          };
        }
        if (status === "CANCELED") {
          return {
            title: "Registrar ajuste e comunicar cliente",
            reason: "Cancelamento exige rastreabilidade operacional.",
            impact: "Evita ruído de agenda e mantém contexto limpo.",
            urgency: "Controle operacional",
            intent: "communication",
            secondary: ["reschedule"],
          };
        }
        return {
          title: "Monitorar próximo marco",
          reason: "Fluxo está consistente para o estágio atual.",
          impact: "Mantém previsibilidade e evita retrabalho.",
          urgency: "Saudável",
          intent: "none",
          healthy: true,
          secondary: ["communication"],
        };
      })();

      return {
        item,
        hasConflict,
        isDelayed,
        startsSoon,
        requiresCommunication,
        hasServiceOrder,
        serviceOrder,
        operationalState,
        nextAction: decision.title,
        decision,
        signals,
      };
    });
  }, [appointments, appointmentsBySlot, now, serviceOrders]);

  const filteredAppointments = useMemo(() => {
    let base = appointmentWithContext;

    if (activeTab === "confirmed") {
      base = base.filter(({ item }) => String(item?.status ?? "").toUpperCase() === "CONFIRMED");
    } else if (activeTab === "pending") {
      base = base.filter(({ item }) => String(item?.status ?? "").toUpperCase() === "SCHEDULED");
    } else if (activeTab === "conflicts") {
      base = base.filter(({ hasConflict }) => hasConflict);
    } else if (activeTab === "history") {
      base = [...base].sort(
        (a, b) => (safeDate(b.item?.startsAt)?.getTime() ?? 0) - (safeDate(a.item?.startsAt)?.getTime() ?? 0)
      );
    }

    if (statusFilter !== "all") {
      base = base.filter(({ item }) => String(item?.status ?? "").toUpperCase() === statusFilter);
    }

    if (windowFilter === "today") {
      base = base.filter(({ item }) => inRange(safeDate(item?.startsAt), dayStart, dayEnd));
    } else if (windowFilter === "next7") {
      base = base.filter(({ item }) => inRange(safeDate(item?.startsAt), dayStart, next7End));
    } else if (windowFilter === "overdue") {
      base = base.filter(({ isDelayed }) => isDelayed);
    }

    if (customerFilter !== "all") {
      base = base.filter(({ item }) => String(item?.customerId ?? "") === customerFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter(({ item }) => {
        const name = String(item?.customer?.name ?? "").toLowerCase();
        const title = String(item?.title ?? "").toLowerCase();
        const id = String(item?.id ?? "");
        return name.includes(term) || title.includes(term) || id.includes(term);
      });
    }

    return base;
  }, [activeTab, appointmentWithContext, customerFilter, dayEnd, dayStart, next7End, searchTerm, statusFilter, windowFilter]);

  const delayedCount = filteredAppointments.filter(({ isDelayed }) => isDelayed).length;
  const conflictCount = filteredAppointments.filter(({ hasConflict }) => hasConflict).length;

  useEffect(() => {
    if (filteredAppointments.length === 0) {
      setFocusedAppointmentId(null);
      return;
    }
    const hasFocused = filteredAppointments.some(({ item }) => String(item?.id ?? "") === String(focusedAppointmentId ?? ""));
    if (!hasFocused) {
      setFocusedAppointmentId(String(filteredAppointments[0]?.item?.id ?? ""));
    }
  }, [filteredAppointments, focusedAppointmentId, setFocusedAppointmentId]);

  const focused =
    filteredAppointments.find(({ item }) => String(item?.id ?? "") === String(focusedAppointmentId ?? "")) ??
    filteredAppointments[0] ??
    null;

  const timelineFallback = useMemo(() => {
    if (!focused?.item?.id) return [];
    const status = String(focused.item.status ?? "").toUpperCase();
    const entries = [
      {
        id: `created-${focused.item.id}`,
        at: focused.item.createdAt ?? focused.item.startsAt,
        text: "Agendamento criado e associado ao cliente.",
      },
      {
        id: `scheduled-${focused.item.id}`,
        at: focused.item.startsAt,
        text: `Janela prevista para ${safeDate(focused.item.startsAt)?.toLocaleString("pt-BR") ?? "horário não informado"}.`,
      },
      {
        id: `status-${focused.item.id}`,
        at: focused.item.updatedAt ?? focused.item.startsAt,
        text:
          status === "CONFIRMED"
            ? "Confirmação registrada para execução."
            : status === "CANCELED"
              ? "Cancelamento registrado no fluxo."
              : status === "DONE"
                ? "Atendimento concluído."
                : "Status operacional em acompanhamento.",
      },
    ];

    if (focused.requiresCommunication) {
      entries.push({
        id: `comms-${focused.item.id}`,
        at: focused.item.updatedAt ?? focused.item.startsAt,
        text: "Comunicação ao cliente pendente ou recomendada.",
      });
    }
    if (focused.hasServiceOrder) {
      entries.push({
        id: `so-${focused.item.id}`,
        at: focused.serviceOrder?.createdAt ?? focused.item.updatedAt,
        text: `O.S. #${String(focused.serviceOrder?.id)} vinculada ao atendimento.`,
      });
    }
    return entries;
  }, [focused]);

  const executeStatusUpdate = async (status: "CONFIRMED" | "CANCELED" | "DONE" | "NO_SHOW") => {
    if (!focused?.item?.id) return;
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Processando ação...");
      await updateAppointment.mutateAsync({ id: String(focused.item.id), status } as any);
      setActionFeedbackTone("success");
      setActionFeedback(
        status === "CONFIRMED"
          ? "Agendamento confirmado com sucesso."
          : status === "CANCELED"
            ? "Agendamento cancelado com sucesso."
            : status === "DONE"
              ? "Agendamento marcado como concluído."
              : "Agendamento marcado como não comparecimento."
      );
      await appointmentsQuery.refetch();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Falha ao atualizar agendamento.";
      const message = explainOperationalError({
        fallback: rawMessage,
        cause: "Não foi possível atualizar o status deste agendamento no momento.",
        suggestion: "Valide o status atual e tente novamente em seguida.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  };

  const runInlineAction = async (intent: NextActionIntent) => {
    if (!focused) return;
    if (intent === "confirm") {
      await executeStatusUpdate("CONFIRMED");
      return;
    }
    if (intent === "status") {
      await executeStatusUpdate("DONE");
      return;
    }
    if (intent === "service_order") {
      setOpenServiceOrderCreate(true);
      return;
    }
    if (intent === "communication") {
      navigate(`/whatsapp?customerId=${focused.item?.customerId}`);
      return;
    }
    if (intent === "reschedule") {
      const start = safeDate(focused.item.startsAt);
      if (!start || !focused.item.id) return;
      const end = safeDate(focused.item.endsAt);
      start.setDate(start.getDate() + 1);
      if (end) end.setDate(end.getDate() + 1);
      try {
        setActionFeedbackTone("neutral");
        setActionFeedback("Remarcando agendamento...");
        await updateAppointment.mutateAsync({
          id: String(focused.item.id),
          startsAt: start.toISOString(),
          endsAt: end?.toISOString(),
        } as any);
        setActionFeedbackTone("success");
        setActionFeedback("Agendamento remarcado para o próximo dia.");
        await appointmentsQuery.refetch();
      } catch {
        setActionFeedbackTone("error");
        setActionFeedback("Falha ao remarcar agendamento.");
      }
    }
  };

  const headerCta = (() => {
    if (activeTab === "confirmed") return { label: "Converter em O.S.", onClick: () => navigate("/service-orders") };
    if (activeTab === "pending") return { label: "Confirmar / contatar", onClick: () => navigate("/whatsapp") };
    if (activeTab === "conflicts") return { label: "Reorganizar agenda", onClick: () => setWindowFilter("overdue") };
    if (activeTab === "history") return { label: "Voltar para agenda", onClick: () => setActiveTab("agenda") };
    return { label: "Novo agendamento", onClick: () => setOpenCreate(true) };
  })();

  const selectedCustomerName =
    customerFilter === "all"
      ? ""
      : String(customers.find(item => String(item?.id ?? "") === customerFilter)?.name ?? "Cliente");

  return (
    <PageWrapper title="Agenda operacional" subtitle="Confirme, execute e avance para O.S. sem sair da agenda.">
      <div className="space-y-4">
        <AppPageHeader
          title={
            activeTab === "confirmed"
              ? "Agendamentos confirmados"
              : activeTab === "pending"
                ? "Pendências de confirmação"
                : activeTab === "conflicts"
                  ? "Conflitos de agenda"
                  : activeTab === "history"
                    ? "Histórico de agendamentos"
                    : "Agenda operacional de agendamentos"
          }
          description={
            activeTab === "confirmed"
              ? "Foco em confirmados para converter em execução/O.S."
              : activeTab === "pending"
                ? "Fila acionável para confirmação e contato por cliente."
                : activeTab === "conflicts"
                  ? "Choques de agenda, atrasos e risco operacional."
                  : activeTab === "history"
                    ? "Concluídos, cancelados e eventos passados para leitura histórica."
                    : "Visual do turno/dia para sequência operacional e prevenção de atraso."
          }
          cta={<ActionFeedbackButton state="idle" idleLabel={headerCta.label} onClick={headerCta.onClick} />}
        />

        <AppOperationalBar
          tabs={[
            { value: "agenda", label: "Agenda" },
            { value: "confirmed", label: "Confirmados" },
            { value: "pending", label: "Pendentes" },
            { value: "conflicts", label: "Conflitos" },
            { value: "history", label: "Histórico" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por cliente, título ou ID"
          quickFilters={
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "today", label: "Hoje" },
                { key: "next7", label: "Próx. 7 dias" },
                { key: "overdue", label: "Atrasados" },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  className={appSelectionPillClasses(windowFilter === item.key)}
                  onClick={() => setWindowFilter(item.key as WindowFilter)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
          advancedFiltersLabel="Filtros"
          advancedFiltersContent={
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Janela</label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={windowFilter}
                  onChange={event => setWindowFilter(event.target.value as WindowFilter)}
                >
                  <option value="today">Hoje</option>
                  <option value="next7">Próximos 7 dias</option>
                  <option value="overdue">Atrasados</option>
                  <option value="all">Tudo</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value)}
                >
                  <option value="all">Todos os status</option>
                  <option value="SCHEDULED">Agendado</option>
                  <option value="CONFIRMED">Confirmado</option>
                  <option value="DONE">Concluído</option>
                  <option value="CANCELED">Cancelado</option>
                  <option value="NO_SHOW">Não compareceu</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cliente</label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={customerFilter}
                  onChange={event => setCustomerFilter(event.target.value)}
                >
                  <option value="all">Todos os clientes</option>
                  {customers.map(customer => (
                    <option key={String(customer.id)} value={String(customer.id)}>
                      {String(customer.name ?? "Cliente")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          }
          activeFilterChips={[
            ...(windowFilter === "all"
              ? [{ key: "window-all", label: "Janela: Tudo", onRemove: () => setWindowFilter("today") }]
              : []),
            ...(statusFilter !== "all"
              ? [{ key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("all") }]
              : []),
            ...(customerFilter !== "all"
              ? [{ key: "customer", label: `Cliente: ${selectedCustomerName}`, onRemove: () => setCustomerFilter("all") }]
              : []),
          ]}
          onClearAllFilters={() => {
            setWindowFilter("today");
            setStatusFilter("all");
            setCustomerFilter("all");
          }}
        />

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "agenda"
                ? "Visão diária da agenda"
                : activeTab === "confirmed"
                  ? "Confirmados prontos para execução"
                  : activeTab === "pending"
                    ? "Fila de confirmação pendente"
                    : activeTab === "conflicts"
                      ? "Conflitos e gargalos da agenda"
                      : "Histórico de agendamentos"
            }
            subtitle="Lista principal com filtros por estado, janela e cliente para ação rápida."
          >
            {showInitialLoading ? (
              <AppPageLoadingState description="Carregando agendamentos..." />
            ) : showErrorState ? (
              <AppPageErrorState
                description={appointmentsQuery.error?.message ?? "Falha ao carregar agendamentos."}
                actionLabel="Tentar novamente"
                onAction={() => void appointmentsQuery.refetch()}
              />
            ) : filteredAppointments.length === 0 ? (
              <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar agendamento" />
            ) : (
              <AppDataTable>
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="w-[18%] px-4 py-2.5 text-left align-middle">Início</th>
                      <th className="w-[24%] px-4 py-2.5 text-left align-middle">Cliente</th>
                      <th className="w-[18%] px-4 py-2.5 text-left align-middle">Status</th>
                      <th className="w-[12%] px-4 py-2.5 text-left align-middle">Prioridade</th>
                      <th className="w-[22%] px-4 py-2.5 text-left align-middle">Próxima ação</th>
                      <th className="w-[156px] px-4 py-2.5 text-right align-middle">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map(entry => {
                      const { item, hasConflict, isDelayed, operationalState, decision, signals } = entry;
                      const status = String(item?.status ?? "").toUpperCase();
                      const priorityLabel =
                        hasConflict || Number(item?.priority ?? 0) >= 3 || status === "SCHEDULED"
                          ? "HIGH"
                          : status === "CONFIRMED"
                            ? "MEDIUM"
                            : "LOW";

                      const primaryIntent = decision.intent;
                      const actionLabel = resolveOperationalActionLabel(decision.title);
                      const signalPreview = signals.find(signal => signal.key !== "healthy") ?? signals[0];

                      return (
                        <tr
                          key={String(item?.id)}
                          className={`cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 focus-within:bg-[var(--surface-subtle)]/70 ${
                            String(item?.id ?? "") === String(focusedAppointmentId ?? "") ? "bg-[var(--accent-soft)]/40" : ""
                          }`}
                          onClick={() => setFocusedAppointmentId(String(item?.id ?? ""))}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <p className="whitespace-nowrap text-sm font-semibold leading-5 text-[var(--text-primary)]">
                              {safeDate(item?.startsAt)?.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }) ?? "—"}
                            </p>
                            <p className="whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                              {safeDate(item?.startsAt)?.toLocaleDateString("pt-BR") ?? "—"}
                            </p>
                            <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getSignalToneClasses(signalPreview.tone)}`}>
                              {signalPreview.label}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="truncate text-sm font-medium leading-5 text-[var(--text-primary)]">
                              {String(item?.customer?.name ?? "Cliente")}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">#{String(item?.customerId ?? "—")}</p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <AppStatusBadge label={operationalState} />
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <AppPriorityBadge label={priorityLabel} />
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className={OPERATIONAL_NEXT_ACTION_CLASS} title={decision.title}>
                              {toSingleLineAction(decision.title)}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-center justify-end gap-2">
                              <SecondaryButton
                                type="button"
                                className={OPERATIONAL_PRIMARY_CTA_CLASS}
                                onClick={event => {
                                  event.stopPropagation();
                                  void runInlineAction(primaryIntent);
                                }}
                                disabled={updateAppointment.isPending || primaryIntent === "none"}
                              >
                                {actionLabel}
                              </SecondaryButton>
                              <AppRowActionsDropdown
                                triggerLabel="Mais ações"
                                contentClassName="min-w-[232px]"
                                items={[
                                  ...(primaryIntent !== "service_order"
                                    ? [
                                        {
                                          label: "Criar O.S.",
                                          onSelect: () =>
                                            navigate(`/service-orders?customerId=${item.customerId}&appointmentId=${item.id}`),
                                        },
                                      ]
                                    : []),
                                  ...(primaryIntent !== "communication"
                                    ? [
                                        {
                                          label: "Enviar WhatsApp",
                                          onSelect: () => navigate(`/whatsapp?customerId=${item.customerId}`),
                                        },
                                      ]
                                    : []),
                                  ...(primaryIntent !== "confirm"
                                    ? [
                                        {
                                          label: "Confirmar agendamento",
                                          onSelect: () => {
                                            setFocusedAppointmentId(String(item?.id ?? ""));
                                            void executeStatusUpdate("CONFIRMED");
                                          },
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </AppDataTable>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Workspace operacional do agendamento"
            subtitle="Contexto contínuo para decidir, comunicar e avançar para execução sem romper o fluxo da lista."
            compact
          >
            {focused ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {String(focused.item?.title ?? focused.item?.customer?.name ?? "Agendamento")}
                    </h3>
                    <AppStatusBadge label={focused.operationalState} />
                    <AppPriorityBadge
                      label={Number(focused.item?.priority ?? 0) >= 3 || focused.hasConflict ? "HIGH" : "MEDIUM"}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {safeDate(focused.item?.startsAt)?.toLocaleString("pt-BR") ?? "Horário não informado"} · Cliente {String(
                      focused.item?.customer?.name ?? "não identificado"
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {focused.signals.slice(0, 5).map(signal => (
                      <span
                        key={signal.key}
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getSignalToneClasses(signal.tone)}`}
                      >
                        {signal.label}
                      </span>
                    ))}
                  </div>
                </div>

                <OperationalNextAction
                  title={focused.decision.title}
                  reason={focused.decision.reason}
                  urgency={focused.decision.urgency}
                  impact={focused.decision.impact}
                />

                <div className="flex flex-wrap gap-2">
                  <SecondaryButton
                    type="button"
                    className={OPERATIONAL_PRIMARY_CTA_CLASS}
                    onClick={() => void runInlineAction(focused.decision.intent)}
                    disabled={updateAppointment.isPending || focused.decision.intent === "none"}
                  >
                    {focused.decision.healthy ? "Fluxo saudável" : resolveOperationalActionLabel(focused.decision.title)}
                  </SecondaryButton>
                  {focused.decision.secondary.slice(0, 2).map(intent => (
                    <SecondaryButton key={intent} type="button" onClick={() => void runInlineAction(intent)}>
                      {intent === "communication"
                        ? "Enviar mensagem"
                        : intent === "reschedule"
                          ? "Remarcar +1 dia"
                          : intent === "status"
                            ? "Marcar concluído"
                            : "Abrir O.S."}
                    </SecondaryButton>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <section className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Contexto da agenda</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                      {focused.hasConflict
                        ? "Conflito detectado no mesmo slot. Recomenda-se ajuste imediato."
                        : focused.startsSoon
                          ? "Janela próxima, ideal manter confirmação e comunicação ativa."
                          : focused.isDelayed
                            ? "Atendimento já passou da hora e exige atualização de status."
                            : "Agenda está estável para este item."}
                    </p>
                  </section>
                  <section className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Contexto do cliente</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                      Cliente #{String(focused.item?.customerId ?? "—")} · {String(focused.item?.customer?.name ?? "Não identificado")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SecondaryButton type="button" onClick={() => navigate(`/customers?id=${focused.item?.customerId ?? ""}`)}>
                        Abrir cliente
                      </SecondaryButton>
                      <SecondaryButton type="button" onClick={() => navigate(`/whatsapp?customerId=${focused.item?.customerId}`)}>
                        WhatsApp contextual
                      </SecondaryButton>
                    </div>
                  </section>
                  <section className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Execução / preparação</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                      {focused.hasServiceOrder
                        ? `O.S. #${String(focused.serviceOrder?.id)} em ${String(focused.serviceOrder?.status ?? "andamento")}.`
                        : "Sem O.S. vinculada. Confirmados devem evoluir para execução."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {focused.hasServiceOrder ? (
                        <SecondaryButton type="button" onClick={() => navigate(`/service-orders?id=${focused.serviceOrder?.id}`)}>
                          Abrir O.S.
                        </SecondaryButton>
                      ) : (
                        <SecondaryButton type="button" onClick={() => setOpenServiceOrderCreate(true)}>
                          Iniciar O.S.
                        </SecondaryButton>
                      )}
                      <SecondaryButton type="button" onClick={() => void executeStatusUpdate("DONE")}>
                        Atualizar status
                      </SecondaryButton>
                    </div>
                  </section>
                  <section className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Comunicação</p>
                    <p className="mt-1 text-sm text-[var(--text-primary)]">
                      {focused.requiresCommunication
                        ? "Há comunicação pendente para confirmação ou lembrete do atendimento."
                        : "Sem pendência crítica de comunicação no momento."}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Sugestão: {focused.isDelayed ? "avisar atraso/reagendamento" : "confirmar horário e orientações de chegada"}.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <SecondaryButton type="button" onClick={() => navigate(`/whatsapp?customerId=${focused.item?.customerId}`)}>
                        Enviar mensagem
                      </SecondaryButton>
                    </div>
                  </section>
                </div>

                <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Timeline curta</p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--text-secondary)]">
                    {timelineFallback.length > 0 ? (
                      timelineFallback.slice(0, 6).map(event => (
                        <li key={event.id}>
                          {safeDate(event.at)?.toLocaleString("pt-BR") ?? "—"} · {event.text}
                        </li>
                      ))
                    ) : (
                      <li>Sem eventos disponíveis. Use o status atual como referência operacional.</li>
                    )}
                  </ul>
                </section>

                <OperationalRelationSummary
                  title="Relações operacionais"
                  items={[
                    `Cliente ${String(focused.item?.customer?.name ?? "não identificado")} vinculado ao agendamento #${String(focused.item?.id ?? "—")}.`,
                    focused.hasServiceOrder
                      ? `Agendamento já conectado à O.S. #${String(focused.serviceOrder?.id ?? "—")}.`
                      : "Agendamento sem O.S. vinculada no momento.",
                    focused.requiresCommunication
                      ? "Comunicação com cliente é parte da próxima ação recomendada."
                      : "Comunicação em estado estável para este atendimento.",
                  ]}
                />

                {actionFeedback ? (
                  <OperationalInlineFeedback
                    tone={actionFeedbackTone}
                    nextStep={
                      actionFeedbackTone === "success"
                        ? "Revise o próximo item da fila para manter o ritmo operacional."
                        : undefined
                    }
                  >
                    {actionFeedback}
                  </OperationalInlineFeedback>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Selecione um agendamento para abrir o workspace operacional.</p>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <AppStatusBadge label={`${conflictCount} com conflito`} />
              <AppStatusBadge label={`${delayedCount} atrasado(s)`} />
              <AppStatusBadge label={`${filteredAppointments.length} na fila`} />
            </div>
          </AppSectionBlock>
        </div>
      </div>

      <CreateAppointmentModal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void appointmentsQuery.refetch();
        }}
        customers={customers.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Cliente"),
        }))}
      />
      <CreateServiceOrderModal
        open={openServiceOrderCreate}
        onClose={() => setOpenServiceOrderCreate(false)}
        onSuccess={() => {
          setActionFeedbackTone("success");
          setActionFeedback("O.S. criada com vínculo ao agendamento.");
        }}
        customers={customers.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Cliente"),
        }))}
        people={people.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Pessoa"),
        }))}
        initialCustomerId={focused?.item?.customerId ? String(focused.item.customerId) : null}
        appointmentId={focused?.item?.id ? String(focused.item.id) : null}
      />
    </PageWrapper>
  );
}
