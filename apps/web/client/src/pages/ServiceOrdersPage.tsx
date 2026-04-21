import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";
import type { ServiceOrder } from "@/components/service-orders/service-order.types";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppOperationalModal } from "@/components/operating-system/AppOperationalModal";
import { WorkspaceScaffold } from "@/components/operating-system/WorkspaceScaffold";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  EmptyActionState,
  explainOperationalError,
  OperationalAutomationNote,
  OperationalFlowState,
  OperationalInlineFeedback,
  OperationalNextAction,
  OperationalRelationSummary,
} from "@/components/operating-system/OperationalRefinementBlocks";
import {
  AppOperationalBar,
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPriorityBadge,
  appSelectionPillClasses,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { AppPageShell, AppSectionCard, AppTimeline, AppTimelineItem, AppToolbar } from "@/components/app-system";
import { Button, SecondaryButton } from "@/components/design-system";
import { getDayWindow, inRange, safeDate } from "@/lib/operational/kpi";
import {
  OPERATIONAL_NEXT_ACTION_CLASS,
  OPERATIONAL_PRIMARY_CTA_CLASS,
  resolveOperationalActionLabel,
  toSingleLineAction,
} from "@/lib/operations/operational-list";
import {
  type OperationalSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import {
  buildCompactOperationalTimeline,
  getOperationalSignalToneClasses,
  type OperationalSignal,
} from "@/lib/operations/operational-workspace";
import { toast } from "sonner";

type ServiceOrderTab =
  | "pipeline"
  | "execution"
  | "attention"
  | "done"
  | "history";
type WindowFilter = "all" | "today" | "next7" | "overdue";
type PriorityFilter = "all" | "high" | "medium" | "low";
type StatusFilter = "all" | "created" | "in_progress" | "done" | "canceled";
type BillingFilter = "all" | "pending" | "generated";
type DelayFilter = "all" | "overdue";
const SERVICE_ORDERS_PER_PAGE = 8;

type ServiceOrderActionIntent =
  | "start"
  | "progress"
  | "complete"
  | "charge"
  | "finance"
  | "whatsapp"
  | "modal";

type ServiceOrderSecondaryIntent = "finance" | "whatsapp" | "appointment";

type ServiceOrderNextAction = {
  title: string;
  reason: string;
  ctaLabel: string;
  ctaIntent: ServiceOrderActionIntent;
  secondary: Array<{ label: string; intent: ServiceOrderSecondaryIntent }>;
};

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getStatusLabel(status: string) {
  if (status === "OPEN") return "Criada";
  if (status === "ASSIGNED") return "Atribuída";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "DONE") return "Concluída";
  if (status === "WAITING_CUSTOMER") return "Aguardando cliente";
  if (status === "BLOCKED") return "Bloqueada";
  if (status === "ON_HOLD") return "Em espera";
  if (status === "PAUSED") return "Pausada";
  if (status === "CANCELED") return "Cancelada";
  return status || "Sem status";
}

function getStatusVisual(status: string, isOverdue: boolean, riskState: string) {
  if (isOverdue) return { label: "Atrasada", tone: "danger" as const };
  if (riskState === "Crítico") return { label: "Em risco", tone: "warning" as const };
  if (status === "IN_PROGRESS") return { label: "Em execução", tone: "info" as const };
  if (status === "OPEN" || status === "ASSIGNED") return { label: "Criada", tone: "neutral" as const };
  if (status === "DONE") return { label: "Concluída", tone: "success" as const };
  if (status === "CANCELED") return { label: "Cancelada", tone: "danger" as const };
  return { label: getStatusLabel(status), tone: "accent" as const };
}

function getPriorityLabel(priority: number) {
  if (priority >= 4) return "HIGH" as const;
  if (priority === 3) return "MEDIUM" as const;
  return "LOW" as const;
}

function getNextAction(order: any) {
  const status = normalizeStatus(order?.status);
  const hasCharge = Boolean(order?.financialSummary?.hasCharge);
  const overdueDays = (() => {
    const scheduled = safeDate(order?.scheduledFor);
    if (!scheduled) return 0;
    const now = Date.now();
    if (scheduled.getTime() >= now) return 0;
    return Math.max(1, Math.floor((now - scheduled.getTime()) / (1000 * 60 * 60 * 24)));
  })();

  if (["BLOCKED", "ON_HOLD", "PAUSED"].includes(status)) {
    return "Destravar O.S.";
  }
  if (status === "WAITING_CUSTOMER") return "Cobrar retorno";
  if (["OPEN", "ASSIGNED"].includes(status) && !order?.assignedToPersonId) {
    return "Atribuir técnico";
  }
  if (["OPEN", "ASSIGNED"].includes(status))
    return overdueDays > 0
      ? "Iniciar hoje"
      : "Iniciar execução";
  if (status === "IN_PROGRESS") return "Acompanhar execução";
  if (status === "DONE" && !hasCharge) return "Cobrar agora";
  if (status === "DONE" && hasCharge) return "Notificar cliente";
  return "Abrir detalhe";
}

function getPrimaryActionLabel(order: any, nextAction: string) {
  const status = normalizeStatus(order?.status);
  if (nextAction.toLowerCase().includes("cobrar")) return "Cobrar";
  if (nextAction.toLowerCase().includes("iniciar")) return "Iniciar";
  if (nextAction.toLowerCase().includes("confirmar")) return "Confirmar";
  if (nextAction.toLowerCase().includes("notificar")) return "Notificar";
  if (status === "DONE" && !order?.financialSummary?.hasCharge) return "Cobrar";
  if (["OPEN", "ASSIGNED"].includes(status)) return "Iniciar";
  if (status === "WAITING_CUSTOMER") return "Notificar";
  return "Abrir";
}

function getPaginationSlots(totalPages: number, currentPage: number) {
  const pages = new Set<number>([1, totalPages, currentPage]);
  [currentPage - 1, currentPage + 1, currentPage - 2, currentPage + 2].forEach(
    page => {
      if (page >= 1 && page <= totalPages) pages.add(page);
    }
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const slots: Array<number | "ellipsis"> = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      slots.push("ellipsis");
    }
    slots.push(page);
  });
  return slots;
}

function getPaginationButtonClass(active: boolean) {
  return active
    ? "min-w-8 rounded-md border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-2 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition-all"
    : "min-w-8 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)]";
}

