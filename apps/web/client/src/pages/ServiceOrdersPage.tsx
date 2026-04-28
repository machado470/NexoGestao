import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import type { OperationalSeverity } from "@/lib/operations/operational-intelligence";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/design-system";
import { AppRowActionsDropdown } from "@/components/app-system";
import {
  AppFiltersBar,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageErrorState,
  AppPageEmptyState,
  AppPagination,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";

type ServiceOrdersFilter =
  | "all"
  | "open"
  | "in_progress"
  | "overdue"
  | "done"
  | "without_charge";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: unknown, fallback = "—") {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(cents?: number | null) {
  if (!Number.isFinite(Number(cents ?? 0)) || Number(cents ?? 0) <= 0)
    return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents) / 100);
}

function getStatusLabel(status: string) {
  if (["OPEN", "ASSIGNED"].includes(status)) return "Aberta";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "DONE") return "Concluída";
  if (status === "CANCELED") return "Cancelada";
  return "Sem status";
}

function getStatusTone(status: string, isOverdue: boolean) {
  if (isOverdue) return "Em risco";
  if (status === "DONE") return "Concluído";
  if (status === "IN_PROGRESS") return "Atenção";
  if (["OPEN", "ASSIGNED"].includes(status)) return "Pendente";
  if (status === "CANCELED") return "Bloqueado";
  return "Pendente";
}

