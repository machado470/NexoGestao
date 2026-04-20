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
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  AppDataTable,
  AppFiltersBar,
  AppListBlock,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPriorityBadge,
  appSelectionPillClasses,
  AppSecondaryTabs,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { getDayWindow, inRange, safeDate } from "@/lib/operational/kpi";
import { Input } from "@/components/ui/input";
import {
  getOperationalSeverityLabel,
  getServiceOrderSeverity,
} from "@/lib/operations/operational-intelligence";

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

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { retry: false }
  );

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

  return (
    <PageWrapper
      title="Ordens de Serviço"
      subtitle="Centro operacional de execução, bloqueios, conclusão e conversão financeira."
    >
      <div className="space-y-4">
        <AppPageHeader
          title="Painel operacional de ordens de serviço"
          description="Visual de execução para enxergar gargalos, risco, próxima ação e fechamento financeiro sem quebrar os fluxos atuais."
          cta={
            <ActionFeedbackButton
              state="idle"
              idleLabel="Criar nova O.S."
              onClick={() => setOpenCreate(true)}
            />
          }
        />

        <AppSecondaryTabs
          items={[
            { value: "pipeline", label: "Pipeline" },
            { value: "execution", label: "Em execução" },
            { value: "attention", label: "Atenção" },
            { value: "done", label: "Concluídas" },
            { value: "history", label: "Histórico" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        <OperationalTopCard
          contextLabel="Direção da execução"
          title={
            activeTab === "pipeline"
              ? "Organizar pipeline e evitar fila parada"
              : activeTab === "execution"
                ? "Acelerar ordens em execução"
                : activeTab === "attention"
                  ? "Destravar ordens críticas agora"
                  : activeTab === "done"
                    ? "Converter concluídas em cobrança"
                    : "Auditar histórico de execução"
          }
          description={
            activeTab === "pipeline"
              ? "Foco em atribuição, distribuição da carga e avanço contínuo das ordens abertas."
              : activeTab === "execution"
                ? "Acompanhe ordens ativas para reduzir bloqueio e manter previsibilidade do turno."
                : activeTab === "attention"
                  ? "Concentre a operação em bloqueios, esperas de cliente e itens sem avanço."
                  : activeTab === "done"
                    ? "Valide fechamento, cobrança gerada e comunicação para capturar receita."
                    : "Use histórico para detectar padrões de atraso e corrigir recorrências."
          }
          primaryAction={
            <ActionFeedbackButton
              state="idle"
              idleLabel={
                activeTab === "execution"
                  ? "Revisar ordens ativas"
                  : activeTab === "attention"
                    ? "Priorizar travadas"
                    : activeTab === "done"
                      ? "Abrir prontas p/ cobrança"
                      : activeTab === "history"
                        ? "Voltar ao pipeline"
                        : "Distribuir pipeline"
              }
              onClick={() => {
                if (activeTab === "done") navigate("/finances");
                else if (activeTab === "history") setActiveTab("pipeline");
                else if (activeTab === "pipeline") setActiveTab("execution");
                else setActiveTab("attention");
              }}
            />
          }
        />

        <AppSectionBlock
          title="Leitura operacional"
          subtitle="Onde está o gargalo agora, quais ordens estão em risco e qual ação acelera execução + caixa."
        >
          <AppListBlock items={topActions} />
          <div className="mt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Fila crítica
            </p>
            <AppListBlock
              compact
              showPlaceholders={false}
              items={
                riskList.length > 0
                  ? riskList.map(item => ({
                      title: String(item?.title ?? "O.S. sem título"),
                      subtitle: `${String(item?.customer?.name ?? "Cliente")} · ${getStatusLabel(
                        normalizeStatus(item?.status)
                      )}`,
                      action: (
                        <button
                          className="nexo-cta-secondary"
                          onClick={() =>
                            setFocusedOrderId(String(item?.id ?? ""))
                          }
                        >
                          Abrir O.S.
                        </button>
                      ),
                    }))
                  : [
                      {
                        title: "Sem ordens críticas",
                        subtitle:
                          "A fila de risco está controlada neste momento.",
                      },
                    ]
              }
            />
          </div>
        </AppSectionBlock>

        <div className="space-y-4">
          <AppSectionBlock
            title={
              activeTab === "history"
                ? "Histórico operacional de O.S."
                : "Execução das ordens de serviço"
            }
            subtitle="Lista principal com filtros de estado, prioridade, cliente e janela para decisão rápida."
          >
            <AppFiltersBar className="mb-3 gap-3">
              <div className="min-w-[220px] flex-1">
                <Input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Buscar por título, cliente ou ID"
                  className="h-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "all", label: "Tudo" },
                  { key: "today", label: "Hoje" },
                  { key: "next7", label: "Próximos 7 dias" },
                  { key: "overdue", label: "Atrasadas" },
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    className={appSelectionPillClasses(
                      windowFilter === item.key
                    )}
                    onClick={() => setWindowFilter(item.key as WindowFilter)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
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

              <select
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--text-primary)]"
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
            </AppFiltersBar>

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
                            navigate(`/finances?serviceOrderId=${order.id}`);
                            return;
                          }
                          if (
                            nextAction === "Cobrar retorno" ||
                            nextAction === "Notificar cliente"
                          ) {
                            navigate(
                              `/whatsapp?customerId=${order.customerId}`
                            );
                            return;
                          }
                          setFocusedOrderId(String(order?.id ?? ""));
                        };

                        return (
                          <tr
                            key={String(order?.id)}
                            className="cursor-pointer border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60"
                            onClick={() =>
                              setFocusedOrderId(String(order?.id ?? ""))
                            }
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
                              {nextAction}
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
            title="Workspace da O.S. em foco"
            subtitle="Resumo da execução conectado com cliente, agenda, cobrança e comunicação."
            compact
          >
            {focusedOrder ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {String(focusedOrder?.title ?? "O.S. sem título")}
                    </p>
                    <AppStatusBadge
                      label={getStatusLabel(
                        normalizeStatus(focusedOrder?.status)
                      )}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Cliente: {String(focusedOrder?.customer?.name ?? "Cliente")}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Próxima ação: {getNextAction(focusedOrder)}
                  </p>
                  {normalizeStatus(focusedOrder?.status) === "DONE" &&
                  !focusedOrder?.financialSummary?.hasCharge ? (
                    <p className="mt-1 text-xs font-medium text-[var(--dashboard-danger)]">
                      Esta O.S. concluída ainda não gerou cobrança.
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    className="nexo-cta-primary"
                    onClick={() =>
                      navigate(`/finances?serviceOrderId=${focusedOrder.id}`)
                    }
                  >
                    Ir para cobrança
                  </button>
                  <button
                    type="button"
                    className="nexo-cta-secondary"
                    onClick={() =>
                      navigate(
                        `/customers?customerId=${focusedOrder.customerId}`
                      )
                    }
                  >
                    Abrir cliente
                  </button>
                </div>

                <ServiceOrderDetailsPanel os={focusedOrder as ServiceOrder} />
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Selecione uma ordem para abrir o workspace operacional completo
                e executar o próximo passo.
              </p>
            )}
          </AppSectionBlock>
        </div>
      </div>

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