function getOrderRowClass(active: boolean) {
  return active
    ? "cursor-pointer border-t border-[var(--border-subtle)] bg-[var(--accent-soft)]/45 transition-colors hover:bg-[var(--accent-soft)]/60 focus-within:bg-[var(--accent-soft)]/65"
    : "cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 focus-within:bg-[var(--surface-subtle)]/70";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatDateLabel(value: unknown, fallback = "Sem data definida") {
  const parsed = safeDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleString("pt-BR");
}

function formatTimelineEventLabel(event: any) {
  const action = String(event?.action ?? event?.type ?? "")
    .trim()
    .toUpperCase();
  if (action === "SERVICE_ORDER_CREATED") return "O.S. criada";
  if (action === "SERVICE_ORDER_UPDATED" || action === "SERVICE_ORDER_STATUS_CHANGED") {
    return "Status atualizado";
  }
  if (action === "EXECUTION_STARTED") return "Execução iniciada";
  if (action === "EXECUTION_COMPLETED" || action === "EXECUTION_DONE") {
    return "Execução concluída";
  }
  if (action === "CHARGE_CREATED") return "Cobrança gerada";
  if (action === "PAYMENT_RECEIVED" || action === "CHARGE_PAID") return "Pagamento recebido";
  if (action === "WHATSAPP_SENT" || action === "MESSAGE_SENT") return "Comunicação enviada";
  if (action === "APPOINTMENT_LINKED") return "Agendamento vinculado";
  if (action === "CUSTOMER_LINKED") return "Cliente vinculado";
  return String(event?.description ?? event?.action ?? event?.type ?? "Evento operacional");
}

function formatTimelineSummary(event: any) {
  const description = String(event?.description ?? "").trim();
  if (description) return description;
  const metadataStatus = String(event?.metadata?.status ?? "").trim();
  if (metadataStatus) return `Status ${metadataStatus}.`;
  if (event?.metadata?.amountCents) {
    return `Valor ${formatMoney(Number(event.metadata.amountCents))}.`;
  }
  return "Evento registrado na trilha operacional.";
}

function normalizeChargeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getOperationalSignals(order: any, timeline: any[]) {
  const status = normalizeStatus(order?.status);
  const chargeStatus = normalizeChargeStatus(order?.financialSummary?.chargeStatus);
  const scheduled = safeDate(order?.scheduledFor);
  const overdue =
    Boolean(scheduled && scheduled < new Date()) &&
    ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status);
  const blocked = ["BLOCKED", "ON_HOLD", "PAUSED"].includes(status);
  const noCharge = !order?.financialSummary?.hasCharge;
  const doneWithoutFinancial = status === "DONE" && noCharge;
  const communicationPending =
    status === "WAITING_CUSTOMER" ||
    (status === "DONE" &&
      chargeStatus === "PENDING" &&
      !timeline.some(event =>
        String(event?.action ?? event?.type ?? "")
          .toUpperCase()
          .includes("WHATSAPP")
      ));
  const dependentAppointment =
    !order?.appointmentId && ["OPEN", "ASSIGNED"].includes(status);
  const priorityHigh = Number(order?.priority ?? 0) >= 4;

  const signals: OperationalSignal[] = [];
  if (overdue) signals.push({ key: "overdue", label: "O.S. atrasada", tone: "critical" });
  if (blocked) signals.push({ key: "blocked", label: "Bloqueio operacional", tone: "critical" });
  if (doneWithoutFinancial) {
    signals.push({
      key: "done_no_finance",
      label: "Concluída sem ação financeira",
      tone: "critical",
    });
  } else if (noCharge) {
    signals.push({ key: "no_charge", label: "Sem cobrança", tone: "warning" });
  }
  if (communicationPending) {
    signals.push({
      key: "communication_pending",
      label: "Comunicação pendente",
      tone: "warning",
    });
  }
  if (dependentAppointment) {
    signals.push({
      key: "appointment_dependency",
      label: "Dependente de agendamento",
      tone: "info",
    });
  }
  if (priorityHigh) {
    signals.push({ key: "priority_high", label: "Prioridade elevada", tone: "info" });
  }
  if (signals.length === 0) {
    signals.push({ key: "healthy", label: "Fluxo saudável", tone: "healthy" });
  }
  return signals;
}

function getOperationalRiskState(signals: OperationalSignal[]) {
  if (signals.some(signal => signal.tone === "critical")) return "Crítico";
  if (signals.some(signal => signal.tone === "warning")) return "Atenção";
  return "Saudável";
}