function safeText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export default function ServiceOrdersPage() {
  const pageSize = 8;
  const _operationalSeverityContract: OperationalSeverity = "healthy";
  void _operationalSeverityContract;
  const [location, navigate] = useLocation();
  const params = useMemo(
    () => new URLSearchParams(location.split("?")[1] ?? ""),
    [location]
  );

  const urlServiceOrderId = params.get("id");
  const urlCustomerId = params.get("customerId");
  const urlAppointmentId = params.get("appointmentId");

  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] =
    useOperationalMemoryState<ServiceOrdersFilter>(
      "nexo.service-orders.filter.v5",
      "all"
    );
  const [searchTerm, setSearchTerm] = useOperationalMemoryState(
    "nexo.service-orders.search.v5",
    ""
  );
  const [selectedOrderId, setSelectedOrderId] = useOperationalMemoryState<
    string | null
  >("nexo.service-orders.selected-id.v5", null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    orderId: string;
    type: "start" | "complete" | "charge";
  } | null>(null);

  const utils = trpc.useUtils();

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const customersQuery = trpc.nexo.customers.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const timelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: String(selectedOrderId ?? ""), limit: 20 },
    { enabled: Boolean(selectedOrderId), retry: false }
  );

  const updateMutation = trpc.nexo.serviceOrders.update.useMutation();
  const generateChargeMutation = trpc.nexo.serviceOrders.generateCharge.useMutation();

  const capabilities = {
    start: Boolean(updateMutation),
    complete: Boolean(updateMutation),
    generateCharge: Boolean(generateChargeMutation),
    edit: true,
  };

  const serviceOrders = useMemo(
    () => normalizeArrayPayload<any>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );
  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<any>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );
  const charges = useMemo(
    () => normalizeArrayPayload<any>(chargesQuery.data),
    [chargesQuery.data]
  );
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const timeline = useMemo(
    () => normalizeArrayPayload<any>(timelineQuery.data),
    [timelineQuery.data]
  );

  const customerById = useMemo(
    () => new Map(customers.map(item => [String(item?.id ?? ""), item])),
    [customers]
  );
  const appointmentById = useMemo(
    () => new Map(appointments.map(item => [String(item?.id ?? ""), item])),
    [appointments]
  );
  const peopleById = useMemo(
    () => new Map(people.map(item => [String(item?.id ?? ""), item])),
    [people]
  );

  const chargeByServiceOrderId = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of charges) {
      const serviceOrderId = String(
        item?.serviceOrderId ?? item?.serviceOrder?.id ?? ""
      ).trim();
      if (!serviceOrderId) continue;
      const current = map.get(serviceOrderId);
      if (!current) {
        map.set(serviceOrderId, item);
        continue;
      }
      const currentUpdated =
        toDate(current?.updatedAt ?? current?.createdAt)?.getTime() ?? 0;
      const nextUpdated =
        toDate(item?.updatedAt ?? item?.createdAt)?.getTime() ?? 0;
      if (nextUpdated >= currentUpdated) map.set(serviceOrderId, item);
    }
    return map;
  }, [charges]);

  const enrichedOrders = useMemo(() => {
    const now = Date.now();
    return serviceOrders.map(order => {
      const id = String(order?.id ?? "");
      const status = String(order?.status ?? "").toUpperCase();
      const dueDate = toDate(order?.dueDate ?? order?.scheduledFor);
      const isOverdue = Boolean(
        dueDate &&
          dueDate.getTime() < now &&
          ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(status)
      );
      const linkedCharge =
        chargeByServiceOrderId.get(id) ?? order?.financialSummary?.latestCharge ?? null;
      const hasCharge =
        Boolean(order?.financialSummary?.hasCharge) || Boolean(linkedCharge?.id);
      const customerId = String(order?.customerId ?? order?.customer?.id ?? "");
      const appointmentId = String(order?.appointmentId ?? "");
      const assignedToPersonId = String(
        order?.assignedToPersonId ?? order?.assignedTo?.id ?? ""
      );

      return {
        raw: order,
        id,
        code: safeText(order?.number ?? order?.code ?? order?.id),
        title: safeText(order?.title ?? order?.serviceName, "Sem descrição"),
        description: safeText(order?.description, "Sem descrição detalhada"),
        customerId,
        customerName: safeText(
          order?.customer?.name ?? customerById.get(customerId)?.name,
          "Cliente não identificado"
        ),
        status,
        statusLabel: getStatusLabel(status),
        dueDate,
        dueDateLabel: formatDate(order?.dueDate ?? order?.scheduledFor, "Sem prazo"),
        amountCents: Number(order?.amountCents ?? linkedCharge?.amountCents ?? 0) || 0,
        hasCharge,
        linkedCharge,
        isOverdue,
        appointmentId,
        linkedAppointment: appointmentById.get(appointmentId) ?? null,
        assignedToPersonId,
        responsibleName: safeText(
          order?.assignedTo?.name ?? peopleById.get(assignedToPersonId)?.name,
          "Sem responsável"
        ),
        startedAt: order?.startedAt ?? order?.executionStartedAt ?? null,
        finishedAt: order?.endedAt ?? order?.finishedAt ?? null,
      };
    });
  }, [appointmentById, chargeByServiceOrderId, customerById, peopleById, serviceOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return enrichedOrders.filter(item => {
      if (urlCustomerId && item.customerId !== String(urlCustomerId)) return false;

      if (activeFilter === "open" && !["OPEN", "ASSIGNED"].includes(item.status))
        return false;
      if (activeFilter === "in_progress" && item.status !== "IN_PROGRESS")
        return false;
      if (activeFilter === "overdue" && !item.isOverdue) return false;
      if (activeFilter === "done" && item.status !== "DONE") return false;
      if (activeFilter === "without_charge" && item.hasCharge) return false;

      if (normalizedTerm) {
        const hay = `${item.code} ${item.customerName} ${item.title} ${item.description}`.toLowerCase();
        if (!hay.includes(normalizedTerm)) return false;
      }

      return true;
    });
  }, [activeFilter, enrichedOrders, searchTerm, urlCustomerId]);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [currentPage, filteredOrders, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, urlCustomerId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, filteredOrders.length, pageSize]);

  useEffect(() => {
    if (urlServiceOrderId && enrichedOrders.some(item => item.id === urlServiceOrderId)) {
      setSelectedOrderId(urlServiceOrderId);
      return;
    }
    if (!filteredOrders.length) {
      setSelectedOrderId(null);
      return;
    }
    const exists = filteredOrders.some(item => item.id === selectedOrderId);
    if (!exists) setSelectedOrderId(filteredOrders[0]?.id ?? null);
  }, [
    enrichedOrders,
    filteredOrders,
    selectedOrderId,
    setSelectedOrderId,
    urlServiceOrderId,
  ]);

  const selectedOrder = useMemo(
    () => filteredOrders.find(item => item.id === selectedOrderId) ?? filteredOrders[0] ?? null,
    [filteredOrders, selectedOrderId]
  );

  const isLoading = serviceOrdersQuery.isLoading && enrichedOrders.length === 0;
  const hasBlockingError = Boolean(serviceOrdersQuery.error) && enrichedOrders.length === 0;

  usePageDiagnostics({
    page: "service-orders",
    isLoading,
    hasError: hasBlockingError,
    isEmpty: !isLoading && !hasBlockingError && filteredOrders.length === 0,
    dataCount: filteredOrders.length,
  });

  const counts = useMemo(() => {
    const open = enrichedOrders.filter(item => ["OPEN", "ASSIGNED"].includes(item.status)).length;
    const progress = enrichedOrders.filter(item => item.status === "IN_PROGRESS").length;
    const overdue = enrichedOrders.filter(item => item.isOverdue).length;
    const done = enrichedOrders.filter(item => item.status === "DONE").length;
    const noCharge = enrichedOrders.filter(item => !item.hasCharge).length;
    return { all: enrichedOrders.length, open, progress, overdue, done, noCharge };
  }, [enrichedOrders]);

  const anyActionPending = updateMutation.isPending || generateChargeMutation.isPending;
  const isPendingAction = (orderId: string, type: "start" | "complete" | "charge") =>
    pendingAction?.orderId === orderId && pendingAction.type === type;

  async function refreshEverything() {
    await Promise.all([
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      appointmentsQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  }

  async function handleStart(orderId: string) {
    if (!capabilities.start) {
      setActionFeedback("Ação indisponível: endpoint de iniciar não disponível.");
      return;
    }
    try {
      setPendingAction({ orderId, type: "start" });
      setActionFeedback("Iniciando O.S...");
      await updateMutation.mutateAsync({ id: orderId, status: "IN_PROGRESS" });
      setActionFeedback("O.S. iniciada com sucesso.");
      toast.success("O.S. iniciada.");
      await refreshEverything();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível iniciar a O.S.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleComplete(orderId: string) {
    if (!capabilities.complete) {
      setActionFeedback("Ação indisponível: endpoint de concluir não disponível.");
      return;
    }
    try {
      setPendingAction({ orderId, type: "complete" });
      setActionFeedback("Concluindo O.S...");
      await updateMutation.mutateAsync({ id: orderId, status: "DONE" });
      await refreshEverything();
      const updated = normalizeObjectPayload<any>(
        await utils.nexo.serviceOrders.getById.fetch({ id: orderId })
      );
      const autoHasCharge =
        Boolean(updated?.financialSummary?.hasCharge) || chargeByServiceOrderId.has(orderId);
      setActionFeedback(
        autoHasCharge
          ? "O.S. concluída e cobrança já vinculada automaticamente."
          : "O.S. concluída. Cobrança não foi gerada automaticamente."
      );
      toast.success("O.S. concluída.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível concluir a O.S.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateCharge(orderId: string) {
    if (!capabilities.generateCharge) {
      setActionFeedback("Ação indisponível: endpoint de cobrança não disponível.");
      return;
    }
    try {
      setPendingAction({ orderId, type: "charge" });
      setActionFeedback("Gerando cobrança...");
      await generateChargeMutation.mutateAsync({ id: orderId });
      setActionFeedback("Cobrança gerada com sucesso.");
      toast.success("Cobrança gerada.");
      await refreshEverything();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível gerar cobrança.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <PageWrapper title="Ordens de Serviço" showOperationalHeader={false}>
      <div className="flex flex-col gap-4">
          <AppOperationalHeader
            title="Ordens de Serviço"
            description="Execução, status e cobrança dos serviços."
            density="compact"
            primaryAction={
              <Button type="button" onClick={() => setOpenCreate(true)}>
                Nova O.S.
              </Button>
            }
          >
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Buscar por código, cliente ou descrição"
                className="h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
              />
              <div className="flex h-9 items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs text-[var(--text-secondary)]">
                {filteredOrders.length} / {counts.all} O.S. reais
              </div>
            </div>
          </AppOperationalHeader>

          <AppFiltersBar className="shrink-0 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-3">
            {[
              { key: "all", label: `Todas (${counts.all})` },
              { key: "open", label: `Abertas (${counts.open})` },
              { key: "in_progress", label: `Em andamento (${counts.progress})` },
              { key: "overdue", label: `Atrasadas (${counts.overdue})` },
              { key: "done", label: `Concluídas (${counts.done})` },
              { key: "without_charge", label: `Sem cobrança (${counts.noCharge})` },
            ].map(filter => (
              <button
                key={filter.key}
                type="button"
                className={`h-8 rounded-md px-3 text-xs font-medium transition-colors ${
                  activeFilter === filter.key
                    ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                    : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]/80 hover:text-[var(--text-primary)]"
                }`}
                onClick={() => setActiveFilter(filter.key as ServiceOrdersFilter)}
              >
                {filter.label}
              </button>
            ))}
          </AppFiltersBar>

          <div className="flex flex-col gap-4">
            <AppSectionBlock
              title="Carteira de O.S."
              subtitle="Lista compacta para execução operacional"
              className="flex flex-col"
            >
              {isLoading ? (
                <AppPageLoadingState description="Carregando ordens de serviço..." />
              ) : hasBlockingError ? (
                <AppPageErrorState
                  description={
                    serviceOrdersQuery.error?.message ??
                    "Falha ao carregar ordens de serviço."
                  }
                  actionLabel="Tentar novamente"
                  onAction={() => void refreshEverything()}
                />
              ) : filteredOrders.length === 0 ? (
                <AppPageEmptyState
                  title={searchTerm.trim() ? "Busca sem resultado" : "Nenhuma ordem encontrada"}
                  description={
                    searchTerm.trim()
                      ? "Ajuste o termo de busca ou os filtros para continuar."
                      : "Crie uma nova O.S. para iniciar o fluxo operacional."
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-2">
                    {paginatedOrders.map(item => {
                    const canStart = capabilities.start && ["OPEN", "ASSIGNED"].includes(item.status);
                    const canComplete = capabilities.complete && item.status === "IN_PROGRESS";
                    const canGenerateCharge =
                      capabilities.generateCharge && item.status === "DONE" && !item.hasCharge;

                    return (
                      <article
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrderId(item.id)}
                        onKeyDown={event => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedOrderId(item.id);
                          }
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selectedOrder?.id === item.id
                            ? "border-orange-500 bg-white/[0.03]"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-subtle)]/70"
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  #{item.code} · {item.title}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                                  {item.customerName}
                                </p>
                              </div>
                              <span className="shrink-0 whitespace-nowrap pt-0.5">
                                <AppStatusBadge label={getStatusTone(item.status, item.isOverdue)} />
                              </span>
                            </div>

                            <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                              {item.description}
                            </p>

                            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                              <span className="truncate">Prazo: {item.dueDateLabel}</span>
                              <span className="truncate">Valor: {formatCurrency(item.amountCents)}</span>
                              <span className="truncate">Execução: {item.statusLabel}</span>
                              <span
                                className={`truncate ${
                                  item.hasCharge
                                    ? "text-[var(--text-muted)]"
                                    : "text-amber-400/90"
                                }`}
                              >
                                {item.hasCharge ? "Com cobrança" : "Sem cobrança"}
                              </span>
                            </div>
                          </div>

                          <div
                            className="shrink-0 pt-0.5"
                            onClick={event => event.stopPropagation()}
                          >
                            <AppRowActionsDropdown
                              triggerLabel="Ações da O.S."
                              items={[
                                {
                                  label: capabilities.start ? "Iniciar" : "Iniciar (indisponível)",
                                  tone: "primary",
                                  onSelect: () => void handleStart(item.id),
                                  disabled: !canStart || anyActionPending,
                                },
                                {
                                  label: capabilities.complete ? "Concluir" : "Concluir (indisponível)",
                                  tone: "primary",
                                  onSelect: () => void handleComplete(item.id),
                                  disabled: !canComplete || anyActionPending,
                                },
                                {
                                  label: capabilities.generateCharge
                                    ? "Gerar cobrança"
                                    : "Gerar cobrança (indisponível)",
                                  tone: "primary",
                                  onSelect: () => void handleGenerateCharge(item.id),
                                  disabled: !canGenerateCharge || anyActionPending,
                                },
                                {
                                  label: capabilities.edit ? "Editar" : "Editar (indisponível)",
                                  tone: "primary",
                                  onSelect: () => setEditingId(item.id),
                                  disabled: !capabilities.edit,
                                },
                                {
                                  type: "separator",
                                  label: "Navegação",
                                },
                                { label: "Abrir O.S.", onSelect: () => setSelectedOrderId(item.id) },
                                {
                                  label: "Enviar WhatsApp",
                                  onSelect: () =>
                                    navigate(
                                      `/whatsapp?customerId=${item.customerId}&serviceOrderId=${item.id}`
                                    ),
                                },
                                {
                                  label: "Ver cliente",
                                  onSelect: () => navigate(`/customers?customerId=${item.customerId}`),
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </article>
                    );
                    })}
                  </div>
                  <AppPagination
                    currentPage={currentPage}
                    totalItems={filteredOrders.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </AppSectionBlock>

            <AppSectionBlock
              title="Detalhe da O.S."
              subtitle="Resumo, execução, agenda, cobrança e histórico"
              className="flex flex-col"
            >
              {!selectedOrder ? (
                <AppPageEmptyState
                  title="Selecione uma O.S."
                  description="Ao selecionar, o painel mostra execução, cliente, agenda, cobrança e histórico."
                />
              ) : (
                <div className="space-y-3">
                  <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/35 p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Resumo</p>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      #{selectedOrder.code} · {selectedOrder.title}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {selectedOrder.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <AppStatusBadge
                        label={getStatusTone(selectedOrder.status, selectedOrder.isOverdue)}
                      />
                      <span>Responsável: {selectedOrder.responsibleName}</span>
                      <span>Prazo: {selectedOrder.dueDateLabel}</span>
                    </div>
                  </article>

                  <div className="grid gap-3 md:grid-cols-2">
                    <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                      <p className="text-xs uppercase text-[var(--text-muted)]">Cliente e datas</p>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {selectedOrder.customerName}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Início execução: {formatDate(selectedOrder.startedAt, "Não iniciada")}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Conclusão: {formatDate(selectedOrder.finishedAt, "Não concluída")}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Criada em: {formatDate(selectedOrder.raw?.createdAt)}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Atualizada em: {formatDate(selectedOrder.raw?.updatedAt)}
                      </p>
                    </article>

                    <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                      <p className="text-xs uppercase text-[var(--text-muted)]">Cobrança / financeiro</p>
                      <p className="text-[var(--text-secondary)]">
                        Valor: {formatCurrency(selectedOrder.amountCents)}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Status: {selectedOrder.hasCharge ? "Cobrança vinculada" : "Sem cobrança"}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Cobrança ID: {safeText(selectedOrder.linkedCharge?.id, "—")}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Vencimento: {formatDate(selectedOrder.linkedCharge?.dueDate, "—")}
                      </p>
                    </article>
                  </div>

                  <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <p className="text-xs uppercase text-[var(--text-muted)]">Agendamento vinculado</p>
                    {selectedOrder.linkedAppointment ? (
                      <div className="space-y-1">
                        <p className="text-[var(--text-secondary)]">
                          ID: {String(selectedOrder.linkedAppointment?.id ?? "—")}
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          Status: {safeText(selectedOrder.linkedAppointment?.status)}
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          Início: {formatDate(selectedOrder.linkedAppointment?.startsAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[var(--text-secondary)]">Nenhum agendamento vinculado.</p>
                    )}
                  </article>

                  <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <p className="text-xs uppercase text-[var(--text-muted)]">Timeline / histórico</p>
                    {timelineQuery.isLoading ? (
                      <p className="text-[var(--text-secondary)]">Carregando histórico...</p>
                    ) : timeline.length === 0 ? (
                      <p className="text-[var(--text-secondary)]">
                        Sem eventos registrados para esta O.S.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {timeline.map(event => (
                          <li
                            key={String(event?.id ?? `${event?.action}-${event?.createdAt}`)}
                            className="rounded-md border border-[var(--border-subtle)] p-2"
                          >
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {safeText(event?.action ?? event?.type, "Evento")}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {safeText(event?.description, "Sem descrição")}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {formatDate(event?.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      onClick={() => void handleStart(selectedOrder.id)}
                      isLoading={isPendingAction(selectedOrder.id, "start")}
                      loadingLabel="Iniciando..."
                      disabled={
                        !capabilities.start ||
                        !["OPEN", "ASSIGNED"].includes(selectedOrder.status) ||
                        anyActionPending
                      }
                    >
                      {capabilities.start ? "Iniciar" : "Iniciar (indisponível)"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleComplete(selectedOrder.id)}
                      isLoading={isPendingAction(selectedOrder.id, "complete")}
                      loadingLabel="Concluindo..."
                      disabled={
                        !capabilities.complete ||
                        selectedOrder.status !== "IN_PROGRESS" ||
                        anyActionPending
                      }
                    >
                      {capabilities.complete ? "Concluir" : "Concluir (indisponível)"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleGenerateCharge(selectedOrder.id)}
                      isLoading={isPendingAction(selectedOrder.id, "charge")}
                      loadingLabel="Gerando..."
                      disabled={
                        !capabilities.generateCharge ||
                        selectedOrder.status !== "DONE" ||
                        selectedOrder.hasCharge ||
                        anyActionPending
                      }
                    >
                      {capabilities.generateCharge
                        ? "Cobrar / Gerar cobrança"
                        : "Cobrança (indisponível)"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/whatsapp?customerId=${selectedOrder.customerId}&serviceOrderId=${selectedOrder.id}`
                        )
                      }
                    >
                      Enviar WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/customers?customerId=${selectedOrder.customerId}`)}
                    >
                      Abrir cliente
                    </Button>
                  </div>

                  {actionFeedback ? (
                    <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {actionFeedback}
                    </p>
                  ) : null}
                </div>
              )}
            </AppSectionBlock>
          </div>
        </div>

        <CreateServiceOrderModal
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          onSuccess={() => void refreshEverything()}
          customers={customers.map(item => ({
            id: String(item?.id ?? ""),
            name: safeText(item?.name, "Cliente"),
          }))}
          people={people.map(item => ({
            id: String(item?.id ?? ""),
            name: safeText(item?.name, "Pessoa"),
          }))}
          appointmentId={urlAppointmentId || undefined}
          initialCustomerId={urlCustomerId || selectedOrder?.customerId || undefined}
        />

        <EditServiceOrderModal
          isOpen={Boolean(editingId)}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            void refreshEverything();
          }}
          serviceOrderId={editingId}
          people={people.map(item => ({
            id: String(item?.id ?? ""),
            name: safeText(item?.name, "Pessoa"),
          }))}
        />
    </PageWrapper>
  );
}
