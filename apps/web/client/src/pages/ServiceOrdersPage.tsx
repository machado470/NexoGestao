import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import { AppPageShell, AppSectionCard, AppTimeline, AppTimelineItem } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  explainOperationalError,
  OperationalInlineFeedback,
  OperationalNextAction,
  OperationalRelationSummary,
} from "@/components/operating-system/OperationalRefinementBlocks";
import {
  AppOperationalBar,
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppPageLoadingState,
  appSelectionPillClasses,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { Button, SecondaryButton } from "@/components/design-system";
import { safeDate } from "@/lib/operational/kpi";
import { toast } from "sonner";

type PeriodFilter = "all" | "today" | "7d" | "overdue";
type StatusFilter = "all" | "created" | "in_progress" | "paused" | "done";
type PriorityFilter = "all" | "high" | "medium" | "low";

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function getStatusLabel(status: string) {
  if (["OPEN", "ASSIGNED"].includes(status)) return "Aberta";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (["PAUSED", "BLOCKED", "ON_HOLD"].includes(status)) return "Parada";
  if (status === "DONE") return "Concluída";
  if (status === "CANCELED") return "Cancelada";
  return "Sem status";
}

function getPriorityLabel(priority: number) {
  if (priority >= 4) return "HIGH" as const;
  if (priority === 3) return "MEDIUM" as const;
  return "LOW" as const;
}

function formatDateLabel(value: unknown, fallback = "—") {
  const parsed = safeDate(value);
  if (!parsed) return fallback;
  return parsed.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDurationLabel(start: Date | null, end: Date | null) {
  if (!start) return "Não iniciado";
  const final = end ?? new Date();
  const diffMin = Math.max(1, Math.floor((final.getTime() - start.getTime()) / (1000 * 60)));
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function ServiceOrdersPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [searchTerm, setSearchTerm] = useOperationalMemoryState("nexo.service-orders.search.v3", "");
  const [statusFilter, setStatusFilter] = useOperationalMemoryState<StatusFilter>("nexo.service-orders.status-filter.v3", "all");
  const [responsibleFilter, setResponsibleFilter] = useOperationalMemoryState("nexo.service-orders.responsible-filter.v3", "all");
  const [customerFilter, setCustomerFilter] = useOperationalMemoryState("nexo.service-orders.customer-filter.v3", "all");
  const [priorityFilter, setPriorityFilter] = useOperationalMemoryState<PriorityFilter>("nexo.service-orders.priority-filter.v3", "all");
  const [periodFilter, setPeriodFilter] = useOperationalMemoryState<PeriodFilter>("nexo.service-orders.period-filter.v3", "all");
  const [focusedOrderId, setFocusedOrderId] = useOperationalMemoryState<string | null>("nexo.service-orders.focused-id.v3", null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionFeedbackTone, setActionFeedbackTone] = useState<"neutral" | "success" | "error">("neutral");

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const focusedTimelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: String(focusedOrderId ?? ""), limit: 6 },
    { retry: false, enabled: Boolean(focusedOrderId) }
  );
  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation();
  const generateCharge = trpc.nexo.serviceOrders.generateCharge.useMutation();

  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const orders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const focusedTimeline = useMemo(() => normalizeArrayPayload<any>(focusedTimelineQuery.data), [focusedTimelineQuery.data]);

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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const next7End = new Date(todayEnd);
  next7End.setDate(next7End.getDate() + 7);

  const enrichedOrders = useMemo(
    () =>
      orders.map(order => {
        const status = normalizeStatus(order?.status);
        const priority = getPriorityLabel(Number(order?.priority ?? 2));
        const start = safeDate(order?.startedAt ?? order?.executionStartedAt ?? null);
        const end = safeDate(order?.endedAt ?? order?.finishedAt ?? null);
        const scheduled = safeDate(order?.scheduledFor);
        const overdue = Boolean(scheduled && scheduled < now && ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status));
        const paused = ["PAUSED", "BLOCKED", "ON_HOLD"].includes(status);
        const hasOwner = Boolean(order?.assignedToPersonId);
        const hasCharge = Boolean(order?.financialSummary?.hasCharge);
        const ownerName = hasOwner
          ? String(people.find(person => String(person?.id ?? "") === String(order?.assignedToPersonId ?? ""))?.name ?? "Responsável")
          : "Sem responsável";
        return {
          raw: order,
          id: String(order?.id ?? ""),
          customerName: String(order?.customer?.name ?? "Cliente"),
          serviceName: String(order?.title ?? order?.serviceName ?? "Serviço"),
          status,
          statusLabel: getStatusLabel(status),
          priority,
          ownerName,
          hasOwner,
          hasCharge,
          overdue,
          paused,
          scheduled,
          startedAt: start,
          durationLabel: formatDurationLabel(start, end),
          nextActionLabel:
            status === "DONE" && !hasCharge
              ? "Gerar cobrança"
              : ["OPEN", "ASSIGNED"].includes(status)
                ? "Iniciar"
                : status === "IN_PROGRESS"
                  ? "Concluir"
                  : paused
                    ? "Retomar"
                    : "Acompanhar",
        };
      }),
    [now, orders, people]
  );

  const filteredOrders = useMemo(() => {
    let base = enrichedOrders;

    if (statusFilter !== "all") {
      base = base.filter(item => {
        if (statusFilter === "created") return ["OPEN", "ASSIGNED"].includes(item.status);
        if (statusFilter === "in_progress") return item.status === "IN_PROGRESS";
        if (statusFilter === "paused") return item.paused;
        if (statusFilter === "done") return item.status === "DONE";
        return true;
      });
    }

    if (responsibleFilter !== "all") {
      base = base.filter(item => String(item.raw?.assignedToPersonId ?? "") === responsibleFilter);
    }

    if (customerFilter !== "all") {
      base = base.filter(item => String(item.raw?.customerId ?? "") === customerFilter);
    }

    if (priorityFilter !== "all") {
      base = base.filter(item => item.priority.toLowerCase() === priorityFilter);
    }

    if (periodFilter !== "all") {
      base = base.filter(item => {
        if (!item.scheduled) return false;
        if (periodFilter === "today") return item.scheduled >= todayStart && item.scheduled <= todayEnd;
        if (periodFilter === "7d") return item.scheduled >= todayStart && item.scheduled <= next7End;
        return item.overdue;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter(item =>
        item.id.includes(term) || item.customerName.toLowerCase().includes(term) || item.serviceName.toLowerCase().includes(term)
      );
    }

    return [...base].sort((a, b) => {
      const score = (item: (typeof base)[number]) =>
        (item.overdue ? 100 : 0) +
        (item.paused ? 80 : 0) +
        (!item.hasOwner ? 70 : 0) +
        (item.status === "DONE" && !item.hasCharge ? 60 : 0) +
        (item.status === "IN_PROGRESS" ? 40 : 0);
      return score(b) - score(a);
    });
  }, [customerFilter, enrichedOrders, next7End, periodFilter, priorityFilter, responsibleFilter, searchTerm, statusFilter, todayEnd, todayStart]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setFocusedOrderId(null);
      return;
    }
    const hasFocused = filteredOrders.some(item => item.id === focusedOrderId);
    if (!hasFocused) setFocusedOrderId(filteredOrders[0]?.id ?? null);
  }, [filteredOrders, focusedOrderId, setFocusedOrderId]);

  const focusedOrder = useMemo(
    () => filteredOrders.find(item => item.id === focusedOrderId) ?? filteredOrders[0] ?? null,
    [filteredOrders, focusedOrderId]
  );

  const immediateAlerts = useMemo(() => {
    const delayed = enrichedOrders.filter(item => item.overdue);
    const paused = enrichedOrders.filter(item => item.paused);
    const noOwner = enrichedOrders.filter(item => !item.hasOwner);
    const doneNoCharge = enrichedOrders.filter(item => item.status === "DONE" && !item.hasCharge);

    const all = [
      {
        key: "delayed",
        title: "O.S. atrasadas",
        count: delayed.length,
        context: "Execuções fora da janela planejada.",
        impact: "Aumenta retrabalho e quebra previsibilidade da operação.",
        ctaLabel: "Ver atrasadas",
        action: () => setPeriodFilter("overdue"),
      },
      {
        key: "paused",
        title: "O.S. paradas",
        count: paused.length,
        context: "Ordens pausadas/bloqueadas sem retomada.",
        impact: "Equipe parada e fila de execução crescendo.",
        ctaLabel: "Filtrar paradas",
        action: () => setStatusFilter("paused"),
      },
      {
        key: "no-owner",
        title: "O.S. sem responsável",
        count: noOwner.length,
        context: "Ordens criadas sem técnico definido.",
        impact: "Ninguém puxa a execução e o prazo escapa.",
        ctaLabel: "Distribuir responsáveis",
        action: () => setResponsibleFilter("all"),
      },
      {
        key: "done-no-charge",
        title: "Concluídas sem cobrança",
        count: doneNoCharge.length,
        context: "Serviço entregue sem acionamento financeiro.",
        impact: "Receita em risco por atraso na cobrança.",
        ctaLabel: "Ativar cobrança",
        action: () => {
          const candidate = doneNoCharge[0];
          if (candidate) setFocusedOrderId(candidate.id);
        },
      },
    ].filter(item => item.count > 0);

    return all.slice(0, 3);
  }, [enrichedOrders, setFocusedOrderId]);

  const nextBestAction = useMemo(() => {
    const candidate = filteredOrders[0];
    if (!candidate) {
      return {
        title: "Nenhuma recomendação no momento",
        reason: "Sem O.S. no recorte atual.",
        impact: "Ajuste filtros ou crie uma nova O.S. para seguir execução.",
        ctaLabel: "Nova O.S.",
        action: () => setOpenCreate(true),
      };
    }
    if (candidate.status === "DONE" && !candidate.hasCharge) {
      return {
        title: `Concluir financeiro da O.S. #${candidate.id}`,
        reason: "Serviço finalizado ainda sem cobrança gerada.",
        impact: "Libera receita e fecha o ciclo operacional.",
        ctaLabel: "Gerar cobrança",
        action: () => void handleGenerateCharge(candidate.id),
      };
    }
    if (["OPEN", "ASSIGNED"].includes(candidate.status)) {
      return {
        title: `Iniciar O.S. #${candidate.id}`,
        reason: "Ordem criada aguardando início de execução.",
        impact: "Tira item da fila e acelera entrega.",
        ctaLabel: "Iniciar agora",
        action: () => void handleStatusChange(candidate.id, "IN_PROGRESS"),
      };
    }
    return {
      title: `Concluir O.S. #${candidate.id}`,
      reason: "Execução em andamento e pronta para fechamento.",
      impact: "Atualiza operação e prepara cobrança.",
      ctaLabel: "Concluir",
      action: () => void handleStatusChange(candidate.id, "DONE"),
    };
  }, [filteredOrders]);

  const kpis = useMemo(() => {
    const open = enrichedOrders.filter(item => ["OPEN", "ASSIGNED"].includes(item.status)).length;
    const inProgress = enrichedOrders.filter(item => item.status === "IN_PROGRESS").length;
    const overdue = enrichedOrders.filter(item => item.overdue).length;
    const doneToday = enrichedOrders.filter(item => {
      if (item.status !== "DONE") return false;
      const updated = safeDate(item.raw?.updatedAt ?? item.raw?.finishedAt);
      return Boolean(updated && updated >= todayStart && updated <= todayEnd);
    }).length;
    return [
      { label: "Abertas", value: open },
      { label: "Em andamento", value: inProgress },
      { label: "Atrasadas", value: overdue },
      { label: "Concluídas hoje", value: doneToday },
    ];
  }, [enrichedOrders, todayEnd, todayStart]);

  async function handleStatusChange(orderId: string, status: "IN_PROGRESS" | "PAUSED" | "DONE") {
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Atualizando O.S....");
      await updateServiceOrder.mutateAsync({ id: orderId, status } as any);
      setActionFeedbackTone("success");
      setActionFeedback(`Status atualizado para ${getStatusLabel(status)}.`);
      await Promise.all([serviceOrdersQuery.refetch(), focusedTimelineQuery.refetch()]);
    } catch (error) {
      const message = explainOperationalError({
        fallback: error instanceof Error ? error.message : "Falha ao atualizar O.S.",
        cause: "Não foi possível executar a ação operacional.",
        suggestion: "Tente novamente em alguns segundos.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  }

  async function handleGenerateCharge(orderId: string) {
    try {
      setActionFeedbackTone("neutral");
      setActionFeedback("Gerando cobrança...");
      await generateCharge.mutateAsync({ id: orderId } as any);
      setActionFeedbackTone("success");
      setActionFeedback("Cobrança gerada com sucesso.");
      await Promise.all([serviceOrdersQuery.refetch(), focusedTimelineQuery.refetch()]);
    } catch (error) {
      const message = explainOperationalError({
        fallback: error instanceof Error ? error.message : "Falha ao gerar cobrança.",
        cause: "Não foi possível conectar esta O.S. ao financeiro.",
        suggestion: "Verifique se a O.S. está concluída e tente novamente.",
      });
      setActionFeedbackTone("error");
      setActionFeedback(message);
      toast.error(message);
    }
  }

  return (
    <AppPageShell>
      <PageWrapper title="Ordens de Serviço" subtitle="Centro de execução da operação, cobrança e comunicação.">
        <div className="space-y-4">
          <AppOperationalHeader
            title="Ordens de Serviço"
            description="Veja o estado da operação e execute a próxima ação sem trocar de tela."
            primaryAction={<ActionFeedbackButton state="idle" idleLabel="Nova O.S." onClick={() => setOpenCreate(true)} />}
          />

          {immediateAlerts.length > 0 ? (
            <AppSectionBlock title="Atenção imediata" subtitle="Apenas o que exige ação agora." compact>
              <div className="grid gap-3 lg:grid-cols-3">
                {immediateAlerts.map(alert => (
                  <AppSectionCard key={alert.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{alert.title}</p>
                      <span className="text-base font-semibold text-[var(--text-primary)]">{alert.count}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{alert.context}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Impacto: {alert.impact}</p>
                    <SecondaryButton type="button" className="h-7 px-2.5 text-[11px]" onClick={alert.action}>
                      {alert.ctaLabel}
                    </SecondaryButton>
                  </AppSectionCard>
                ))}
              </div>
            </AppSectionBlock>
          ) : null}

          <AppSectionBlock title="Próxima melhor ação" subtitle="Recomendação única para manter execução e receita fluindo." compact>
            <OperationalNextAction
              title={nextBestAction.title}
              reason={nextBestAction.reason}
              impact={nextBestAction.impact}
              urgency="Prioridade do turno"
            />
            <div className="mt-3">
              <Button type="button" className="h-8 px-3 text-xs" onClick={nextBestAction.action}>
                {nextBestAction.ctaLabel}
              </Button>
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="KPIs operacionais" subtitle="Leitura rápida do estado atual da execução." compact>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map(item => (
                <AppSectionCard key={item.label} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
                  <p className="text-2xl font-semibold text-[var(--text-primary)]">{item.value}</p>
                </AppSectionCard>
              ))}
            </div>
          </AppSectionBlock>

          <AppOperationalBar
            tabs={[{ value: "all", label: "Operação" }]}
            activeTab="all"
            onTabChange={() => undefined}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por O.S., cliente ou serviço"
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
                    className={appSelectionPillClasses(periodFilter === item.key)}
                    onClick={() => setPeriodFilter(item.key as PeriodFilter)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            }
            advancedFiltersLabel="Filtros"
            advancedFiltersContent={
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs" value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="all">Status: todos</option>
                  <option value="created">Status: abertas</option>
                  <option value="in_progress">Status: em andamento</option>
                  <option value="paused">Status: paradas</option>
                  <option value="done">Status: concluídas</option>
                </select>
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs" value={responsibleFilter} onChange={event => setResponsibleFilter(event.target.value)}>
                  <option value="all">Responsável: todos</option>
                  {people.map(person => (
                    <option key={String(person.id)} value={String(person.id)}>{String(person.name ?? "Responsável")}</option>
                  ))}
                </select>
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs" value={customerFilter} onChange={event => setCustomerFilter(event.target.value)}>
                  <option value="all">Cliente: todos</option>
                  {customers.map(customer => (
                    <option key={String(customer.id)} value={String(customer.id)}>{String(customer.name ?? "Cliente")}</option>
                  ))}
                </select>
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}>
                  <option value="all">Prioridade: todas</option>
                  <option value="high">Prioridade: alta</option>
                  <option value="medium">Prioridade: média</option>
                  <option value="low">Prioridade: baixa</option>
                </select>
                <select className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs" value={periodFilter} onChange={event => setPeriodFilter(event.target.value as PeriodFilter)}>
                  <option value="all">Período: geral</option>
                  <option value="today">Período: hoje</option>
                  <option value="7d">Período: próximos 7 dias</option>
                  <option value="overdue">Período: atrasadas</option>
                </select>
              </div>
            }
            activeFilterChips={[]}
            onClearAllFilters={() => {
              setStatusFilter("all");
              setResponsibleFilter("all");
              setCustomerFilter("all");
              setPriorityFilter("all");
              setPeriodFilter("all");
            }}
          />

          <AppSectionBlock title="Lista operacional de O.S." subtitle="Contexto + ação rápida para executar sem fricção.">
            {showInitialLoading ? (
              <AppPageLoadingState description="Carregando ordens de serviço..." />
            ) : showErrorState ? (
              <AppPageErrorState
                description={serviceOrdersQuery.error?.message ?? "Falha ao carregar ordens de serviço."}
                actionLabel="Tentar novamente"
                onAction={() => void serviceOrdersQuery.refetch()}
              />
            ) : filteredOrders.length === 0 ? (
              <AppPageEmptyState title="Nenhuma O.S. no recorte" description="Ajuste filtros ou crie uma nova ordem." />
            ) : (
              <AppDataTable>
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-[var(--surface-elevated)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="w-[12%] px-3 py-2.5 text-left">ID</th>
                      <th className="w-[14%] px-3 py-2.5 text-left">Cliente</th>
                      <th className="w-[15%] px-3 py-2.5 text-left">Serviço</th>
                      <th className="w-[10%] px-3 py-2.5 text-left">Status</th>
                      <th className="w-[12%] px-3 py-2.5 text-left">Responsável</th>
                      <th className="w-[14%] px-3 py-2.5 text-left">Tempo</th>
                      <th className="w-[11%] px-3 py-2.5 text-left">Prazo</th>
                      <th className="w-[12%] px-3 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(item => (
                      <tr
                        key={item.id}
                        className={`border-t border-[var(--border-subtle)] transition-colors hover:bg-[var(--surface-subtle)]/60 ${focusedOrder?.id === item.id ? "bg-[var(--accent-soft)]/40" : ""}`}
                        onClick={() => setFocusedOrderId(item.id)}
                      >
                        <td className="px-3 py-3 align-top">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">#{item.id}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{item.overdue ? "Atrasada" : "No fluxo"}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="truncate text-sm text-[var(--text-primary)]">{item.customerName}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="truncate text-sm text-[var(--text-primary)]">{item.serviceName}</p>
                          <AppPriorityBadge label={item.priority} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <AppStatusBadge label={item.statusLabel} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-sm text-[var(--text-primary)]">{item.ownerName}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-xs text-[var(--text-secondary)]">Início: {formatDateLabel(item.startedAt, "Não iniciado")}</p>
                          <p className="text-xs text-[var(--text-muted)]">Duração: {item.durationLabel}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-xs text-[var(--text-secondary)]">{formatDateLabel(item.scheduled, "Sem prazo")}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); void handleStatusChange(item.id, "IN_PROGRESS"); }}>
                              Iniciar
                            </SecondaryButton>
                            <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); void handleStatusChange(item.id, "PAUSED"); }}>
                              Pausar
                            </SecondaryButton>
                            <Button type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); void handleStatusChange(item.id, "DONE"); }}>
                              Concluir
                            </Button>
                            <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); navigate(`/whatsapp?customerId=${item.raw?.customerId}&serviceOrderId=${item.id}`); }}>
                              Mensagem
                            </SecondaryButton>
                            <SecondaryButton type="button" className="h-7 px-2 text-[10px]" onClick={event => { event.stopPropagation(); void handleGenerateCharge(item.id); }}>
                              Cobrança
                            </SecondaryButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AppDataTable>
            )}
          </AppSectionBlock>

          <AppSectionBlock title="Preparação para detalhe e execução" subtitle="Estrutura pronta para operar sem trocar de tela.">
            {!focusedOrder ? (
              <AppPageEmptyState title="Selecione uma O.S." description="Ao selecionar, você vê execução, histórico, comunicação e financeiro." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <AppSectionCard className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Execução e ações</p>
                  <OperationalRelationSummary
                    title={`O.S. #${focusedOrder.id} · ${focusedOrder.serviceName}`}
                    items={[
                      `Status atual: ${focusedOrder.statusLabel}.`,
                      `Responsável: ${focusedOrder.ownerName}.`,
                      `Próxima ação sugerida: ${focusedOrder.nextActionLabel}.`,
                    ]}
                  />
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => void handleStatusChange(focusedOrder.id, "IN_PROGRESS")}>Iniciar</SecondaryButton>
                    <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => void handleStatusChange(focusedOrder.id, "PAUSED")}>Pausar</SecondaryButton>
                    <Button type="button" className="h-8 px-3 text-xs" onClick={() => void handleStatusChange(focusedOrder.id, "DONE")}>Concluir</Button>
                  </div>
                </AppSectionCard>

                <AppSectionCard className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Histórico, comunicação e financeiro</p>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate(`/timeline?serviceOrderId=${focusedOrder.id}`)}>Histórico completo</SecondaryButton>
                    <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate(`/whatsapp?customerId=${focusedOrder.raw?.customerId}&serviceOrderId=${focusedOrder.id}`)}>Comunicação</SecondaryButton>
                    <SecondaryButton type="button" className="h-8 px-3 text-xs" onClick={() => navigate(`/finances?serviceOrderId=${focusedOrder.id}`)}>Financeiro</SecondaryButton>
                  </div>
                  <AppTimeline>
                    {focusedTimeline.length === 0 ? (
                      <AppTimelineItem className="text-xs text-[var(--text-muted)]">Sem eventos recentes para esta O.S.</AppTimelineItem>
                    ) : (
                      focusedTimeline.map(event => (
                        <AppTimelineItem key={String(event?.id ?? `${event?.action}-${event?.createdAt}`)} className="text-xs">
                          <p className="font-semibold text-[var(--text-primary)]">{String(event?.action ?? event?.type ?? "Evento")}</p>
                          <p className="text-[11px] text-[var(--text-muted)]">{formatDateLabel(event?.createdAt, "Sem data")}</p>
                        </AppTimelineItem>
                      ))
                    )}
                  </AppTimeline>
                </AppSectionCard>
              </div>
            )}
          </AppSectionBlock>

          {actionFeedback ? (
            <OperationalInlineFeedback tone={actionFeedbackTone}>{actionFeedback}</OperationalInlineFeedback>
          ) : null}
        </div>

        <CreateServiceOrderModal
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          onSuccess={() => {
            void serviceOrdersQuery.refetch();
          }}
          customers={customers.map(item => ({ id: String(item.id), name: String(item.name ?? "Cliente") }))}
          people={people.map(item => ({ id: String(item.id), name: String(item.name ?? "Pessoa") }))}
          appointmentId={undefined}
          initialCustomerId={focusedOrder ? String(focusedOrder.raw?.customerId ?? "") || undefined : undefined}
        />
      </PageWrapper>
    </AppPageShell>
  );
}