export default function ServiceOrdersPage() {
  const [location, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [activeTab, setActiveTab] = useOperationalMemoryState<ServiceOrderTab>(
    "nexo.service-orders.tab.v1",
    "pipeline"
  );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.service-orders.search.v1",
    ""
  );
  const [windowFilter, setWindowFilter] = useOperationalMemoryState<WindowFilter>(
    "nexo.service-orders.window-filter.v1",
    "all"
  );
  const [priorityFilter, setPriorityFilter] = useOperationalMemoryState<PriorityFilter>(
    "nexo.service-orders.priority-filter.v1",
    "all"
  );
  const [statusFilter, setStatusFilter] = useOperationalMemoryState<StatusFilter>(
    "nexo.service-orders.status-filter.v1",
    "all"
  );
  const [responsibleFilter, setResponsibleFilter] = useOperationalMemoryState(
    "nexo.service-orders.responsible-filter.v1",
    "all"
  );
  const [billingFilter, setBillingFilter] = useOperationalMemoryState<BillingFilter>(
    "nexo.service-orders.billing-filter.v1",
    "all"
  );
  const [delayFilter, setDelayFilter] = useOperationalMemoryState<DelayFilter>(
    "nexo.service-orders.delay-filter.v1",
    "all"
  );
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.service-orders.customer-filter.v1",
    "all"
  );
  const [focusedOrderId, setFocusedOrderId] = useOperationalMemoryState<
    string | null
  >("nexo.service-orders.active-id.v1", null);
  const [openOperationalModal, setOpenOperationalModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = useState<
    "neutral" | "success" | "error"
  >("neutral");
  const [currentPage, setCurrentPage] = useState(1);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { retry: false }
  );
  const focusedTimelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: String(focusedOrderId ?? ""), limit: 20 },
    { retry: false, enabled: Boolean(focusedOrderId) }
  );
  const focusedExecutionQuery = trpc.nexo.executions.listByServiceOrder.useQuery(
    { serviceOrderId: String(focusedOrderId ?? ""), limit: 10 },
    { retry: false, enabled: Boolean(focusedOrderId) }
  );
  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation();
  const generateCharge = trpc.nexo.serviceOrders.generateCharge.useMutation();

  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );
  const orders = useMemo(
    () => normalizeArrayPayload<any>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );
  const hasData = orders.length > 0;
  const showInitialLoading = serviceOrdersQuery.isLoading && !hasData;
  const showErrorState = serviceOrdersQuery.error && !hasData;

  usePageDiagnostics({
    page: "service-orders",
    isLoading: showInitialLoading,
    hasError: Boolean(showErrorState),
    isEmpty: !showInitialLoading && !showErrorState && orders.length === 0,
    dataCount: orders.length,
  });

  const now = new Date();
  const todayWindow = getDayWindow(0);
  const next7End = new Date(todayWindow.end);
  next7End.setDate(next7End.getDate() + 7);

  const statusParam = useMemo(() => {
    const queryString = location.split("?")[1] ?? "";
    return new URLSearchParams(queryString).get("status");
  }, [location]);

  useEffect(() => {
    if (statusParam === "blocked") {
      setActiveTab("attention");
    }
  }, [statusParam]);

  const filteredOrders = useMemo(() => {
    let base = orders;

    if (activeTab === "execution") {
      base = base.filter(
        item => normalizeStatus(item?.status) === "IN_PROGRESS"
      );
    } else if (activeTab === "attention") {
      base = base.filter(item =>
        ["BLOCKED", "ON_HOLD", "PAUSED", "WAITING_CUSTOMER"].includes(
          normalizeStatus(item?.status)
        )
      );
    } else if (activeTab === "done") {
      base = base.filter(item => normalizeStatus(item?.status) === "DONE");
    } else if (activeTab === "history") {
      base = [...base].sort(
        (a, b) =>
          (safeDate(b?.updatedAt)?.getTime() ?? 0) -
          (safeDate(a?.updatedAt)?.getTime() ?? 0)
      );
    }

    if (windowFilter === "today") {
      base = base.filter(item =>
        inRange(
          safeDate(item?.scheduledFor ?? item?.createdAt),
          todayWindow.start,
          todayWindow.end
        )
      );
    } else if (windowFilter === "next7") {
      base = base.filter(item =>
        inRange(
          safeDate(item?.scheduledFor ?? item?.createdAt),
          todayWindow.start,
          next7End
        )
      );
    } else if (windowFilter === "overdue") {
      base = base.filter(item => {
        const status = normalizeStatus(item?.status);
        const scheduled = safeDate(item?.scheduledFor);
        return (
          Boolean(scheduled && scheduled < now) &&
          ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status)
        );
      });
    }

    if (priorityFilter !== "all") {
      base = base.filter(item => {
        const tier = getPriorityLabel(Number(item?.priority ?? 2));
        return tier.toLowerCase() === priorityFilter;
      });
    }
    if (statusFilter !== "all") {
      base = base.filter(item => {
        const status = normalizeStatus(item?.status);
        if (statusFilter === "created") return ["OPEN", "ASSIGNED"].includes(status);
        if (statusFilter === "in_progress") return status === "IN_PROGRESS";
        if (statusFilter === "done") return status === "DONE";
        return status === "CANCELED";
      });
    }
    if (responsibleFilter !== "all") {
      base = base.filter(
        item => String(item?.assignedToPersonId ?? "") === responsibleFilter
      );
    }
    if (billingFilter !== "all") {
      base = base.filter(item =>
        billingFilter === "pending"
          ? !item?.financialSummary?.hasCharge
          : Boolean(item?.financialSummary?.hasCharge)
      );
    }
    if (delayFilter === "overdue") {
      base = base.filter(item => {
        const status = normalizeStatus(item?.status);
        const scheduled = safeDate(item?.scheduledFor);
        return (
          Boolean(scheduled && scheduled < now) &&
          ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status)
        );
      });
    }

    if (customerFilter !== "all") {
      base = base.filter(
        item => String(item?.customerId ?? "") === customerFilter
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter(item => {
        const title = String(item?.title ?? "").toLowerCase();
        const customerName = String(item?.customer?.name ?? "").toLowerCase();
        const id = String(item?.id ?? "");
        return (
          title.includes(term) ||
          customerName.includes(term) ||
          id.includes(term)
        );
      });
    }

    return [...base].sort((a, b) => {
      const score = (order: any) => {
        const status = normalizeStatus(order?.status);
        const scheduled = safeDate(order?.scheduledFor);
        const overdue =
          Boolean(scheduled && scheduled < now) &&
          ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status);
        const blocked = ["BLOCKED", "ON_HOLD", "PAUSED"].includes(status);
        const noOwner = !order?.assignedToPersonId;
        const pendingCharge =
          status === "DONE" && !Boolean(order?.financialSummary?.hasCharge);
        const highPriority = Number(order?.priority ?? 0) >= 4;
        const inExecution = status === "IN_PROGRESS";
        return (
          (overdue ? 100 : 0) +
          (blocked ? 80 : 0) +
          (pendingCharge ? 60 : 0) +
          (noOwner ? 45 : 0) +
          (inExecution ? 20 : 0) +
          (highPriority ? 12 : 0) +
          (Number(order?.priority ?? 0) || 0)
        );
      };
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (
        (safeDate(b?.scheduledFor)?.getTime() ?? 0) -
        (safeDate(a?.scheduledFor)?.getTime() ?? 0)
      );
    });
  }, [
    activeTab,
    customerFilter,
    next7End,
    now,
    orders,
    billingFilter,
    delayFilter,
    priorityFilter,
    responsibleFilter,
    searchTerm,
    statusFilter,
    todayWindow.end,
    todayWindow.start,
    windowFilter,
  ]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setFocusedOrderId(null);
      return;
    }

    const hasFocused = filteredOrders.some(
      item => String(item?.id ?? "") === String(focusedOrderId ?? "")
    );
    if (!hasFocused) {
      setFocusedOrderId(String(filteredOrders[0]?.id ?? ""));
    }
  }, [filteredOrders, focusedOrderId]);

  const focusedOrder =
    filteredOrders.find(
      item => String(item?.id ?? "") === String(focusedOrderId ?? "")
    ) ??
    filteredOrders[0] ??
    null;

  const focusedOrderStatus = normalizeStatus(focusedOrder?.status);
  const focusedNextAction = focusedOrder ? getNextAction(focusedOrder) : "—";
  const focusedPriorityLabel = getPriorityLabel(Number(focusedOrder?.priority ?? 2));
  const focusedHasCharge = Boolean(focusedOrder?.financialSummary?.hasCharge);
  const focusedScheduledDate = safeDate(focusedOrder?.scheduledFor);
  const focusedIsOverdue = Boolean(
    focusedScheduledDate &&
      focusedScheduledDate < new Date() &&
      ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(focusedOrderStatus)
  );
  const focusedNeedsNotification = focusedOrderStatus === "WAITING_CUSTOMER";
  const focusedIsBlocked = ["BLOCKED", "ON_HOLD", "PAUSED"].includes(
    focusedOrderStatus
  );
  const focusedChargeStatus = !focusedHasCharge
    ? "Sem cobrança vinculada"
    : focusedOrderStatus === "DONE"
      ? "Cobrança vinculada"
      : "Cobrança em preparação";
  const focusedChargeStatusRaw = normalizeChargeStatus(
    focusedOrder?.financialSummary?.chargeStatus
  );
  const focusedTimeline = useMemo(
    () => normalizeArrayPayload<any>(focusedTimelineQuery.data),
    [focusedTimelineQuery.data]
  );
  const focusedExecutions = useMemo(
    () => normalizeArrayPayload<any>(focusedExecutionQuery.data),
    [focusedExecutionQuery.data]
  );
  const focusedSignals = useMemo(
    () => getOperationalSignals(focusedOrder, focusedTimeline),
    [focusedOrder, focusedTimeline]
  );
  const lastCommunicationEvent = useMemo(
    () =>
      focusedTimeline.find(event =>
        ["WHATSAPP_SENT", "MESSAGE_SENT", "CUSTOMER_NOTIFIED"].includes(
          String(event?.action ?? event?.type ?? "").toUpperCase()
        )
      ) ?? null,
    [focusedTimeline]
  );
  const fallbackTimeline = useMemo(
    () =>
      focusedOrder
        ? [
            {
              id: `created-${focusedOrder.id}`,
              action: "SERVICE_ORDER_CREATED",
              createdAt: focusedOrder.createdAt,
              description: "Ordem criada no pipeline operacional.",
            },
            {
              id: `updated-${focusedOrder.id}`,
              action: "SERVICE_ORDER_UPDATED",
              createdAt: focusedOrder.updatedAt,
              description: `Status atual: ${getStatusLabel(focusedOrderStatus)}.`,
            },
            {
              id: `charge-${focusedOrder.id}`,
              action: focusedHasCharge ? "CHARGE_CREATED" : "CHARGE_PENDING",
              createdAt: focusedOrder.updatedAt ?? focusedOrder.createdAt,
              description: focusedHasCharge
                ? "Cobrança vinculada ao fluxo."
                : "Cobrança ainda não gerada.",
            },
          ]
        : [],
    [focusedHasCharge, focusedOrder, focusedOrderStatus]
  );
  const compactTimeline = useMemo(
    () =>
      buildCompactOperationalTimeline({
        events: focusedTimeline,
        fallbackEvents: fallbackTimeline,
        mapEvent: event => ({
          id: String(event?.id ?? `${event?.action}-${event?.createdAt}`),
          occurredAt: event?.createdAt,
          label: formatTimelineEventLabel(event),
          summary: formatTimelineSummary(event),
        }),
        maxItems: 6,
      }),
    [fallbackTimeline, focusedTimeline]
  );
  const lastExecution = focusedExecutions[0] ?? null;

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / SERVICE_ORDERS_PER_PAGE));
  const pageStart = totalOrders === 0 ? 0 : (currentPage - 1) * SERVICE_ORDERS_PER_PAGE;
  const pageEnd = Math.min(pageStart + SERVICE_ORDERS_PER_PAGE, totalOrders);
  const paginatedOrders = filteredOrders.slice(pageStart, pageEnd);
  const paginationSlots = getPaginationSlots(totalPages, currentPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, customerFilter, priorityFilter, searchTerm, windowFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const executeOrderStatus = async (
    status: "IN_PROGRESS" | "DONE" | "CANCELED" | "PAUSED"
  ) => {
    if (!focusedOrder?.id) return;
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Atualizando ordem de serviço...");
      await updateServiceOrder.mutateAsync({
        id: String(focusedOrder.id),
        status,
      } as any);
      setActionFeedback(`Status atualizado para ${getStatusLabel(status)}.`);
      setActionFeedbackTone("success");
      await serviceOrdersQuery.refetch();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Falha na atualização.";
      const message = explainOperationalError({
        fallback: rawMessage,
        cause: `Não foi possível atualizar para ${getStatusLabel(status)}.`,
        suggestion:
          status === "DONE"
            ? "Valide se a execução já foi iniciada e se não há bloqueio ativo."
            : "Recarregue a ordem e tente novamente.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  };

  const executeGenerateCharge = async () => {
    if (!focusedOrder?.id) return;
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Gerando cobrança...");
      await generateCharge.mutateAsync({ id: String(focusedOrder.id) } as any);
      setActionFeedback("Cobrança gerada com sucesso.");
      setActionFeedbackTone("success");
      await Promise.all([
        serviceOrdersQuery.refetch(),
        focusedTimelineQuery.refetch(),
      ]);
    } catch (error) {
      const message = explainOperationalError({
        fallback: error instanceof Error ? error.message : "Falha ao gerar cobrança.",
        cause: "Não foi possível concluir a geração da cobrança da O.S.",
        suggestion: "Valide se a O.S. está concluída e tente novamente.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  };

  const dominantAction = useMemo<ServiceOrderNextAction>(() => {
    if (!focusedOrder) {
      return {
        title: "Selecione uma O.S.",
        reason: "Escolha uma linha para receber recomendação contextual.",
        ctaLabel: "Abrir detalhe",
        ctaIntent: "modal" as const,
        secondary: [],
      };
    }
    if (focusedOrderStatus === "OPEN" || focusedOrderStatus === "ASSIGNED") {
      return {
        title: "Iniciar execução",
        reason: "A O.S. está criada e pronta para iniciar o atendimento.",
        ctaLabel: "Iniciar execução",
        ctaIntent: "start" as const,
        secondary: [{ label: "Abrir agendamento", intent: "appointment" as const }],
      };
    }
    if (focusedOrderStatus === "IN_PROGRESS" && focusedIsOverdue) {
      return {
        title: "Atualizar andamento",
        reason: "A janela operacional venceu e o status precisa de atualização imediata.",
        ctaLabel: "Marcar andamento",
        ctaIntent: "progress" as const,
        secondary: [{ label: "Enviar atualização", intent: "whatsapp" as const }],
      };
    }
    if (focusedOrderStatus === "IN_PROGRESS") {
      return {
        title: "Concluir execução",
        reason: "Execução em curso sem pendência crítica detectada.",
        ctaLabel: "Concluir execução",
        ctaIntent: "complete" as const,
        secondary: [{ label: "Atualizar cliente", intent: "whatsapp" as const }],
      };
    }
    if (focusedOrderStatus === "DONE" && !focusedHasCharge) {
      return {
        title: "Gerar cobrança",
        reason: "Serviço concluído sem vínculo financeiro ativo.",
        ctaLabel: "Gerar cobrança",
        ctaIntent: "charge" as const,
        secondary: [{ label: "Ir para financeiro", intent: "finance" as const }],
      };
    }
    if (focusedChargeStatusRaw === "OVERDUE" || focusedChargeStatusRaw === "PENDING") {
      return {
        title: "Atuar no financeiro",
        reason: "Existe cobrança pendente/vencida exigindo continuidade no recebimento.",
        ctaLabel: "Ir para financeiro",
        ctaIntent: "finance" as const,
        secondary: [{ label: "Cobrar no WhatsApp", intent: "whatsapp" as const }],
      };
    }
    if (focusedNeedsNotification) {
      return {
        title: "Enviar atualização ao cliente",
        reason: "Há indicação de pendência de retorno para o cliente.",
        ctaLabel: "Abrir WhatsApp",
        ctaIntent: "whatsapp" as const,
        secondary: [{ label: "Abrir detalhe", intent: "appointment" as const }],
      };
    }
    return {
      title: "Fluxo operacional saudável",
      reason: "Execução, financeiro e comunicação estão consistentes neste momento.",
      ctaLabel: "Revisar detalhes",
      ctaIntent: "modal" as const,
      secondary: [{ label: "Abrir financeiro", intent: "finance" as const }],
    };
  }, [
    focusedChargeStatusRaw,
    focusedHasCharge,
    focusedIsOverdue,
    focusedNeedsNotification,
    focusedOrder,
    focusedOrderStatus,
  ]);

  const handleDominantAction = async () => {
    if (!focusedOrder) return;
    if (dominantAction.ctaIntent === "start" || dominantAction.ctaIntent === "progress") {
      await executeOrderStatus("IN_PROGRESS");
      return;
    }
    if (dominantAction.ctaIntent === "complete") {
      await executeOrderStatus("DONE");
      return;
    }
    if (dominantAction.ctaIntent === "charge") {
      await executeGenerateCharge();
      return;
    }
    if (dominantAction.ctaIntent === "finance") {
      navigate(`/finances?serviceOrderId=${focusedOrder.id}`);
      return;
    }
    if (dominantAction.ctaIntent === "whatsapp") {
      navigate(`/whatsapp?customerId=${focusedOrder.customerId}&serviceOrderId=${focusedOrder.id}`);
      return;
    }
    setOpenOperationalModal(true);
  };

  const headerCta = (() => {
    if (activeTab === "execution") {
      return {
        label: "Atualizar execução",
        onClick: () => setWindowFilter("today"),
      };
    }
    if (activeTab === "attention") {
      return {
        label: "Destravar operação",
        onClick: () => setPriorityFilter("high"),
      };
    }
    if (activeTab === "done") {
      return {
        label: "Ir para cobrança",
        onClick: () => navigate("/finances"),
      };
    }
    if (activeTab === "history") {
      return {
        label: "Voltar ao pipeline",
        onClick: () => setActiveTab("pipeline"),
      };
    }
    return { label: "Nova O.S.", onClick: () => setOpenCreate(true) };
  })();
  const selectedCustomerName =
    customerFilter === "all"
      ? ""
      : String(
          customers.find(item => String(item?.id ?? "") === customerFilter)
            ?.name ?? "Cliente"
        );
  const selectedResponsibleName =
    responsibleFilter === "all"
      ? ""
      : String(
          people.find(item => String(item?.id ?? "") === responsibleFilter)?.name ??
            "Responsável"
        );
  const globalAlerts = useMemo(() => {
    const delayed = filteredOrders.filter(item => {
      const status = normalizeStatus(item?.status);
      const scheduled = safeDate(item?.scheduledFor);
      return Boolean(scheduled && scheduled < new Date()) && ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status);
    }).length;
    const blocked = filteredOrders.filter(item =>
      ["BLOCKED", "ON_HOLD", "PAUSED"].includes(normalizeStatus(item?.status))
    ).length;
    const noOwner = filteredOrders.filter(item => !item?.assignedToPersonId).length;
    const withoutCharge = filteredOrders.filter(item => !item?.financialSummary?.hasCharge).length;
    return [
      { key: "delayed", label: "O.S. atrasadas", value: delayed, tone: "critical" as const, onAction: () => setDelayFilter("overdue") },
      { key: "blocked", label: "O.S. paradas", value: blocked, tone: "critical" as const, onAction: () => setActiveTab("attention") },
      { key: "no-owner", label: "Sem responsável", value: noOwner, tone: "warning" as const, onAction: () => setResponsibleFilter("all") },
      { key: "without-charge", label: "Sem cobrança", value: withoutCharge, tone: "warning" as const, onAction: () => setBillingFilter("pending") },
    ].filter(item => item.value > 0);
  }, [filteredOrders]);
  const pageSeverity = useMemo<OperationalSeverity>(() => {
    if (globalAlerts.some(item => item.tone === "critical")) return "critical";
    if (globalAlerts.some(item => item.tone === "warning")) return "pending";
    return "healthy";
  }, [globalAlerts]);

  return (
    <AppPageShell>
      <PageWrapper
        title="Ordens de Serviço"
        subtitle="Execute, destrave e converta O.S. em cobrança no mesmo fluxo."
      >
      <div className="space-y-4">
        <AppPageHeader
          title={
            activeTab === "execution"
              ? "Ordens em execução"
              : activeTab === "attention"
                ? "Ordens com atenção"
                : activeTab === "done"
                  ? "Ordens concluídas"
                  : activeTab === "history"
                    ? "Histórico de ordens"
                    : "Pipeline de ordens de serviço"
          }
          description={
            activeTab === "execution"
              ? "Foco em andamento, responsável e próxima ação."
              : activeTab === "attention"
                ? "Foco em travadas, atrasadas e sem avanço."
                : activeTab === "done"
                  ? "Ordens finalizadas prontas para cobrança e fechamento."
                  : activeTab === "history"
                    ? "Rastreabilidade de ordens encerradas, canceladas e passadas."
                    : "Visão ampla do funil das ordens ativas."
          }
          cta={
            <ActionFeedbackButton
              state="idle"
              idleLabel={headerCta.label}
              onClick={headerCta.onClick}
            />
          }
          secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              <AppStatusBadge label={`Severidade: ${getOperationalSeverityLabel(pageSeverity)}`} />
              <AppStatusBadge label={`${filteredOrders.length} em execução ativa`} />
            </div>
          }
        />
        <OperationalTopCard
          title="Central de execução de O.S."
          description="Da lista ao workspace, execute atendimento, comunicação e cobrança sem sair da rota."
          primaryAction={
            <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => setOpenCreate(true)}>
              Criar O.S.
            </SecondaryButton>
          }
          secondaryActions={
            <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate("/appointments")}>
              Puxar do agendamento
            </SecondaryButton>
          }
        />
        <AppToolbar className="gap-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <AppStatusBadge label="Fluxo: Cliente → Agendamento → O.S. → Cobrança → Pagamento" />
            <AppStatusBadge label={`Período: ${windowFilter === "next7" ? "próximos 7 dias" : windowFilter === "today" ? "hoje" : windowFilter === "overdue" ? "atrasadas" : "operação completa"}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate("/finances")}>
              Financeiro
            </SecondaryButton>
            <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate("/whatsapp")}>
              WhatsApp
            </SecondaryButton>
          </div>
        </AppToolbar>

        <AppOperationalBar
          tabs={[
            { value: "pipeline", label: "Pipeline" },
            { value: "execution", label: "Em execução" },
            { value: "attention", label: "Atenção" },
            { value: "done", label: "Concluídas" },
            { value: "history", label: "Histórico" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por título, cliente ou ID"
          quickFilters={
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "Tudo" },
                { key: "today", label: "Hoje" },
                { key: "overdue", label: "Atrasadas" },
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
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Janela
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={windowFilter}
                  onChange={event =>
                    setWindowFilter(event.target.value as WindowFilter)
                  }
                >
                  <option value="all">Tudo</option>
                  <option value="today">Hoje</option>
                  <option value="next7">Próximos 7 dias</option>
                  <option value="overdue">Atrasadas</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Status
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="created">Criadas</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluídas</option>
                  <option value="canceled">Canceladas</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Prioridade
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={priorityFilter}
                  onChange={event =>
                    setPriorityFilter(event.target.value as PriorityFilter)
                  }
                >
                  <option value="all">Toda prioridade</option>
                  <option value="high">Alta</option>
                  <option value="medium">Média</option>
                  <option value="low">Baixa</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Responsável
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={responsibleFilter}
                  onChange={event => setResponsibleFilter(event.target.value)}
                >
                  <option value="all">Todos</option>
                  {people.map(person => (
                    <option key={String(person.id)} value={String(person.id)}>
                      {String(person.name ?? "Responsável")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Cliente
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Cobrança
                </label>
                <select
                  className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
                  value={billingFilter}
                  onChange={event => setBillingFilter(event.target.value as BillingFilter)}
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="generated">Gerada</option>
                </select>
              </div>
            </div>
          }
          activeFilterChips={[
            ...(statusFilter !== "all"
              ? [{ key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("all") }]
              : []),
            ...(windowFilter === "next7"
              ? [
                  {
                    key: "window-next7",
                    label: "Janela: Próximos 7 dias",
                    onRemove: () => setWindowFilter("all"),
                  },
                ]
              : []),
            ...(priorityFilter !== "all"
              ? [
                  {
                    key: "priority",
                    label: `Prioridade: ${
                      priorityFilter === "high"
                        ? "Alta"
                        : priorityFilter === "medium"
                          ? "Média"
                          : "Baixa"
                    }`,
                    onRemove: () => setPriorityFilter("all"),
                  },
                ]
              : []),
            ...(customerFilter !== "all"
              ? [
                  {
                    key: "customer",
                    label: `Cliente: ${selectedCustomerName}`,
                    onRemove: () => setCustomerFilter("all"),
                  },
                ]
              : []),
            ...(responsibleFilter !== "all"
              ? [{ key: "responsible", label: `Responsável: ${selectedResponsibleName}`, onRemove: () => setResponsibleFilter("all") }]
              : []),
            ...(billingFilter !== "all"
              ? [{ key: "billing", label: `Cobrança: ${billingFilter === "pending" ? "Pendente" : "Gerada"}`, onRemove: () => setBillingFilter("all") }]
              : []),
            ...(delayFilter === "overdue"
              ? [{ key: "delay", label: "Apenas atrasadas", onRemove: () => setDelayFilter("all") }]
              : []),
          ]}
          onClearAllFilters={() => {
            setWindowFilter("all");
            setPriorityFilter("all");
            setStatusFilter("all");
            setResponsibleFilter("all");
            setCustomerFilter("all");
            setBillingFilter("all");
            setDelayFilter("all");
          }}
        />
        {globalAlerts.length > 0 ? (
          <AppSectionBlock
            title="Alertas de execução"
            subtitle="Priorize o que está travando operação e receita agora."
            compact
          >
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {globalAlerts.map(alert => (
                <button
                  key={alert.key}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    alert.tone === "critical"
                      ? "border-[var(--dashboard-danger)]/35 bg-[var(--dashboard-danger-soft)]/50 hover:bg-[var(--dashboard-danger-soft)]/70"
                      : "border-[var(--dashboard-warning)]/35 bg-[var(--dashboard-warning-soft)]/45 hover:bg-[var(--dashboard-warning-soft)]/65"
                  }`}
                  onClick={alert.onAction}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    {alert.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{alert.value}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Atuar agora</p>
                </button>
              ))}
            </div>
          </AppSectionBlock>
        ) : null}

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "pipeline"
                ? "Pipeline geral de O.S."
                : activeTab === "execution"
                  ? "Ordens em andamento"
                  : activeTab === "attention"
                    ? "Ordens com atenção imediata"
                    : activeTab === "done"
                      ? "Ordens finalizadas"
                      : "Histórico operacional de O.S."
            }
            subtitle="Lista principal com filtros de estado, prioridade, cliente e janela para decisão rápida."
          >
            {showInitialLoading ? (
              <AppPageLoadingState description="Carregando ordens de serviço..." />
            ) : showErrorState ? (
              <AppPageErrorState
                description={
                  serviceOrdersQuery.error?.message ??
                  "Falha ao carregar ordens de serviço."
                }
                actionLabel="Tentar novamente"
                onAction={() => void serviceOrdersQuery.refetch()}
              />
            ) : filteredOrders.length === 0 ? (
              <AppPageEmptyState
                title="Nenhuma O.S. encontrada"
                description="Ajuste os filtros ou crie uma nova ordem para manter o fluxo operacional."
              />
            ) : (
              <div className="space-y-3">
                <AppDataTable>
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      <tr>
                        <th className="w-[24%] px-4 py-2.5 text-left align-middle">Ordem</th>
                        <th className="w-[15%] px-4 py-2.5 text-left align-middle">Cliente</th>
                        <th className="w-[14%] px-4 py-2.5 text-left align-middle">Status</th>
                        <th className="w-[10%] px-4 py-2.5 text-left align-middle">Responsável</th>
                        <th className="w-[12%] px-4 py-2.5 text-left align-middle">Prazo/valor</th>
                        <th className="w-[10%] px-4 py-2.5 text-left align-middle">Prioridade</th>
                        <th className="w-[13%] px-4 py-2.5 text-left align-middle">Próxima ação</th>
                        <th className="w-[140px] px-4 py-2.5 text-right align-middle">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map(order => {
                        const status = normalizeStatus(order?.status);
                        const hasCharge = Boolean(
                          order?.financialSummary?.hasCharge
                        );
                        const nextAction = getNextAction(order);
                        const primaryActionLabel = getPrimaryActionLabel(
                          order,
                          nextAction
                        );
                        const priorityLabel = getPriorityLabel(
                          Number(order?.priority ?? 2)
                        );
                        const rowSignals = getOperationalSignals(order, []);

                        const handlePrimaryAction = () => {
                          setFocusedOrderId(String(order?.id ?? ""));
                          setOpenOperationalModal(true);
                        };

                        const isFocused =
                          String(order?.id ?? "") === focusedOrderId;
                        const orderTitle = String(order?.title ?? "Sem título");
                        const customerName = String(
                          order?.customer?.name ?? "Cliente"
                        );
                        const scheduledDate = safeDate(order?.scheduledFor);
                        const scheduledLabel = order?.scheduledFor
                          ? `Agendada: ${scheduledDate?.toLocaleDateString("pt-BR")}`
                          : "Sem data definida";
                        const shouldShowNextActionTitle = nextAction.length > 30;
                        const assignedName = order?.assignedToPersonId
                          ? String(
                              people.find(
                                person =>
                                  String(person?.id ?? "") ===
                                  String(order?.assignedToPersonId ?? "")
                              )?.name ?? "Responsável"
                            )
                          : "Sem responsável";
                        const riskState = getOperationalRiskState(rowSignals);

                        return (
                          <tr
                            key={String(order?.id)}
                            className={getOrderRowClass(isFocused)}
                            onClick={() => {
                              setFocusedOrderId(String(order?.id ?? ""));
                              setActionFeedback(null);
                              setActionFeedbackTone("neutral");
                            }}
                          >
                            <td className="px-4 py-3.5 align-top">
                              <p className="truncate text-sm font-semibold leading-5 text-[var(--text-primary)]">
                                {orderTitle}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">
                                #{String(order?.id ?? "—")}
                              </p>
                              {isFocused ? (
                                <p className="mt-1 text-[11px] font-medium text-[var(--accent-primary)]">
                                  Em foco no workspace
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p
                                className="truncate text-sm font-medium text-[var(--text-primary)]"
                                title={customerName.length > 28 ? customerName : undefined}
                              >
                                {customerName}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]/90">
                                {scheduledLabel}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              {(() => {
                                const statusVisual = getStatusVisual(status, Boolean(scheduledDate && scheduledDate < now && ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status)), riskState);
                                return <AppStatusBadge label={statusVisual.label} />;
                              })()}
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {rowSignals.slice(0, 2).map(signal => (
                                  <span
                                    key={signal.key}
                                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getOperationalSignalToneClasses(signal.tone, "outlined")}`}
                                  >
                                    {signal.label}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p className="text-xs font-medium text-[var(--text-primary)]">{assignedName}</p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{riskState}</p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p className="text-xs text-[var(--text-secondary)]">
                                {scheduledDate
                                  ? scheduledDate.toLocaleDateString("pt-BR")
                                  : "Sem prazo"}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                {order?.totalAmountCents
                                  ? formatMoney(Number(order.totalAmountCents))
                                  : order?.financialSummary?.chargeAmountCents
                                    ? formatMoney(Number(order.financialSummary.chargeAmountCents))
                                    : "Sem valor"}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <AppPriorityBadge label={priorityLabel} />
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p
                                className={OPERATIONAL_NEXT_ACTION_CLASS}
                                title={shouldShowNextActionTitle ? nextAction : undefined}
                              >
                                {toSingleLineAction(nextAction)}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); setFocusedOrderId(String(order?.id ?? "")); void executeOrderStatus("IN_PROGRESS"); }}>
                                  Iniciar
                                </SecondaryButton>
                                <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); setFocusedOrderId(String(order?.id ?? "")); void executeOrderStatus("PAUSED"); }}>
                                  Pausar
                                </SecondaryButton>
                                <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); setFocusedOrderId(String(order?.id ?? "")); void executeOrderStatus("DONE"); }}>
                                  Concluir
                                </SecondaryButton>
                                <SecondaryButton
                                  type="button"
                                  className={`${OPERATIONAL_PRIMARY_CTA_CLASS} h-7 px-2 text-[10px] tracking-[0.01em]`}
                                  onClick={event => {
                                    event.stopPropagation();
                                    handlePrimaryAction();
                                  }}
                                >
                                  {resolveOperationalActionLabel(nextAction, primaryActionLabel)}
                                </SecondaryButton>
                                <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); navigate(`/whatsapp?customerId=${order.customerId}&serviceOrderId=${order.id}`); }}>
                                  WhatsApp
                                </SecondaryButton>
                                <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); navigate(`/finances?serviceOrderId=${order.id}`); }}>
                                  Cobrança
                                </SecondaryButton>
                                <AppRowActionsDropdown
                                  triggerLabel="Mais ações"
                                  contentClassName="min-w-[240px]"
                                  items={[
                                    {
                                      label: "Iniciar",
                                      onSelect: () => {
                                        setFocusedOrderId(String(order?.id ?? ""));
                                        void executeOrderStatus("IN_PROGRESS");
                                      },
                                    },
                                    {
                                      label: "Concluir",
                                      onSelect: () => {
                                        setFocusedOrderId(String(order?.id ?? ""));
                                        void executeOrderStatus("DONE");
                                      },
                                    },
                                    {
                                      label: "Abrir agendamentos",
                                      onSelect: () =>
                                        navigate(
                                          `/appointments?customerId=${order.customerId}${
                                            order?.appointmentId
                                              ? `&appointmentId=${order.appointmentId}`
                                              : ""
                                          }`
                                        ),
                                    },
                                    {
                                      label: "Gerar cobrança",
                                      onSelect: () => navigate(`/finances?serviceOrderId=${order.id}`),
                                    },
                                    {
                                      label: "Enviar WhatsApp",
                                      onSelect: () =>
                                        navigate(
                                          `/whatsapp?customerId=${order.customerId}`
                                        ),
                                    },
                                    {
                                      label: "Abrir detalhe",
                                      onSelect: () => {
                                        setFocusedOrderId(String(order?.id ?? ""));
                                        setOpenOperationalModal(true);
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
                <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)]/70 pt-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-[var(--text-muted)]">
                    Mostrando {totalOrders === 0 ? 0 : pageStart + 1}–{pageEnd} de{" "}
                    {totalOrders}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      anterior
                    </button>
                    {paginationSlots.map((slot, index) =>
                      slot === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-1.5 text-xs text-[var(--text-muted)]"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={`page-${slot}`}
                          type="button"
                          className={getPaginationButtonClass(slot === currentPage)}
                          onClick={() => setCurrentPage(slot)}
                        >
                          {slot}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() =>
                        setCurrentPage(prev => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      próximo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Workspace operacional da O.S."
            subtitle="Camada intermediária entre lista e modal para manter contexto de execução, cobrança e comunicação."
          >
            {!focusedOrder ? (
              <AppPageEmptyState
                title="Selecione uma ordem"
                description="Clique em uma linha para abrir o workspace da O.S. com contexto contínuo e ação principal."
              />
            ) : (
              <WorkspaceScaffold
                title={`Workspace · ${String(focusedOrder?.title ?? "O.S. sem título")}`}
                subtitle={`Cliente: ${String(focusedOrder?.customer?.name ?? "Cliente")} · Status ${getStatusLabel(focusedOrderStatus)}`}
                primaryAction={{
                  label: dominantAction.ctaLabel,
                  onClick: () => void handleDominantAction(),
                }}
                context={
                  <div className="space-y-4">
                    <section className="rounded-xl border border-[var(--border-subtle)]/80 bg-[var(--surface-subtle)]/35 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                          {String(focusedOrder?.title ?? "O.S. sem título")}
                        </h4>
                        <div className="flex items-center gap-2">
                          <AppStatusBadge label={getStatusLabel(focusedOrderStatus)} />
                          <AppPriorityBadge label={focusedPriorityLabel} />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        #{String(focusedOrder?.id ?? "—")} · {focusedChargeStatus}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">
                        Agendada para {formatDateLabel(focusedOrder?.scheduledFor)} ·{" "}
                        Responsável:{" "}
                        {focusedOrder?.assignedToPersonId
                          ? String(
                              people.find(
                                person =>
                                  String(person?.id ?? "") ===
                                  String(focusedOrder?.assignedToPersonId ?? "")
                              )?.name ?? "Pessoa atribuída"
                            )
                          : "Sem técnico atribuído"}
                      </p>
                    </section>

                    <OperationalNextAction
                      title={dominantAction.title}
                      reason={dominantAction.reason}
                      urgency={
                        focusedIsBlocked || focusedIsOverdue
                          ? "Urgente"
                          : focusedNeedsNotification
                            ? "Atenção"
                            : focusedSignals[0]?.tone === "healthy"
                              ? "Saudável"
                              : "Prioridade operacional"
                      }
                      impact={
                        !focusedHasCharge && focusedOrderStatus === "DONE"
                          ? "Evitar perda de receita"
                          : focusedSignals[0]?.tone === "healthy"
                            ? "Manter estabilidade operacional"
                            : "Proteger continuidade da execução"
                      }
                    />
                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Sinais operacionais
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {focusedSignals.map(signal => (
                          <span
                            key={signal.key}
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${getOperationalSignalToneClasses(signal.tone, "outlined")}`}
                          >
                            {signal.label}
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Bloco de execução
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => void executeOrderStatus("IN_PROGRESS")}>
                          Iniciar atendimento
                        </SecondaryButton>
                        <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => void executeOrderStatus("PAUSED")}>
                          Pausar
                        </SecondaryButton>
                        <Button type="button" className="h-8 px-3 text-xs" onClick={() => void executeOrderStatus("DONE")}>
                          Concluir
                        </Button>
                      </div>
                    </section>

                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Contexto de execução
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Etapa atual: {getStatusLabel(focusedOrderStatus)} ·{" "}
                        {focusedIsOverdue
                          ? "Atrasada para execução."
                          : "Dentro da janela operacional."}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Última atualização: {formatDateLabel(focusedOrder?.updatedAt, "Sem atualização registrada")}.
                      </p>
                      {lastExecution ? (
                        <p className="text-xs text-[var(--text-muted)]">
                          Registro de execução:{" "}
                          {String(lastExecution?.status ?? "status não informado")} em{" "}
                          {formatDateLabel(lastExecution?.updatedAt ?? lastExecution?.createdAt, "data não registrada")}.
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dominantAction.secondary.slice(0, 2).map(secondary => (
                          <SecondaryButton
                            key={secondary.label}
                            type="button"
                            className="h-7 px-2.5 text-[11px]"
                            onClick={() => {
                              if (!focusedOrder) return;
                              if (secondary.intent === "finance") {
                                navigate(`/finances?serviceOrderId=${focusedOrder.id}`);
                                return;
                              }
                              if (secondary.intent === "whatsapp") {
                                navigate(`/whatsapp?customerId=${focusedOrder.customerId}&serviceOrderId=${focusedOrder.id}`);
                                return;
                              }
                              navigate(
                                `/appointments?customerId=${focusedOrder.customerId}${
                                  focusedOrder?.appointmentId
                                    ? `&appointmentId=${focusedOrder.appointmentId}`
                                    : ""
                                }`
                              );
                            }}
                          >
                            {secondary.label}
                          </SecondaryButton>
                        ))}
                      </div>
                    </section>

                    <AppSectionCard className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Registros e evidências
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Estrutura pronta para anexos/fotos e observações operacionais sem bloquear a execução atual.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <SecondaryButton type="button" className="h-7 px-2.5 text-[11px]" onClick={() => setOpenOperationalModal(true)}>
                          Ver alterações
                        </SecondaryButton>
                        <SecondaryButton type="button" className="h-7 px-2.5 text-[11px]" onClick={() => navigate(`/timeline?serviceOrderId=${focusedOrder?.id}`)}>
                          Abrir timeline completa
                        </SecondaryButton>
                      </div>
                    </AppSectionCard>

                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Descrição e observações
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {String(focusedOrder?.description ?? focusedOrder?.title ?? "Sem descrição operacional registrada.")}
                      </p>
                    </section>

                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Checklist
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {Array.isArray(focusedOrder?.checklistItems) && focusedOrder.checklistItems.length > 0
                          ? `${focusedOrder.checklistItems.filter((item: any) => item?.done).length}/${focusedOrder.checklistItems.length} etapas concluídas.`
                          : "Sem checklist estruturado para esta O.S."}
                      </p>
                    </section>

                    <section className="space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        Metadados operacionais
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Cliente #{String(focusedOrder?.customerId ?? "—")} · Agendamento{" "}
                        {focusedOrder?.appointmentId
                          ? `#${String(focusedOrder?.appointmentId)}`
                          : "não vinculado"}
                        .
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Automações: {focusedHasCharge ? "financeiro conectado" : "aguardando geração de cobrança"}.
                      </p>
                    </section>
                  </div>
                }
                finance={
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Contexto financeiro
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Situação: {focusedChargeStatus}.
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Status financeiro:{" "}
                      {focusedChargeStatusRaw === "PAID"
                        ? "Pagamento recebido"
                        : focusedChargeStatusRaw === "OVERDUE"
                          ? "Cobrança vencida"
                          : focusedChargeStatusRaw === "PENDING"
                            ? "Cobrança pendente"
                            : "Sem fluxo financeiro ativo"}
                      .
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Valor:{" "}
                      {focusedOrder?.financialSummary?.chargeAmountCents
                        ? formatMoney(Number(focusedOrder.financialSummary.chargeAmountCents))
                        : "sem valor consolidado"}.
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Vencimento:{" "}
                      {formatDateLabel(
                        focusedOrder?.financialSummary?.chargeDueDate,
                        "não definido"
                      )}
                      .
                    </p>
                    <SecondaryButton
                      type="button"
                      className="mt-3 h-8 px-3 text-xs"
                      onClick={() =>
                        !focusedHasCharge
                          ? void executeGenerateCharge()
                          : navigate(`/finances?serviceOrderId=${focusedOrder?.id}`)
                      }
                    >
                      {!focusedHasCharge ? "Gerar cobrança" : "Abrir financeiro"}
                    </SecondaryButton>
                  </section>
                }
                communication={
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Comunicação
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {focusedNeedsNotification
                        ? "Cliente aguardando retorno no WhatsApp."
                        : "Sem pendência crítica de contato."}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Última interação:{" "}
                      {lastCommunicationEvent
                        ? formatDateLabel(lastCommunicationEvent?.createdAt, "sem horário")
                        : "nenhuma registrada"}
                      .
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Sugestão:{" "}
                      {focusedOrderStatus === "DONE" && focusedChargeStatusRaw === "PENDING"
                        ? "Cobrar confirmação de pagamento."
                        : focusedOrderStatus === "IN_PROGRESS"
                          ? "Enviar atualização de andamento."
                          : "Manter cliente informado sobre a execução."}
                    </p>
                    <Button
                      type="button"
                      className="mt-3 h-8 px-3 text-xs"
                      onClick={() =>
                        navigate(
                          `/whatsapp?customerId=${focusedOrder?.customerId}&serviceOrderId=${focusedOrder?.id}`
                        )
                      }
                    >
                      Enviar atualização
                    </Button>
                  </section>
                }
                timeline={
                  <section className="rounded-xl border border-[var(--border-subtle)]/80 p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      Histórico operacional
                    </p>
                    {focusedTimelineQuery.isLoading ? (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">Carregando eventos...</p>
                    ) : (
                      <AppTimeline className="mt-2">
                        {compactTimeline.map(event => (
                          <AppTimelineItem key={event.id} className="rounded-md border border-[var(--border-subtle)]/70 px-2.5 py-2 text-xs">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {event.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                              {formatDateLabel(event.occurredAt, "Sem data registrada")}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                              {event.summary}
                            </p>
                          </AppTimelineItem>
                        ))}
                      </AppTimeline>
                    )}
                  </section>
                }
              >
                <div className="space-y-4">
                  <OperationalFlowState
                    steps={[
                      { label: "Cliente", state: "done" },
                      {
                        label: "Agendamento",
                        state: focusedOrder?.appointmentId ? "done" : "pending",
                      },
                      { label: "O.S.", state: "current" },
                      {
                        label: "Cobrança",
                        state: focusedHasCharge ? "done" : "pending",
                      },
                      {
                        label: "Pagamento",
                        state:
                          focusedChargeStatusRaw === "PAID"
                            ? "done"
                            : focusedHasCharge
                              ? "current"
                              : "pending",
                      },
                    ]}
                  />
                  <OperationalRelationSummary
                    title="Entidades conectadas"
                    items={[
                      `Cliente vinculado: ${String(focusedOrder?.customer?.name ?? "não identificado")}.`,
                      focusedOrder?.appointmentId
                        ? `Origem no agendamento #${String(focusedOrder?.appointmentId)}.`
                        : "Sem agendamento de origem.",
                      focusedHasCharge
                        ? focusedChargeStatusRaw === "PAID"
                          ? "Cobrança já quitada e registrada no financeiro."
                          : "Cobrança conectada ao fluxo financeiro."
                        : "Fluxo financeiro ainda pendente para esta O.S.",
                      lastCommunicationEvent
                        ? `Última comunicação registrada em ${formatDateLabel(lastCommunicationEvent.createdAt, "horário não disponível")}.`
                        : "Sem comunicação registrada nesta O.S.",
                    ]}
                  />
                  {!focusedHasCharge ? (
                    <EmptyActionState
                      title="Cobrança pendente"
                      description="A ordem já existe no fluxo, mas ainda sem cobrança ativa vinculada."
                      ctaLabel="Gerar cobrança"
                      onCta={() =>
                        navigate(`/finances?serviceOrderId=${focusedOrder?.id}`)
                      }
                    />
                  ) : null}
                  {actionFeedback ? (
                    <OperationalInlineFeedback
                      tone={actionFeedbackTone}
                      nextStep={
                        actionFeedbackTone === "success"
                          ? "Validar o impacto na lista e seguir para o próximo passo sugerido."
                          : undefined
                      }
                    >
                      {actionFeedback}
                    </OperationalInlineFeedback>
                  ) : null}
                </div>
              </WorkspaceScaffold>
            )}
          </AppSectionBlock>
        </div>
      </div>

      <AppOperationalModal
        open={openOperationalModal && Boolean(focusedOrder)}
        onOpenChange={open => {
          setOpenOperationalModal(open);
          if (!open) {
            setActionFeedback(null);
            setActionFeedbackTone("neutral");
          }
        }}
        title={String(focusedOrder?.title ?? "O.S. sem título")}
        subtitle={`Cliente: ${String(focusedOrder?.customer?.name ?? "Cliente")}`}
        status={getStatusLabel(normalizeStatus(focusedOrder?.status))}
        priority={`Prioridade ${getPriorityLabel(Number(focusedOrder?.priority ?? 2))}`}
        summary={[
          {
            label: "Status",
            value: getStatusLabel(normalizeStatus(focusedOrder?.status)),
          },
          {
            label: "Próxima ação",
            value: focusedOrder ? getNextAction(focusedOrder) : "—",
          },
          {
            label: "Cobrança",
            value: focusedOrder?.financialSummary?.hasCharge ? "Gerada" : "Pendente",
          },
          {
            label: "Agendamento",
            value: focusedOrder?.scheduledFor
              ? safeDate(focusedOrder?.scheduledFor)?.toLocaleDateString("pt-BR") ?? "—"
              : "Sem data",
          },
        ]}
        primaryAction={{
          label:
            normalizeStatus(focusedOrder?.status) === "DONE" &&
            !focusedOrder?.financialSummary?.hasCharge
              ? "Gerar cobrança"
              : "Marcar em andamento",
          onClick: async () => {
            if (!focusedOrder?.id) return;
            if (
              normalizeStatus(focusedOrder?.status) === "DONE" &&
              !focusedOrder?.financialSummary?.hasCharge
            ) {
              try {
                setActionFeedbackTone("neutral");
                setActionFeedback("Gerando cobrança...");
                await generateCharge.mutateAsync({ id: String(focusedOrder.id) } as any);
                setActionFeedback("Cobrança gerada com sucesso.");
                setActionFeedbackTone("success");
                await serviceOrdersQuery.refetch();
              } catch (error) {
                setActionFeedbackTone("error");
                setActionFeedback(
                  explainOperationalError({
                    fallback:
                      error instanceof Error ? error.message : "Falha ao gerar cobrança.",
                    cause:
                      "Não foi possível gerar cobrança porque a ordem ainda não ficou consistente no financeiro.",
                    suggestion:
                      "Confirme se a O.S. está concluída e tente gerar novamente em alguns segundos.",
                  })
                );
              }
              return;
            }
            await executeOrderStatus("IN_PROGRESS");
          },
          disabled: updateServiceOrder.isPending || generateCharge.isPending,
          processing: updateServiceOrder.isPending || generateCharge.isPending,
        }}
        secondaryAction={{
          label: "Concluir O.S.",
          onClick: () => void executeOrderStatus("DONE"),
          disabled: updateServiceOrder.isPending || !focusedOrder,
        }}
        quickActions={[
          {
            label: "Acionar cobrança",
            onClick: () =>
              focusedOrder?.id &&
              navigate(`/finances?serviceOrderId=${focusedOrder.id}`),
            disabled: !focusedOrder,
          },
          {
            label: "WhatsApp",
            onClick: () =>
              focusedOrder?.customerId &&
              navigate(`/whatsapp?customerId=${focusedOrder.customerId}`),
            disabled: !focusedOrder?.customerId,
          },
          {
            label: "Cancelar",
            onClick: () => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("Cancelar esta ordem de serviço agora?")
              ) {
                return;
              }
              void executeOrderStatus("CANCELED");
            },
            disabled: updateServiceOrder.isPending || !focusedOrder,
          },
        ]}
        feedback={actionFeedback}
        feedbackTone={actionFeedbackTone}
      >
        <div className="space-y-4">
          {focusedOrder ? (
            <OperationalNextAction
              title={getNextAction(focusedOrder)}
              reason="Recomendação baseada no status da O.S., avanço do fluxo e vínculo financeiro."
              urgency={
                ["BLOCKED", "ON_HOLD", "PAUSED"].includes(
                  normalizeStatus(focusedOrder?.status)
                ) || !focusedOrder?.financialSummary?.hasCharge
                  ? "Urgente"
                  : "Prioridade operacional"
              }
              impact={
                normalizeStatus(focusedOrder?.status) === "DONE" &&
                !focusedOrder?.financialSummary?.hasCharge
                  ? "Evitar perda de receita"
                  : "Manter SLA de execução"
              }
            />
          ) : null}
          <OperationalFlowState
            steps={[
              { label: "Cliente", state: "done" },
              { label: "Agendamento", state: focusedOrder?.appointmentId ? "done" : "pending" },
              { label: "O.S.", state: "current" },
              {
                label: "Cobrança",
                state: focusedOrder?.financialSummary?.hasCharge ? "done" : "pending",
              },
              {
                label: "Pagamento",
                state: focusedOrder?.financialSummary?.hasCharge ? "current" : "pending",
              },
            ]}
          />
          <section className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              Próxima melhor ação
            </p>
            <p className="text-sm text-[var(--text-primary)]">
              {focusedOrder
                ? getNextAction(focusedOrder)
                : "Sem ordem selecionada."}
            </p>
            {normalizeStatus(focusedOrder?.status) === "DONE" &&
            !focusedOrder?.financialSummary?.hasCharge ? (
              <p className="text-xs font-medium text-[var(--dashboard-danger)]">
                O.S. concluída sem cobrança ativa: risco de perda de receita.
              </p>
            ) : null}
          </section>
          <OperationalRelationSummary
            title="Entidades conectadas"
            items={[
              `Esta O.S. pertence ao cliente ${String(focusedOrder?.customer?.name ?? "não identificado")}.`,
              focusedOrder?.appointmentId
                ? `A execução veio do agendamento #${String(focusedOrder.appointmentId)}.`
                : "Sem agendamento de origem registrado.",
              focusedOrder?.financialSummary?.hasCharge
                ? "Já existe cobrança associada a esta O.S."
                : "Ainda não existe cobrança associada a esta O.S.",
            ]}
          />
          {normalizeStatus(focusedOrder?.status) === "DONE" ? (
            <OperationalAutomationNote detail="Quando a cobrança é gerada, a O.S. concluída sai automaticamente da fila de atenção e entra no histórico financeiro." />
          ) : null}
          {!focusedOrder?.financialSummary?.hasCharge ? (
            <EmptyActionState
              title="Nenhuma cobrança gerada ainda"
              description="A O.S. já está no fluxo operacional, mas sem conexão com o financeiro."
              ctaLabel="Gerar cobrança"
              onCta={() => focusedOrder?.id && navigate(`/finances?serviceOrderId=${focusedOrder.id}`)}
            />
          ) : null}
          <section className="border-t border-[var(--border-subtle)] pt-4">
            {focusedOrder ? (
              <ServiceOrderDetailsPanel os={focusedOrder as ServiceOrder} />
            ) : null}
          </section>
          {actionFeedback ? (
            <OperationalInlineFeedback
              tone={actionFeedbackTone}
              nextStep={
                actionFeedbackTone === "success"
                  ? "Validar se o status e a trilha financeira foram atualizados na lista principal."
                  : undefined
              }
            >
              {actionFeedback}
            </OperationalInlineFeedback>
          ) : null}
        </div>
      </AppOperationalModal>
      <CreateServiceOrderModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void serviceOrdersQuery.refetch();
        }}
        customers={customers.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Cliente"),
        }))}
        people={people.map(item => ({
          id: String(item.id),
          name: String(item.name ?? "Pessoa"),
        }))}
        appointmentId={String(focusedOrder?.appointmentId ?? "") || undefined}
        initialCustomerId={String(focusedOrder?.customerId ?? "") || undefined}
      />
      </PageWrapper>
    </AppPageShell>
  );
}
