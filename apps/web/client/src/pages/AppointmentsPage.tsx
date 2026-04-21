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
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { inRange, safeDate } from "@/lib/operational/kpi";
import {
  buildCompactOperationalTimeline,
  getOperationalSignalToneClasses,
  type OperationalNextActionDecision,
  type OperationalSignal,
} from "@/lib/operations/operational-workspace";
import { toast } from "sonner";

type TabKey = "agenda" | "confirmed" | "pending" | "conflicts" | "history";
type WindowFilter = "all" | "today" | "tomorrow" | "week" | "overdue";
type ViewMode = "operational_list" | "calendar_macro" | "timeline_day";

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

type NextActionIntent =
  | "confirm"
  | "status"
  | "service_order"
  | "communication"
  | "reschedule"
  | "none";

type NextActionDecision = OperationalNextActionDecision<NextActionIntent>;

function formatDuration(start: Date | null, end: Date | null) {
  if (!start || !end || end.getTime() <= start.getTime()) return "—";
  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}min`;
}

function mapOperationalState(item: AppointmentLike, hasConflict: boolean) {
  const severity = getAppointmentSeverity(item);
  const status = String(item?.status ?? "").toUpperCase();

  if (status === "DONE") return "Concluído";
  if (status === "CANCELED") return "Cancelado";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "NO_SHOW") return "Não compareceu";
  if (status === "CONFIRMED") return hasConflict ? "Em risco" : "Confirmado";
  if (hasConflict || severity === "critical") return "Em risco";
  return status === "SCHEDULED" ? "Pendente" : getOperationalSeverityLabel(severity);
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
  const [viewMode, setViewMode] = useOperationalMemoryState<ViewMode>(
    "nexo.appointments.view-mode.v1",
    "operational_list"
  );
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.appointments.customer-filter.v1",
    "all"
  );
  const [ownerFilter, setOwnerFilter] = useOperationalMemoryState("nexo.appointments.owner-filter.v1", "all");
  const [serviceFilter, setServiceFilter] = useOperationalMemoryState("nexo.appointments.service-filter.v1", "all");
  const [onlyConflict, setOnlyConflict] = useOperationalMemoryState("nexo.appointments.conflict-filter.v1", false);
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useOperationalMemoryState("nexo.appointments.unconfirmed-filter.v1", false);
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
  const tomorrowStart = new Date(dayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = new Date(dayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const weekEnd = new Date(dayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);

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
      const ownerName =
        people.find(person => String(person?.id ?? "") === String(item?.assignedToPersonId ?? item?.personId ?? ""))?.name ??
        "Equipe não definida";
      const serviceName = String(item?.title ?? "Atendimento geral");
      const durationLabel = formatDuration(start, safeDate(item?.endsAt));

      const signals: OperationalSignal[] = [];
      if (startsSoon) signals.push({ key: "starts_soon", label: "Agendamento próximo", tone: "warning" });
      if (isDelayed) signals.push({ key: "delayed", label: "Atrasado sem avanço", tone: "critical" });
      if (status === "SCHEDULED") signals.push({ key: "not_confirmed", label: "Não confirmado", tone: "warning" });
      if (requiresCommunication) signals.push({ key: "pending_contact", label: "Comunicação pendente", tone: "info" });
      if (!item?.customerId) signals.push({ key: "customer_dependency", label: "Dependente de cliente", tone: "warning" });
      if (status === "CONFIRMED" && !hasServiceOrder) {
        signals.push({ key: "service_order_dependency", label: "Dependente de O.S.", tone: "info" });
      }
      if (status === "CANCELED") signals.push({ key: "canceled", label: "Cancelado", tone: "critical" });
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
        ownerName: String(ownerName),
        serviceName,
        durationLabel,
        operationalState,
        nextAction: decision.title,
        decision,
        signals,
      };
    });
  }, [appointments, appointmentsBySlot, now, people, serviceOrders]);

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
    } else if (windowFilter === "tomorrow") {
      base = base.filter(({ item }) => inRange(safeDate(item?.startsAt), tomorrowStart, tomorrowEnd));
    } else if (windowFilter === "week") {
      base = base.filter(({ item }) => inRange(safeDate(item?.startsAt), dayStart, weekEnd));
    } else if (windowFilter === "overdue") {
      base = base.filter(({ isDelayed }) => isDelayed);
    }

    if (customerFilter !== "all") {
      base = base.filter(({ item }) => String(item?.customerId ?? "") === customerFilter);
    }

    if (ownerFilter !== "all") {
      base = base.filter(({ item }) => String(item?.assignedToPersonId ?? item?.personId ?? "") === ownerFilter);
    }

    if (serviceFilter !== "all") {
      base = base.filter(({ serviceName }) => serviceName === serviceFilter);
    }

    if (onlyConflict) {
      base = base.filter(({ hasConflict }) => hasConflict);
    }

    if (onlyUnconfirmed) {
      base = base.filter(({ item }) => String(item?.status ?? "").toUpperCase() === "SCHEDULED");
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
  }, [
    activeTab,
    appointmentWithContext,
    customerFilter,
    dayEnd,
    dayStart,
    onlyConflict,
    onlyUnconfirmed,
    ownerFilter,
    searchTerm,
    serviceFilter,
    statusFilter,
    tomorrowEnd,
    tomorrowStart,
    weekEnd,
    windowFilter,
  ]);

  const delayedCount = filteredAppointments.filter(({ isDelayed }) => isDelayed).length;
  const conflictCount = filteredAppointments.filter(({ hasConflict }) => hasConflict).length;
  const unconfirmedCount = filteredAppointments.filter(
    ({ item }) => String(item?.status ?? "").toUpperCase() === "SCHEDULED"
  ).length;
  const todayCount = appointmentWithContext.filter(({ item }) => inRange(safeDate(item?.startsAt), dayStart, dayEnd)).length;
  const weekCount = appointmentWithContext.filter(({ item }) => inRange(safeDate(item?.startsAt), dayStart, weekEnd)).length;
  const responseRiskCount = filteredAppointments.filter(({ requiresCommunication }) => requiresCommunication).length;
  const criticalWindowEmpty = todayCount === 0;
  const overloadCount = appointmentWithContext.filter(
    ({ item }) => inRange(safeDate(item?.startsAt), dayStart, dayEnd)
  ).length > 12;
  const agendaHealth: "Saudável" | "Atenção" | "Crítica" | "Vazia" =
    criticalWindowEmpty
      ? "Vazia"
      : delayedCount > 0 || conflictCount > 0
        ? "Crítica"
        : unconfirmedCount > 0 || overloadCount
          ? "Atenção"
          : "Saudável";

  const availableSlots = Math.max(0, 10 - todayCount);
  const alertItems = [
    {
      key: "unconfirmed",
      title: "Agendamentos sem confirmação",
      detail: `${unconfirmedCount} pendente(s) de confirmação.`,
      severity: unconfirmedCount > 3 ? "critical" : unconfirmedCount > 0 ? "warning" : "healthy",
      action: () => {
        setOnlyUnconfirmed(true);
        setActiveTab("pending");
      },
      actionLabel: "Confirmar agora",
    },
    {
      key: "conflicts",
      title: "Conflitos de horário",
      detail: `${conflictCount} choque(s) de slot detectado(s).`,
      severity: conflictCount > 0 ? "critical" : "healthy",
      action: () => {
        setOnlyConflict(true);
        setActiveTab("conflicts");
      },
      actionLabel: "Resolver conflito",
    },
    {
      key: "delays",
      title: "Atrasos operacionais",
      detail: `${delayedCount} atendimento(s) com horário estourado.`,
      severity: delayedCount > 0 ? "critical" : "healthy",
      action: () => setWindowFilter("overdue"),
      actionLabel: "Atualizar status",
    },
    {
      key: "no_response",
      title: "Clientes sem resposta",
      detail: `${responseRiskCount} item(ns) com comunicação pendente.`,
      severity: responseRiskCount > 4 ? "warning" : "healthy",
      action: () => navigate("/whatsapp"),
      actionLabel: "Abrir WhatsApp",
    },
    {
      key: "critical_window",
      title: "Janela crítica vazia",
      detail: criticalWindowEmpty ? "Sem agenda para hoje no período operacional." : "Cobertura mínima do dia ativa.",
      severity: criticalWindowEmpty ? "warning" : "healthy",
      action: () => setOpenCreate(true),
      actionLabel: "Criar agendamento",
    },
  ];

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

  const compactTimeline = useMemo(
    () =>
      buildCompactOperationalTimeline({
        events: timelineFallback,
        mapEvent: event => ({
          id: String(event.id),
          occurredAt: event.at,
          label: "Evento",
          summary: String(event.text),
        }),
        maxItems: 6,
      }),
    [timelineFallback]
  );

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
          title="Agendamentos · controle do tempo operacional"
          description={`Hoje: ${todayCount} compromissos · Semana: ${weekCount} · Saúde da agenda: ${agendaHealth}. O foco aqui é decidir rápido o que acontece agora, com quem e o que preparar.`}
          cta={<ActionFeedbackButton state="idle" idleLabel={headerCta.label} onClick={headerCta.onClick} />}
        />

        <OperationalTopCard
          contextLabel="Entrada da execução"
          title="Cliente, agenda, O.S., comunicação e timeline em uma única decisão operacional."
          description="Use a lista para puxar ação imediata, o workspace para decidir e os alertas para prevenir gargalo."
        />

        <AppSectionBlock
          title="Alertas operacionais da agenda"
          subtitle="Leitura objetiva de risco com ação direta sem sair da tela."
          compact
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {alertItems.map(alert => (
              <button
                key={alert.key}
                type="button"
                onClick={alert.action}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-left transition hover:border-[var(--border-strong)]"
              >
                <p
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getOperationalSignalToneClasses(
                    alert.severity as OperationalSignal["tone"],
                    "soft"
                  )}`}
                >
                  {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Saudável"}
                </p>
                <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{alert.title}</p>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{alert.detail}</p>
                <p className="mt-2 text-[11px] font-medium text-[var(--text-primary)]">{alert.actionLabel} →</p>
              </button>
            ))}
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Modos de visualização" subtitle="Lista operacional é padrão. Calendário e timeline apoiam leitura macro." compact>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "operational_list", label: "Lista operacional" },
              { value: "calendar_macro", label: "Calendário macro" },
              { value: "timeline_day", label: "Timeline do dia" },
            ].map(mode => (
              <button
                key={mode.value}
                type="button"
                className={appSelectionPillClasses(viewMode === mode.value)}
                onClick={() => setViewMode(mode.value as ViewMode)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </AppSectionBlock>

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
                { key: "tomorrow", label: "Amanhã" },
                { key: "week", label: "Semana" },
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
                  <option value="tomorrow">Amanhã</option>
                  <option value="week">Semana</option>
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
                  <option value="IN_PROGRESS">Em andamento</option>
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Responsável</label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={ownerFilter}
                  onChange={event => setOwnerFilter(event.target.value)}
                >
                  <option value="all">Todos responsáveis</option>
                  {people.map(person => (
                    <option key={String(person.id)} value={String(person.id)}>
                      {String(person.name ?? "Responsável")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Serviço</label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={serviceFilter}
                  onChange={event => setServiceFilter(event.target.value)}
                >
                  <option value="all">Todos os serviços</option>
                  {Array.from(new Set(appointmentWithContext.map(entry => entry.serviceName))).map(service => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input type="checkbox" checked={onlyConflict} onChange={event => setOnlyConflict(event.target.checked)} />
                Apenas com conflito
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={onlyUnconfirmed}
                  onChange={event => setOnlyUnconfirmed(event.target.checked)}
                />
                Apenas não confirmados
              </label>
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
            ...(ownerFilter !== "all" ? [{ key: "owner", label: "Responsável filtrado", onRemove: () => setOwnerFilter("all") }] : []),
            ...(serviceFilter !== "all"
              ? [{ key: "service", label: `Serviço: ${serviceFilter}`, onRemove: () => setServiceFilter("all") }]
              : []),
            ...(onlyConflict ? [{ key: "conflict", label: "Somente conflitos", onRemove: () => setOnlyConflict(false) }] : []),
            ...(onlyUnconfirmed
              ? [{ key: "unconfirmed", label: "Somente não confirmados", onRemove: () => setOnlyUnconfirmed(false) }]
              : []),
          ]}
          onClearAllFilters={() => {
            setWindowFilter("today");
            setStatusFilter("all");
            setCustomerFilter("all");
            setOwnerFilter("all");
            setServiceFilter("all");
            setOnlyConflict(false);
            setOnlyUnconfirmed(false);
          }}
        />

        <div className="space-y-4">
          <AppSectionBlock
            title="Leitura de carga e tempo operacional"
            subtitle="Sem BI pesado: visão direta de volume, horários livres e risco de atraso."
            compact
          >
            <div className="grid gap-2 md:grid-cols-5">
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Carga do dia</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{todayCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Horários livres</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{availableSlots}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Conflitos</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{conflictCount}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Concentração excessiva</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{overloadCount ? "Sim" : "Não"}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-muted)]">Risco de atraso</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{delayedCount > 0 ? "Alto" : "Baixo"}</p>
              </div>
            </div>
          </AppSectionBlock>

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
            ) : viewMode === "calendar_macro" ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">
                  Calendário como leitura macro. Para produtividade, mantenha a lista operacional como modo padrão.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {filteredAppointments.slice(0, 8).map(({ item, serviceName, ownerName, isDelayed }) => (
                    <button
                      key={String(item?.id)}
                      type="button"
                      className="rounded-lg border border-[var(--border-subtle)] p-3 text-left hover:border-[var(--border-strong)]"
                      onClick={() => setFocusedAppointmentId(String(item?.id ?? ""))}
                    >
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {safeDate(item?.startsAt)?.toLocaleString("pt-BR") ?? "Sem horário"}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">{String(item?.customer?.name ?? "Cliente")}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{serviceName} · {ownerName}</p>
                      <p className={`mt-1 text-[11px] ${isDelayed ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        {isDelayed ? "Em atraso" : "Dentro da janela"}
                      </p>
                    </button>
                  ))}
                </div>
                <SecondaryButton type="button" onClick={() => navigate("/calendar")}>
                  Abrir visão completa de calendário
                </SecondaryButton>
              </div>
            ) : viewMode === "timeline_day" ? (
              <div className="space-y-2">
                {filteredAppointments
                  .slice()
                  .sort((a, b) => (safeDate(a.item?.startsAt)?.getTime() ?? 0) - (safeDate(b.item?.startsAt)?.getTime() ?? 0))
                  .slice(0, 12)
                  .map(({ item, operationalState, decision }) => (
                    <button
                      key={String(item?.id)}
                      type="button"
                      className="w-full rounded-lg border border-[var(--border-subtle)] p-3 text-left hover:border-[var(--border-strong)]"
                      onClick={() => setFocusedAppointmentId(String(item?.id ?? ""))}
                    >
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {safeDate(item?.startsAt)?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—"} ·{" "}
                        {String(item?.customer?.name ?? "Cliente")}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {operationalState} · Próxima melhor ação: {decision.title}
                      </p>
                    </button>
                  ))}
              </div>
            ) : (
              <AppDataTable>
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="w-[13%] px-4 py-2.5 text-left align-middle">Horário</th>
                      <th className="w-[18%] px-4 py-2.5 text-left align-middle">Cliente</th>
                      <th className="w-[16%] px-4 py-2.5 text-left align-middle">Serviço / tipo</th>
                      <th className="w-[11%] px-4 py-2.5 text-left align-middle">Status</th>
                      <th className="w-[12%] px-4 py-2.5 text-left align-middle">Responsável</th>
                      <th className="w-[10%] px-4 py-2.5 text-left align-middle">Duração</th>
                      <th className="w-[20%] px-4 py-2.5 text-left align-middle">Observação e risco</th>
                      <th className="w-[156px] px-4 py-2.5 text-right align-middle">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map(entry => {
                      const { item, hasConflict, isDelayed, operationalState, decision, signals, ownerName, serviceName, durationLabel } = entry;
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
                          <td className="px-4 py-3 align-top">
                            <p className="whitespace-nowrap text-sm font-semibold leading-5 text-[var(--text-primary)]">
                              {safeDate(item?.startsAt)?.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }) ?? "—"}
                            </p>
                            <p className="whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                              {safeDate(item?.startsAt)?.toLocaleDateString("pt-BR") ?? "—"}
                            </p>
                            <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getOperationalSignalToneClasses(signalPreview.tone, "soft")}`}>
                              {signalPreview.label}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="truncate text-sm font-medium leading-5 text-[var(--text-primary)]">
                              {String(item?.customer?.name ?? "Cliente")}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">#{String(item?.customerId ?? "—")}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="truncate text-xs font-medium text-[var(--text-primary)]">{serviceName}</p>
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{toSingleLineAction(decision.title)}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <AppStatusBadge label={operationalState} />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="text-xs text-[var(--text-primary)]">{ownerName}</p>
                            <AppPriorityBadge label={priorityLabel} />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="text-xs text-[var(--text-primary)]">{durationLabel}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                              {String(item?.notes ?? "Sem observação operacional.")}
                            </p>
                            <p className={`mt-1 text-[11px] ${isDelayed ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                              {signalPreview.label}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top">
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
                                  {
                                    label: "Iniciar atendimento",
                                    onSelect: () => {
                                      setFocusedAppointmentId(String(item?.id ?? ""));
                                      void executeStatusUpdate("DONE");
                                    },
                                  },
                                  ...(primaryIntent !== "service_order"
                                    ? [
                                        {
                                          label: "Abrir O.S.",
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
                                  {
                                    label: "Remarcar +1 dia",
                                    onSelect: () => {
                                      setFocusedAppointmentId(String(item?.id ?? ""));
                                      void runInlineAction("reschedule");
                                    },
                                  },
                                  {
                                    label: "Cancelar agendamento",
                                    onSelect: () => {
                                      setFocusedAppointmentId(String(item?.id ?? ""));
                                      void executeStatusUpdate("CANCELED");
                                    },
                                  },
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
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${getOperationalSignalToneClasses(signal.tone, "soft")}`}
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
                    {compactTimeline.length > 0 ? (
                      compactTimeline.map(event => (
                        <li key={event.id}>
                          {safeDate(event.occurredAt)?.toLocaleString("pt-BR") ?? "—"} · {event.summary}
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
