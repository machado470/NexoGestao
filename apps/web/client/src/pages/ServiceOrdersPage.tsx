import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { useOperationalMemoryState } from "@/hooks/useOperationalMemory";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { Button, SecondaryButton } from "@/components/design-system";
import { AppPageShell, AppRowActionsDropdown } from "@/components/app-system";
import {
  AppFiltersBar,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageErrorState,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
  appSelectionPillClasses,
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
  if (isOverdue) return "Atrasada";
  if (status === "DONE") return "Concluída";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (["OPEN", "ASSIGNED"].includes(status)) return "Aberta";
  if (status === "CANCELED") return "Cancelada";
  return "Sem status";
}

function safeText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export default function ServiceOrdersPage() {
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
    }
  }

  async function handleComplete(orderId: string) {
    if (!capabilities.complete) {
      setActionFeedback("Ação indisponível: endpoint de concluir não disponível.");
      return;
    }
    try {
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
    }
  }

  async function handleGenerateCharge(orderId: string) {
    if (!capabilities.generateCharge) {
      setActionFeedback("Ação indisponível: endpoint de cobrança não disponível.");
      return;
    }
    try {
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
    }
  }

  return (
    <AppPageShell>
      <PageWrapper
        title="Ordens de Serviço"
        subtitle="Execução, status e cobrança dos serviços."
      >
        <div className="flex h-[calc(100vh-5rem)] min-h-0 flex-col gap-3 overflow-hidden">
          <AppOperationalHeader
            title="Ordens de Serviço"
            description="Execução, status e cobrança dos serviços"
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
                className={appSelectionPillClasses(activeFilter === filter.key)}
                onClick={() => setActiveFilter(filter.key as ServiceOrdersFilter)}
              >
                {filter.label}
              </button>
            ))}
          </AppFiltersBar>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <AppSectionBlock
              title="Carteira de O.S."
              subtitle="Lista compacta para execução operacional"
              className="flex h-full min-h-0 flex-col"
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
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {filteredOrders.map(item => {
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
                        className={`rounded-lg border p-3 text-left transition ${
                          selectedOrder?.id === item.id
                            ? "border-[var(--accent-primary)] bg-[var(--accent-soft)]/35"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-subtle)]/70"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  #{item.code}
                                </p>
                                <p className="truncate text-xs text-[var(--text-secondary)]">
                                  {item.customerName}
                                </p>
                              </div>
                              <span className="shrink-0 whitespace-nowrap">
                                <AppStatusBadge label={getStatusTone(item.status, item.isOverdue)} />
                              </span>
                            </div>

                            <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                              {item.title}
                            </p>

                            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                              <span>Prazo: {item.dueDateLabel}</span>
                              <span>Valor: {formatCurrency(item.amountCents)}</span>
                              <span className="truncate">Status: {item.statusLabel}</span>
                              <span>{item.hasCharge ? "Com cobrança" : "Sem cobrança"}</span>
                            </div>
                          </div>

                          <div
                            className="shrink-0"
                            onClick={event => event.stopPropagation()}
                          >
                            <AppRowActionsDropdown
                              triggerLabel="Ações da O.S."
                              items={[
                                { label: "Ver O.S.", onSelect: () => setSelectedOrderId(item.id) },
                                {
                                  label: capabilities.start ? "Iniciar" : "Iniciar (indisponível)",
                                  onSelect: () => void handleStart(item.id),
                                  disabled: !canStart || anyActionPending,
                                },
                                {
                                  label: capabilities.complete ? "Concluir" : "Concluir (indisponível)",
                                  onSelect: () => void handleComplete(item.id),
                                  disabled: !canComplete || anyActionPending,
                                },
                                {
                                  label: capabilities.generateCharge
                                    ? "Gerar cobrança"
                                    : "Gerar cobrança (indisponível)",
                                  onSelect: () => void handleGenerateCharge(item.id),
                                  disabled: !canGenerateCharge || anyActionPending,
                                },
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
                                {
                                  label: capabilities.edit ? "Editar" : "Editar (indisponível)",
                                  onSelect: () => setEditingId(item.id),
                                  disabled: !capabilities.edit,
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </AppSectionBlock>

            <AppSectionBlock
              title="Detalhe da O.S."
              subtitle="Resumo, execução, agenda, cobrança e histórico"
              className="flex h-full min-h-0 flex-col"
            >
              {!selectedOrder ? (
                <AppPageEmptyState
                  title="Selecione uma O.S."
                  description="Ao selecionar, o painel mostra execução, cliente, agenda, cobrança e histórico."
                />
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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
                    <SecondaryButton
                      type="button"
                      onClick={() => void handleStart(selectedOrder.id)}
                      disabled={
                        !capabilities.start ||
                        !["OPEN", "ASSIGNED"].includes(selectedOrder.status) ||
                        anyActionPending
                      }
                    >
                      {capabilities.start ? "Iniciar" : "Iniciar (indisponível)"}
                    </SecondaryButton>
                    <Button
                      type="button"
                      onClick={() => void handleComplete(selectedOrder.id)}
                      disabled={
                        !capabilities.complete ||
                        selectedOrder.status !== "IN_PROGRESS" ||
                        anyActionPending
                      }
                    >
                      {capabilities.complete ? "Concluir" : "Concluir (indisponível)"}
                    </Button>
                    <SecondaryButton
                      type="button"
                      onClick={() => void handleGenerateCharge(selectedOrder.id)}
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
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        navigate(
                          `/whatsapp?customerId=${selectedOrder.customerId}&serviceOrderId=${selectedOrder.id}`
                        )
                      }
                    >
                      Enviar WhatsApp
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => navigate(`/customers?customerId=${selectedOrder.customerId}`)}
                    >
                      Abrir cliente
                    </SecondaryButton>
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
    </AppPageShell>
  );
}
