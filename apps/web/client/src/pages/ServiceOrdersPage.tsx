import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";
import type { ServiceOrder } from "@/components/service-orders/service-order.types";
import { AppRowActionsDropdown } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppOperationalModal } from "@/components/operating-system/AppOperationalModal";
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

  if (["BLOCKED", "ON_HOLD", "PAUSED"].includes(status)) {
    return "Destravar execução";
  }
  if (status === "WAITING_CUSTOMER") return "Cobrar retorno";
  if (["OPEN", "ASSIGNED"].includes(status) && !order?.assignedToPersonId) {
    return "Atribuir técnico";
  }
  if (["OPEN", "ASSIGNED"].includes(status)) return "Iniciar execução";
  if (status === "IN_PROGRESS") return "Acompanhar execução";
  if (status === "DONE" && !hasCharge) return "Gerar cobrança";
  if (status === "DONE" && hasCharge) return "Notificar cliente";
  return "Revisar histórico";
}

export default function ServiceOrdersPage() {
  const [location, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<ServiceOrderTab>("pipeline");
  const [searchTerm, setSearchTerm] = useState("");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [focusedOrderId, setFocusedOrderId] = useState("");
  const [openOperationalModal, setOpenOperationalModal] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

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

  const unassigned = orders.filter(item => !item?.assignedToPersonId).length;
  const stalePipeline = orders.filter(item => {
    const status = normalizeStatus(item?.status);
    const updatedAt = safeDate(item?.updatedAt);
    if (!["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status)) return false;
    if (!updatedAt) return true;
    const diff = now.getTime() - updatedAt.getTime();
    return diff >= 1000 * 60 * 60 * 24 * 2;
  }).length;
  const blocked = orders.filter(item =>
    ["BLOCKED", "ON_HOLD", "PAUSED", "WAITING_CUSTOMER"].includes(
      normalizeStatus(item?.status)
    )
  ).length;
  const readyToCharge = orders.filter(
    item =>
      normalizeStatus(item?.status) === "DONE" &&
      !item?.financialSummary?.hasCharge
  ).length;

  const riskList = useMemo(() => {
    return orders
      .filter(item => {
        const status = normalizeStatus(item?.status);
        const updatedAt = safeDate(item?.updatedAt);
        const delayed =
          Boolean(updatedAt) &&
          now.getTime() - (updatedAt?.getTime() ?? 0) >=
            1000 * 60 * 60 * 24 * 3;
        return (
          ["BLOCKED", "ON_HOLD", "PAUSED", "WAITING_CUSTOMER"].includes(
            status
          ) || delayed
        );
      })
      .sort(
        (a, b) =>
          Number(b?.priority ?? 0) - Number(a?.priority ?? 0) ||
          (safeDate(a?.updatedAt)?.getTime() ?? 0) -
            (safeDate(b?.updatedAt)?.getTime() ?? 0)
      )
      .slice(0, 5);
  }, [now, orders]);

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

  const executeOrderStatus = async (
    status: "IN_PROGRESS" | "DONE" | "CANCELED"
  ) => {
    if (!focusedOrder?.id) return;
    try {
      setActionFeedback("Atualizando ordem de serviço...");
      await updateServiceOrder.mutateAsync({
        id: String(focusedOrder.id),
        status,
      } as any);
      setActionFeedback(`Status atualizado para ${getStatusLabel(status)}.`);
      await serviceOrdersQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na atualização.";
      setActionFeedback(message);
      toast.error(message);
    }
  };

  const topActions = [
    {
      title:
        blocked > 0
          ? `${blocked} O.S. com risco direto de travar o dia.`
          : "Sem travas críticas neste momento.",
      subtitle:
        blocked > 0
          ? "Ataque bloqueios e esperas de cliente para restaurar fluxo de execução."
          : "Mantenha cadência com revisão das O.S. em execução e prontas para cobrança.",
      action: (
        <button
          className="nexo-cta-secondary"
          onClick={() => {
            setActiveTab("attention");
          }}
        >
          Abrir fila de atenção
        </button>
      ),
    },
    {
      title: `${readyToCharge} concluída(s) aguardando cobrança`,
      subtitle:
        readyToCharge > 0
          ? "Converta execução em receita: gerar cobrança e confirmar envio ao cliente."
          : "Sem pendência financeira imediata de O.S. concluída.",
      action: (
        <button
          className="nexo-cta-secondary"
          onClick={() => navigate("/finances")}
        >
          Ir para Financeiro
        </button>
      ),
    },
    {
      title: `${unassigned} sem responsável · ${stalePipeline} sem avanço recente`,
      subtitle:
        "Distribua execução e remova ordens paradas há mais de 48h para proteger SLA.",
      action: (
        <button
          className="nexo-cta-secondary"
          onClick={() => setOpenCreate(true)}
        >
          Criar/Atribuir O.S.
        </button>
      ),
    },
  ];

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
      subtitle="Centro operacional de execução, bloqueios, conclusão e conversão financeira."
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
              <div className="max-h-[560px] overflow-y-auto">
                <AppDataTable>
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                      <tr>
                        <th className="p-3 text-left">Ordem</th>
                        <th className="text-left">Cliente</th>
                        <th className="text-left">Status</th>
                        <th className="text-left">Prioridade</th>
                        <th className="text-left">Próxima ação</th>
                        <th className="w-[120px] p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(order => {
                        const status = normalizeStatus(order?.status);
                        const hasCharge = Boolean(
                          order?.financialSummary?.hasCharge
                        );
                        const nextAction = getNextAction(order);
                        const priorityLabel = getPriorityLabel(
                          Number(order?.priority ?? 2)
                        );

                        const handlePrimaryAction = () => {
                          if (nextAction === "Gerar cobrança") {
                            setFocusedOrderId(String(order?.id ?? ""));
                            setOpenOperationalModal(true);
                            return;
                          }
                          if (
                            nextAction === "Cobrar retorno" ||
                            nextAction === "Notificar cliente"
                          ) {
                            setFocusedOrderId(String(order?.id ?? ""));
                            setOpenOperationalModal(true);
                            return;
                          }
                          setFocusedOrderId(String(order?.id ?? ""));
                          setOpenOperationalModal(true);
                        };

                        return (
                          <tr
                            key={String(order?.id)}
                            className="cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60"
                            onClick={() => {
                              setFocusedOrderId(String(order?.id ?? ""));
                              setOpenOperationalModal(true);
                            }}
                          >
                            <td className="p-3 align-top">
                              <p className="font-medium text-[var(--text-primary)]">
                                {String(order?.title ?? "Sem título")}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                #{String(order?.id ?? "—")}
                              </p>
                            </td>
                            <td className="align-top">
                              <p className="text-[var(--text-primary)]">
                                {String(order?.customer?.name ?? "Cliente")}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {order?.scheduledFor
                                  ? `Agendada: ${safeDate(order?.scheduledFor)?.toLocaleDateString("pt-BR")}`
                                  : "Sem data definida"}
                              </p>
                            </td>
                            <td className="align-top">
                              <AppStatusBadge
                                label={`${getStatusLabel(status)} · ${getOperationalSeverityLabel(getServiceOrderSeverity(order))}`}
                              />
                              {status === "DONE" && !hasCharge ? (
                                <p className="mt-1 text-xs text-[var(--dashboard-danger)]">
                                  Concluída sem cobrança ativa
                                </p>
                              ) : null}
                            </td>
                            <td className="align-top">
                              <AppPriorityBadge label={priorityLabel} />
                            </td>
                            <td className="align-top text-xs text-[var(--text-secondary)]">
                              <button
                                type="button"
                                className="font-medium text-[var(--accent-primary)] hover:underline"
                                onClick={event => {
                                  event.stopPropagation();
                                  handlePrimaryAction();
                                }}
                              >
                                {nextAction}
                              </button>
                            </td>
                            <td className="p-3 align-top">
                              <div className="flex items-center justify-end gap-2">
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
        onOpenChange={setOpenOperationalModal}
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
                setActionFeedback("Gerando cobrança...");
                await generateCharge.mutateAsync({ id: String(focusedOrder.id) } as any);
                setActionFeedback("Cobrança gerada com sucesso.");
                await serviceOrdersQuery.refetch();
              } catch (error) {
                setActionFeedback("Falha ao gerar cobrança.");
              }
              return;
            }
            await executeOrderStatus("IN_PROGRESS");
          },
          disabled: updateServiceOrder.isPending || generateCharge.isPending,
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
            onClick: () => void executeOrderStatus("CANCELED"),
            disabled: updateServiceOrder.isPending || !focusedOrder,
          },
        ]}
        feedback={actionFeedback}
      >
        <div className="space-y-4">
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
          <section className="border-t border-[var(--border-subtle)] pt-4">
            {focusedOrder ? (
              <ServiceOrderDetailsPanel os={focusedOrder as ServiceOrder} />
            ) : null}
          </section>
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
