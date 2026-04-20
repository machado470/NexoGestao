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
import { SecondaryButton } from "@/components/design-system";
import { getDayWindow, inRange, safeDate } from "@/lib/operational/kpi";
import {
  getOperationalSeverityLabel,
  getServiceOrderSeverity,
} from "@/lib/operations/operational-intelligence";
import { toast } from "sonner";

type ServiceOrderTab =
  | "pipeline"
  | "execution"
  | "attention"
  | "done"
  | "history";
type WindowFilter = "all" | "today" | "next7" | "overdue";
type PriorityFilter = "all" | "high" | "medium" | "low";
const SERVICE_ORDERS_PER_PAGE = 8;

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
    return "Destravar agora — O.S. bloqueada";
  }
  if (status === "WAITING_CUSTOMER") return "Cobrar retorno — aguardando cliente";
  if (["OPEN", "ASSIGNED"].includes(status) && !order?.assignedToPersonId) {
    return "Atribuir técnico — ordem sem responsável";
  }
  if (["OPEN", "ASSIGNED"].includes(status))
    return overdueDays > 0
      ? `Iniciar hoje — agendada e atrasada há ${overdueDays} dia(s)`
      : "Iniciar execução — pronta para avanço";
  if (status === "IN_PROGRESS") return "Acompanhar execução — evitar atraso";
  if (status === "DONE" && !hasCharge) return "Cobrar agora — O.S. concluída sem cobrança";
  if (status === "DONE" && hasCharge) return "Notificar cliente — cobrança emitida";
  return "Revisar histórico operacional";
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
  return "Agir";
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
    ? "min-w-8 rounded-md border border-[var(--accent-primary)] bg-[var(--accent-soft)] px-2 py-1.5 text-xs font-semibold text-[var(--accent-primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_24%,transparent)] transition-all"
    : "min-w-8 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)]";
}

function getOrderRowClass(active: boolean) {
  return active
    ? "cursor-pointer border-t border-[var(--border-subtle)] bg-[var(--accent-soft)]/45 transition-colors hover:bg-[var(--accent-soft)]/60"
    : "cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60";
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
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState(
    "nexo.service-orders.customer-filter.v1",
    "all"
  );
  const [focusedOrderId, setFocusedOrderId] = useState("");
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

    return base;
  }, [
    activeTab,
    customerFilter,
    next7End,
    now,
    orders,
    priorityFilter,
    searchTerm,
    todayWindow.end,
    todayWindow.start,
    windowFilter,
  ]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setFocusedOrderId("");
      return;
    }

    const hasFocused = filteredOrders.some(
      item => String(item?.id ?? "") === focusedOrderId
    );
    if (!hasFocused) {
      setFocusedOrderId(String(filteredOrders[0]?.id ?? ""));
    }
  }, [filteredOrders, focusedOrderId]);

  const focusedOrder =
    filteredOrders.find(item => String(item?.id ?? "") === focusedOrderId) ??
    filteredOrders[0] ??
    null;

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
    status: "IN_PROGRESS" | "DONE" | "CANCELED"
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

  return (
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
        />

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
            </div>
          }
          activeFilterChips={[
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
          ]}
          onClearAllFilters={() => {
            setWindowFilter("all");
            setPriorityFilter("all");
            setCustomerFilter("all");
          }}
        />

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
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                      <tr>
                        <th className="w-[24%] px-4 py-3 text-left">Ordem</th>
                        <th className="w-[21%] px-4 py-3 text-left">Cliente</th>
                        <th className="w-[19%] px-4 py-3 text-left">Status</th>
                        <th className="w-[118px] px-4 py-3 text-left">Prioridade</th>
                        <th className="w-[16%] px-4 py-3 text-left">Próxima ação</th>
                        <th className="w-[156px] px-4 py-3 text-right">Ações</th>
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
                        const scheduledLabel = order?.scheduledFor
                          ? `Agendada: ${safeDate(order?.scheduledFor)?.toLocaleDateString("pt-BR")}`
                          : "Sem data definida";
                        const shouldShowNextActionTitle = nextAction.length > 52;

                        return (
                          <tr
                            key={String(order?.id)}
                            className={getOrderRowClass(isFocused)}
                            onClick={() => {
                              setFocusedOrderId(String(order?.id ?? ""));
                              setOpenOperationalModal(true);
                            }}
                          >
                            <td className="px-4 py-3.5 align-top">
                              <p className="truncate text-[13px] font-semibold leading-snug text-[var(--text-primary)]">
                                {orderTitle}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                #{String(order?.id ?? "—")}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <p
                                className="truncate text-sm font-medium text-[var(--text-primary)]"
                                title={customerName.length > 28 ? customerName : undefined}
                              >
                                {customerName}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]/90">
                                {scheduledLabel}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <AppStatusBadge
                                label={`${getStatusLabel(status)} · ${getOperationalSeverityLabel(getServiceOrderSeverity(order))}`}
                              />
                              {status === "DONE" && !hasCharge ? (
                                <p className="mt-1 text-xs text-[var(--dashboard-danger)]">
                                  Concluída sem cobrança ativa
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <AppPriorityBadge label={priorityLabel} />
                            </td>
                            <td className="px-4 py-3.5 align-top text-xs text-[var(--text-secondary)]">
                              <button
                                type="button"
                                className="line-clamp-2 text-left font-medium leading-relaxed text-[var(--accent-primary)] underline-offset-2 hover:underline"
                                title={shouldShowNextActionTitle ? nextAction : undefined}
                                onClick={event => {
                                  event.stopPropagation();
                                  handlePrimaryAction();
                                }}
                              >
                                {nextAction}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <SecondaryButton
                                  type="button"
                                  className="h-8 min-w-[88px] px-2.5 text-xs font-semibold tracking-[0.01em]"
                                  onClick={event => {
                                    event.stopPropagation();
                                    handlePrimaryAction();
                                  }}
                                >
                                  {primaryActionLabel}
                                </SecondaryButton>
                                <AppRowActionsDropdown
                                  triggerLabel="Mais ações"
                                  contentClassName="min-w-[240px]"
                                  items={[
                                    {
                                      label: `${nextAction} · prioritário`,
                                      onSelect: handlePrimaryAction,
                                    },
                                    {
                                      label: "Abrir cliente",
                                      onSelect: () =>
                                        navigate(
                                          `/customers?customerId=${order.customerId}`
                                        ),
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
                                      onSelect: () =>
                                        navigate(
                                          `/finances?serviceOrderId=${order.id}`
                                        ),
                                    },
                                    {
                                      label: "Enviar WhatsApp",
                                      onSelect: () =>
                                        navigate(
                                          `/whatsapp?customerId=${order.customerId}`
                                        ),
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
            title="Detalhe operacional de O.S."
            subtitle="Abra o modal operacional para resolver execução, cobrança e comunicação no mesmo contexto."
            compact
          >
            <p className="text-xs text-[var(--text-muted)]">
              {focusedOrder
                ? `Em foco: ${String(focusedOrder?.title ?? "O.S. sem título")} · ${getNextAction(focusedOrder)}`
                : "Selecione uma ordem para abrir a central operacional."}
            </p>
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
      />
    </PageWrapper>
  );
}
