import { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/design-system";
import { Input } from "@/components/ui/input";
import {
  buildServiceOrdersDeepLink,
  buildWhatsAppUrlFromServiceOrder,
  getWhatsAppContextDescription,
  getWhatsAppContextLabel,
  getWhatsAppPrefilledMessage,
  getServiceOrderIdFromUrl,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import {
  getChargeBadge,
  getFinancialStage,
  getOperationalStage,
  getPriorityScore,
  matchesFinancialFilter,
} from "@/lib/operations/operations.selectors";
import {
  MessageCircle,
  Plus,
  RefreshCw,
  ArrowLeft,
  BriefcaseBusiness,
  Search,
} from "lucide-react";
import { SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";

import ServiceOrderCard from "@/components/service-orders/ServiceOrderCard";
import ServiceOrderDetailsPanel from "@/components/service-orders/ServiceOrderDetailsPanel";

import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";

import type {
  FinancialFilter,
  ServiceOrder,
} from "@/components/service-orders/service-order.types";
import {
  getErrorMessage,
  getQueryUiState,
  normalizeArrayPayload,
} from "@/lib/query-helpers";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { generateServiceOrderActions } from "@/lib/smartActions";
import {
  compareOperationalSeverity,
  getServiceOrderDecision,
  getNextActionServiceOrder,
  getOperationalSeverityClasses,
  getOperationalSeverityLabel,
  getServiceOrderSeverity,
  type OperationalSeverity,
} from "@/lib/operations/operational-intelligence";
import { ActionBarWrapper } from "@/components/operating-system/ActionBar";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { NextActionCell } from "@/components/operating-system/NextActionCell";
import { ContextPanel } from "@/components/operating-system/ContextPanel";
import { runFlowChain, type ExecutionSnapshot } from "@/lib/operations/flowChain";
import { getServiceOrderExplainLayer } from "@/lib/operations/explain-layer";

const FINANCIAL_FILTERS: Array<{
  value: FinancialFilter;
  label: string;
}> = [
  { value: "ALL", label: "Todas" },
  { value: "NO_CHARGE", label: "Sem cobrança" },
  { value: "READY_TO_CHARGE", label: "Prontas para cobrar" },
  { value: "PENDING", label: "Pendentes" },
  { value: "PAID", label: "Pagas" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "CANCELED", label: "Canceladas" },
];

function sortOrders(items: ServiceOrder[]) {
  return [...items].sort((a, b) => {
    const severityDiff = compareOperationalSeverity(
      getServiceOrderSeverity(a),
      getServiceOrderSeverity(b)
    );
    if (severityDiff !== 0) return severityDiff;

    const priorityDiff = getPriorityScore(b) - getPriorityScore(a);
    if (priorityDiff !== 0) return priorityDiff;

    const aUpdated = new Date(
      a.updatedAt || a.createdAt || a.scheduledFor || 0
    ).getTime();
    const bUpdated = new Date(
      b.updatedAt || b.createdAt || b.scheduledFor || 0
    ).getTime();

    return bUpdated - aUpdated;
  });
}

function buildOperationalQueue(items: ServiceOrder[]) {
  return items.filter(
    item => item.status !== "DONE" && item.status !== "CANCELED"
  );
}

function extractServiceOrder(payload: unknown): ServiceOrder | null {
  if (!payload || typeof payload !== "object") return null;
  if ("id" in payload) return payload as ServiceOrder;
  if ("data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (nested && typeof nested === "object" && "id" in nested) {
      return nested as ServiceOrder;
    }
  }
  return null;
}

function appendReturnTo(url: string, returnTo: string) {
  const [pathname, rawQuery = ""] = url.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("returnTo", returnTo);
  return `${pathname}?${params.toString()}`;
}

export default function ServiceOrdersPage() {
  const { track } = useProductAnalytics();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const basePath = useMemo(() => {
    const [pathname] = location.split("?");
    return pathname === "/operations" ? "/operations" : "/service-orders";
  }, [location]);

  const deepLinkBase =
    basePath === "/operations" ? "operations" : "service-orders";

  const activeId = useMemo(
    () => getServiceOrderIdFromUrl(location),
    [location]
  );
  const customerIdFromUrl = useMemo(() => {
    const query = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(query).get("customerId");
  }, [location]);
  const appointmentIdFromUrl = useMemo(() => {
    const query = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(query).get("appointmentId");
  }, [location]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinancialFilter>("ALL");
  const [search, setSearch] = useState("");
  const [nextActionState, setNextActionState] = useState<
    "idle" | "running" | "done"
  >("idle");
  const [flowFeedback, setFlowFeedback] = useState<string | null>(null);
  const [flowSnapshots, setFlowSnapshots] = useState<ExecutionSnapshot[]>([]);
  const [whatsAppDraft, setWhatsAppDraft] = useState("");

  const activeRef = useRef<HTMLDivElement | null>(null);

  const ordersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const peopleQuery = trpc.people.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const activeOrderQuery = trpc.nexo.serviceOrders.getById.useQuery(
    { id: activeId ?? "" },
    {
      enabled: Boolean(activeId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers = useMemo(() => {
    return normalizeArrayPayload<{ id: string; name: string }>(
      customersQuery.data
    );
  }, [customersQuery.data]);

  const orders = useMemo(() => {
    return normalizeOrders<ServiceOrder>(ordersQuery.data);
  }, [ordersQuery.data]);

  const people = useMemo(() => {
    return normalizeArrayPayload<{ id: string; name: string }>(
      peopleQuery.data
    );
  }, [peopleQuery.data]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter(item => {
      if (
        customerIdFromUrl &&
        String(item.customerId ?? item.customer?.id ?? "") !== customerIdFromUrl
      ) {
        return false;
      }

      if (!matchesFinancialFilter(item, filter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        item.title,
        item.description,
        item.customer?.name,
        item.assignedTo?.name,
        item.status,
        item.financialSummary?.chargeStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [orders, filter, search, customerIdFromUrl]);

  const sorted = useMemo(() => sortOrders(filtered), [filtered]);

  const operationalQueue = useMemo(
    () => buildOperationalQueue(sorted),
    [sorted]
  );

  const activeOrder = useMemo(() => {
    const fromQuery = extractServiceOrder(activeOrderQuery.data);
    if (fromQuery) return fromQuery;

    return sorted.find(item => item.id === activeId) ?? null;
  }, [activeOrderQuery.data, sorted, activeId]);
  const activeOrderWhatsAppRoute = useMemo(() => {
    if (!activeOrder) return null;
    return {
      customerId: activeOrder.customerId ?? activeOrder.customer?.id ?? null,
      context:
        activeOrder.financialSummary?.chargeStatus === "OVERDUE"
          ? "overdue_charge"
          : activeOrder.financialSummary?.hasCharge
            ? "charge_pending"
            : "service_order_followup",
      amountCents: activeOrder.financialSummary?.chargeAmountCents ?? null,
      dueDate: activeOrder.financialSummary?.chargeDueDate
        ? String(activeOrder.financialSummary.chargeDueDate)
        : null,
      chargeId: activeOrder.financialSummary?.chargeId ?? null,
      serviceOrderId: activeOrder.id,
      returnTo: "/service-orders",
    } as const;
  }, [activeOrder]);
  const defaultWhatsAppMessage = useMemo(() => {
    if (!activeOrderWhatsAppRoute) return "";
    return getWhatsAppPrefilledMessage(
      { name: activeOrder?.customer?.name ?? "Cliente" },
      activeOrderWhatsAppRoute
    );
  }, [activeOrder?.customer?.name, activeOrderWhatsAppRoute]);

  useEffect(() => {
    setWhatsAppDraft(defaultWhatsAppMessage);
  }, [defaultWhatsAppMessage]);

  const totalOrders = orders.length;
  const totalVisible = sorted.length;
  const totalOperational = operationalQueue.length;

  const totalWithUrgency = useMemo(() => {
    return sorted.filter(
      item =>
        item.financialSummary?.chargeStatus === "OVERDUE" ||
        (item.status === "DONE" && !item.financialSummary?.hasCharge)
    ).length;
  }, [sorted]);

  const nextAction = useMemo(() => {
    if (activeOrder) {
      return getServiceOrderDecision(activeOrder);
    }

    const queueOrder = operationalQueue[0];
    if (queueOrder) {
      return {
        severity: "pending" as const,
        title: "Retomar fila operacional",
        description: "Sem foco definido: abra a próxima O.S. prioritária.",
        primaryAction: { key: "open_service_order" as const, label: "Abrir próxima O.S." },
        secondaryActions: [{ key: "open_queue" as const, label: "Abrir fila" }],
      };
    }

    return {
      severity: "healthy" as const,
      title: "Criar nova ordem de serviço",
      description:
        "Não há itens pendentes. Gere uma nova O.S. para manter o fluxo ativo.",
      primaryAction: { key: "open_queue" as const, label: "Nova O.S." },
      secondaryActions: [],
    };
  }, [activeOrder, operationalQueue]);

  const nextActionButtons = useMemo(() => {
    const resolve = (key: string) => {
      if (key === "generate_charge") {
        if (!activeOrder?.id) return null;
        return () => navigate(`/finances?serviceOrderId=${activeOrder.id}`);
      }
      if (key === "open_whatsapp") {
        const url = activeOrder ? buildWhatsAppUrlFromServiceOrder(activeOrder) : null;
        return () => (url ? openWhatsApp(url) : navigate("/whatsapp"));
      }
      if (key === "open_service_order" || key === "review_execution") {
        return () => {
          if (activeOrder?.id) openAsActive(activeOrder.id);
          else if (operationalQueue[0]?.id) openAsActive(operationalQueue[0].id);
        };
      }
      if (key === "open_queue") {
        if (!activeOrder) return () => setIsCreateOpen(true);
        return () => navigate("/service-orders");
      }
      if (key === "open_finances") return () => navigate("/finances");
      return null;
    };

    return [nextAction.primaryAction, ...nextAction.secondaryActions]
      .map((action, index) => ({
        ...action,
        index,
        onClick: resolve(action.key),
      }))
      .filter(
        (action): action is typeof action & { onClick: () => void } =>
          Boolean(action.onClick)
      );
  }, [activeOrder, navigate, nextAction, operationalQueue]);

  useEffect(() => {
    if (!activeId || !activeRef.current) return;

    activeRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeId]);

  useEffect(() => {
    if (!appointmentIdFromUrl || activeId) return;
    setIsCreateOpen(true);
  }, [appointmentIdFromUrl, activeId]);

  function openAsActive(id: string) {
    const nextUrl = (() => {
      const baseUrl = buildServiceOrdersDeepLink(id, deepLinkBase);
      if (!customerIdFromUrl) return baseUrl;
      return `${baseUrl}&customerId=${customerIdFromUrl}`;
    })();

    if (location !== nextUrl) {
      navigate(nextUrl);
    }
  }

  function closeActivePanel() {
    const target = customerIdFromUrl
      ? `${basePath}?customerId=${customerIdFromUrl}`
      : basePath;
    if (location !== target) {
      navigate(target);
    }
  }

  function openWhatsApp(url: string) {
    track("send_whatsapp", {
      screen: "service-orders",
      serviceOrderId: activeId,
      source: "service_order_next_action",
    });
    const returnTo = activeId ? `${basePath}?os=${activeId}` : basePath;
    navigate(appendReturnTo(url, returnTo));
  }

  const nextActionAccent =
    nextAction.severity === "critical"
      ? "text-red-700 dark:text-red-300"
      : nextAction.severity === "healthy"
        ? "text-[var(--text-secondary)] dark:text-[var(--text-secondary)]"
        : "text-amber-700 dark:text-amber-300";

  const smartPriorities = useMemo(
    () => [
      {
        id: "so-stalled",
        type: "stalled_service_orders" as const,
        title: "O.S. paradas",
        count: totalOperational,
        impactCents: totalOperational * 35000,
        ctaLabel: "Abrir próxima O.S.",
        ctaPath: "/service-orders",
        helperText: "Execução parada atrasa entrega e faturamento.",
      },
      {
        id: "so-overdue",
        type: "overdue_charges" as const,
        title: "Risco financeiro na execução",
        count: totalWithUrgency,
        impactCents: totalWithUrgency * 50000,
        ctaLabel: "Cobrar agora",
        ctaPath: "/finances",
        helperText: "O.S. concluída sem cobrança representa dinheiro parado.",
      },
      {
        id: "so-risk",
        type: "operational_risk" as const,
        title: "Deep-links com foco ativo",
        count: activeId ? 1 : 0,
        impactCents: 0,
        ctaLabel: "Revisar foco",
        ctaPath: "/service-orders",
        helperText: "Garantir foco certo evita retrabalho e desvio de fila.",
      },
    ],
    [activeId, totalOperational, totalWithUrgency]
  );

  const smartOperationalActions = useMemo(
    () =>
      generateServiceOrderActions({
        orders: sorted,
        onGenerateCharge: serviceOrderId =>
          navigate(`/finances?serviceOrderId=${serviceOrderId}`),
      }),
    [navigate, sorted]
  );

  async function refreshAll() {
    await Promise.all([
      utils.nexo.serviceOrders.list.invalidate(),
      activeId
        ? utils.nexo.serviceOrders.getById.invalidate({ id: activeId })
        : Promise.resolve(),
      utils.nexo.customers.list.invalidate(),
      utils.people.list.invalidate(),
      utils.finance.charges.list.invalidate(),
      utils.dashboard.alerts.invalidate(),
    ]);
  }

  const hasRenderableData =
    ordersQuery.data !== undefined ||
    customersQuery.data !== undefined ||
    peopleQuery.data !== undefined;

  const queryState = getQueryUiState(
    [ordersQuery, customersQuery, peopleQuery],
    hasRenderableData
  );

  const errorMessage =
    getErrorMessage(ordersQuery.error, "") ||
    getErrorMessage(customersQuery.error, "") ||
    getErrorMessage(peopleQuery.error, "") ||
    "Erro ao carregar a fila operacional.";

  return (
    <PageWrapper
      title="O que precisa ser executado agora"
      subtitle="Veja o que está parado na operação, por que isso impacta sua conversão e qual próximo passo deve acontecer agora."
      breadcrumb={[{ label: "Operação" }, { label: "Ordens de Serviço" }]}
    >
      <ActionBarWrapper
        secondaryActions={
          <>
            {activeId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={closeActivePanel}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para a lista
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void refreshAll()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </>
        }
        primaryAction={
          <ActionFeedbackButton
            state="idle"
            idleLabel="Nova O.S."
            onClick={() => {
              track("cta_click", {
                screen: "service-orders",
                ctaId: "hero_new_service_order",
              });
              setIsCreateOpen(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          />
        }
      />

      <SurfaceSection className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Direção de execução
            </p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">{nextAction.title}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {totalWithUrgency} itens com impacto imediato no fluxo operacional e financeiro.
            </p>
          </div>
          <Button type="button" onClick={nextActionButtons[0]?.onClick}>
            {nextAction.primaryAction.label}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {smartPriorities.slice(0, 3).map((priority) => (
            <span key={priority.id} className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">
              {priority.title}: {priority.count}
            </span>
          ))}
        </div>
      </SurfaceSection>

      {activeId && (
        <div className="nexo-surface-operational border-orange-200 bg-orange-50/85 p-3 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
          Você está visualizando uma O.S. em foco por deep-link. A lista
          continua estável, sem redirecionamento automático.
        </div>
      )}
      {activeId && !activeOrder && !activeOrderQuery.isLoading ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          Deep link inválido: a O.S. <strong>{activeId}</strong> não foi
          encontrada. Revise o link ou volte para a lista.
        </SurfaceSection>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SurfaceSection><div className="text-xs uppercase tracking-wide text-muted-foreground">Total em execução</div><div className="mt-2 text-2xl font-semibold">{totalOrders}</div></SurfaceSection>
        <SurfaceSection><div className="text-xs uppercase tracking-wide text-muted-foreground">Visíveis agora</div><div className="mt-2 text-2xl font-semibold">{totalVisible}</div></SurfaceSection>
        <SurfaceSection><div className="text-xs uppercase tracking-wide text-muted-foreground">O que precisa andar</div><div className="mt-2 text-2xl font-semibold">{totalOperational}</div></SurfaceSection>
        <SurfaceSection><div className="text-xs uppercase tracking-wide text-muted-foreground">Impacto imediato</div><div className="mt-2 text-2xl font-semibold">{totalWithUrgency}</div></SurfaceSection>
      </div>

      <ActionBarWrapper
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por título, cliente, responsável ou status"
        searchSlot={
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por título, cliente, responsável ou status"
              className="w-full pl-9"
            />
          </div>
        }
        filtersSlot={
          <div className="flex flex-wrap gap-2">
            {FINANCIAL_FILTERS.map(item => (
              <Button
                key={item.value}
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        }
      />

      <SurfaceSection
        className={getOperationalSeverityClasses(nextAction.severity)}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${nextActionAccent}`}
            >
              Próxima ação •{" "}
              {getOperationalSeverityLabel(
                nextAction.severity as OperationalSeverity
              )}
            </p>
            <p className={`mt-1 font-medium ${nextActionAccent}`}>
              {nextAction.title}
            </p>
            <p className={`text-sm ${nextActionAccent}`}>
              {nextAction.description}
            </p>
          </div>
          <ActionFeedbackButton
            state={
              nextActionState === "running"
                ? "loading"
                : nextActionState === "done"
                  ? "success"
                  : "idle"
            }
            idleLabel={nextAction.primaryAction.label}
            loadingLabel="Abrindo..."
            successLabel="Ação iniciada"
            onClick={() => {
              track("cta_click", {
                screen: "service-orders",
                ctaId: "next_action_primary",
                label: nextAction.primaryAction.label,
              });
              void (async () => {
                setNextActionState("running");
                const result = await runFlowChain({
                  actionLabel: nextAction.primaryAction.label,
                  actionId:
                    nextAction.primaryAction.key === "generate_charge"
                      ? "generate_charge"
                      : "complete_service",
                  executionKey: activeOrder?.id
                    ? `service-orders:${activeOrder.id}:${nextAction.primaryAction.key}`
                    : `service-orders:queue:${nextAction.primaryAction.key}`,
                  facts: {
                    hasOpenCharge: Boolean(activeOrder?.financialSummary?.hasCharge),
                    isChargePaid: activeOrder?.financialSummary?.chargeStatus === "PAID",
                  },
                  onExecute: () => nextActionButtons[0]?.onClick?.(),
                  throwOnError: false,
                  nextSuggestedAction:
                    activeOrder?.status === "DONE"
                      ? "Gerar cobrança e enviar WhatsApp"
                      : undefined,
                });
                setFlowSnapshots(result.snapshots);
                setFlowFeedback(
                  result.latestStatus === "success"
                    ? result.suggestions[0]
                      ? `✔ ${result.completedAction} concluída. Próximo passo: ${result.suggestions[0].label}.`
                      : `✔ ${result.completedAction} concluída com sucesso.`
                    : `Falha ao executar ${result.completedAction}. Revise o erro e tente novamente.`
                );
                setNextActionState(result.latestStatus === "success" ? "done" : "idle");
                if (result.latestStatus === "success") {
                  setTimeout(() => setNextActionState("idle"), 1400);
                }
              })();
            }}
          />
        </div>
        {nextActionButtons.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {nextActionButtons.slice(1).map(action => (
              <Button
                key={action.key}
                type="button"
                size="sm"
                variant="outline"
                className="opacity-80"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
        {nextAction.invalidState ? (
          <div className="mt-3 rounded-md border border-red-300/70 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-semibold">{nextAction.invalidState.title}</p>
            <p className="mt-1">{nextAction.invalidState.description}</p>
          </div>
        ) : null}
      </SurfaceSection>
      {flowFeedback ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          {flowFeedback}
        </div>
      ) : null}
      {flowSnapshots.length > 0 ? (
        <div className="rounded-md border border-border/70 bg-card/50 px-3 py-2 text-xs">
          <p className="font-semibold text-foreground">Execução da cadeia</p>
          <div className="mt-2 space-y-1">
            {flowSnapshots.slice(-4).map((snapshot, index) => (
              <p key={`${snapshot.actionId}-${snapshot.timestamp}-${index}`} className="text-muted-foreground">
                {snapshot.status === "success"
                  ? "✔"
                  : snapshot.status === "failed"
                    ? "✖"
                    : snapshot.status === "running"
                      ? "…"
                      : "○"}{" "}
                {snapshot.label}
                {snapshot.error ? ` — ${snapshot.error}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {queryState.hasBackgroundUpdate ? (
        <div className="nexo-info-banner rounded p-3 text-sm">
          Atualizando dados em segundo plano...
        </div>
      ) : null}

      {queryState.hasError && !queryState.shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      {queryState.isInitialLoading ? (
        <SurfaceSection className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
          Carregando ordens de serviço...
        </SurfaceSection>
      ) : queryState.shouldBlockForError ? (
        <SurfaceSection className="border-red-200 text-sm text-red-700 dark:border-red-900/40 dark:text-red-300">
          {errorMessage}
        </SurfaceSection>
      ) : sorted.length === 0 ? (
        <SurfaceSection className="space-y-3">
          <EmptyState
            icon={<BriefcaseBusiness className="h-7 w-7" />}
            title="Ainda não há execução ativa"
            description="Comece criando sua primeira ordem de serviço para sair do planejamento e entrar em entrega com cobrança."
            action={{
              label: "Criar primeira O.S.",
              onClick: () => setIsCreateOpen(true),
            }}
            secondaryAction={{
              label: "Ver sem filtros",
              onClick: () => {
                setFilter("ALL");
                setSearch("");
              },
            }}
          />

        </SurfaceSection>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <div className="space-y-4">
            {sorted.map(os => {
              const isActive = os.id === activeId;
              const chargeBadge = getChargeBadge(os.financialSummary);
              const operationalStage = getOperationalStage(os);
              const financialStage = getFinancialStage(os);
              const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);
              const itemSeverity = getServiceOrderSeverity(os);
              const itemNextAction = getNextActionServiceOrder(os);

              return (
                <div
                  key={os.id}
                  ref={isActive ? activeRef : null}
                  className={`${isActive ? "rounded-2xl ring-2 ring-orange-300" : ""} ${getOperationalSeverityClasses(itemSeverity)}`}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                      Severidade: {getOperationalSeverityLabel(itemSeverity)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
                      Próxima ação: {itemNextAction.label}
                    </span>
                  </div>
                  <div className="mb-2 px-1">
                    <NextActionCell entity="service_order" item={os} />
                  </div>
                  <ServiceOrderCard
                    os={os}
                    isProcessing={false}
                    chargeBadge={chargeBadge}
                    operationalStage={operationalStage}
                    financialStage={financialStage}
                    onEdit={setEditId}
                    onOpenDeepLink={openAsActive}
                    onOpenWhatsApp={
                      whatsappUrl ? url => openWhatsApp(url) : undefined
                    }
                    isUpdating={false}
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {activeOrder ? (
              <ServiceOrderDetailsPanel os={activeOrder} />
            ) : (
              <SurfaceSection className="space-y-3">
                <div className="text-sm font-medium">
                  Selecione uma O.S. para abrir o hub operacional.
                </div>
                <p className="text-sm text-muted-foreground">
                  Aqui você acompanha execução, cobrança, pagamento, timeline e ação seguinte sem navegar no escuro.
                </p>
                {operationalQueue[0] ? (
                  <Button onClick={() => openAsActive(operationalQueue[0].id)}>
                    Abrir próxima da fila
                  </Button>
                ) : null}
              </SurfaceSection>
            )}

            {activeOrder?.customer?.phone ? (
              <SurfaceSection>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Atalho rápido
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const url = buildWhatsAppUrlFromServiceOrder(activeOrder);
                    if (url) {
                      navigate(appendReturnTo(url, `${basePath}?os=${activeOrder.id}`));
                    }
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir conversa da O.S.
                </Button>
              </SurfaceSection>
            ) : null}
          </div>
        </div>
      )}

      <CreateServiceOrderModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => void refreshAll()}
        initialCustomerId={customerIdFromUrl}
        appointmentId={appointmentIdFromUrl}
        customers={customers}
        people={people}
      />

      <EditServiceOrderModal
        isOpen={Boolean(editId)}
        onClose={() => setEditId(null)}
        onSuccess={() => void refreshAll()}
        serviceOrderId={editId}
        people={people}
      />

      <ContextPanel
        open={Boolean(activeOrder)}
        onOpenChange={open => {
          if (!open) closeActivePanel();
        }}
        title={activeOrder?.title ?? "Contexto da ordem de serviço"}
        subtitle={activeOrder?.customer?.name ?? "Execução contínua"}
        statusLabel={activeOrder?.status ?? "—"}
        summary={
          activeOrder
            ? [
                { label: "Etapa operacional", value: getOperationalStage(activeOrder).label },
                { label: "Etapa financeira", value: getFinancialStage(activeOrder).label },
                { label: "Próxima ação", value: getNextActionServiceOrder(activeOrder).label },
                { label: "Prioridade", value: String(getPriorityScore(activeOrder)) },
              ]
            : []
        }
        primaryAction={
          nextActionButtons[0]
            ? {
                label: nextActionButtons[0].label,
                onClick: nextActionButtons[0].onClick,
              }
            : undefined
        }
        secondaryActions={nextActionButtons.slice(1).map(action => ({
          label: action.label,
          onClick: action.onClick,
        }))}
        timeline={
          activeOrder
            ? [
                { id: "created", label: "Criada", description: String(activeOrder.createdAt ?? "—"), source: "system" },
                { id: "updated", label: "Última atualização", description: String(activeOrder.updatedAt ?? "—"), source: "system" },
                { id: "scheduled", label: "Agendada para", description: String(activeOrder.scheduledFor ?? "—"), source: "user" },
              ]
            : []
        }
        explainLayer={activeOrder ? getServiceOrderExplainLayer(activeOrder) : undefined}
        whatsAppPreview={
          activeOrder && activeOrderWhatsAppRoute
            ? {
                contextLabel: getWhatsAppContextLabel(activeOrderWhatsAppRoute.context),
                contextDescription: getWhatsAppContextDescription(activeOrderWhatsAppRoute),
                message: whatsAppDraft,
                editable: true,
                onMessageChange: setWhatsAppDraft,
              }
            : undefined
        }
      />
    </PageWrapper>
  );
}
