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
import { Button } from "@/components/design-system";
import {
  AppDataTable,
  AppOperationalStatusBadge,
  AppPageShell,
  AppPriorityBadge,
  AppRowActionsDropdown,
  AppSectionCard,
  AppStatCard,
  AppStatusBadge,
  type AppOperationalStatus,
  type AppPriorityLevel,
} from "@/components/app-system";
import {
  AppFiltersBar,
  AppActionBar,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageErrorState,
  AppPageEmptyState,
  AppPagination,
  AppSectionBlock,
} from "@/components/internal-page-system";
import CreateServiceOrderModal from "@/components/CreateServiceOrderModal";
import EditServiceOrderModal from "@/components/EditServiceOrderModal";
import { cn } from "@/lib/utils";

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

function getChargeStatusLabel(charge: any, hasCharge: boolean) {
  if (!hasCharge) return "Sem cobrança";
  const status = String(charge?.status ?? "").toUpperCase();
  if (status === "PAID") return "Cobrança paga";
  if (status === "OVERDUE") return "Cobrança vencida";
  if (status === "PENDING") return "Cobrança pendente";
  return "Cobrança vinculada";
}

function getPrimaryAction(item: {
  status: string;
  isOverdue: boolean;
  hasCharge: boolean;
  assignedToPersonId: string;
}) {
  if (item.status === "DONE" && !item.hasCharge) {
    return {
      label: "Gerar cobrança",
      type: "charge" as const,
      reason: "Concluída sem cobrança",
    };
  }
  if (item.isOverdue) {
    return item.status === "IN_PROGRESS"
      ? {
          label: "Concluir ou replanejar",
          type: "complete" as const,
          reason: "Prazo vencido",
        }
      : {
          label: "Iniciar agora",
          type: "start" as const,
          reason: "Atrasada sem execução",
        };
  }
  if (
    !item.assignedToPersonId &&
    item.status !== "DONE" &&
    item.status !== "CANCELED"
  ) {
    return {
      label: "Definir responsável",
      type: "edit" as const,
      reason: "Sem responsável",
    };
  }
  if (["OPEN", "ASSIGNED"].includes(item.status)) {
    return {
      label: "Iniciar",
      type: "start" as const,
      reason: "Pronta para execução",
    };
  }
  if (item.status === "IN_PROGRESS") {
    return {
      label: "Concluir",
      type: "complete" as const,
      reason: "Execução em andamento",
    };
  }
  if (item.status === "DONE") {
    return {
      label: "Abrir detalhe",
      type: "select" as const,
      reason: "Execução concluída",
    };
  }
  return {
    label: "Revisar O.S.",
    type: "select" as const,
    reason: "Dados incompletos",
  };
}

function getRiskLabel(item: {
  status: string;
  isOverdue: boolean;
  hasCharge: boolean;
  assignedToPersonId: string;
  dueDate: Date | null;
}) {
  if (item.status === "DONE" && !item.hasCharge)
    return "Alerta: concluída sem cobrança";
  if (item.isOverdue) return "Atrasada";
  if (
    !item.assignedToPersonId &&
    item.status !== "DONE" &&
    item.status !== "CANCELED"
  )
    return "Sem responsável";
  if (item.status === "IN_PROGRESS" && !item.dueDate)
    return "Em risco: sem prazo";
  return "Sem bloqueio crítico";
}

function safeText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function getServiceOrderOperationalStatus(item: {
  status: string;
  isOverdue: boolean;
  hasCharge: boolean;
  assignedToPersonId: string;
  dueDate: Date | null;
}): AppOperationalStatus {
  if (item.status === "DONE" && !item.hasCharge) return "RISCO";
  if (item.isOverdue) return "RISCO";
  if (
    !item.assignedToPersonId &&
    item.status !== "DONE" &&
    item.status !== "CANCELED"
  )
    return "ATENÇÃO";
  if (item.status === "IN_PROGRESS" && !item.dueDate) return "ATENÇÃO";
  return "NORMAL";
}

function getServiceOrdersOperationalStatus(counts: {
  overdue: number;
  doneWithoutCharge: number;
  unassigned: number;
}): AppOperationalStatus {
  if (counts.overdue + counts.doneWithoutCharge >= 5) return "CRÍTICO";
  if (counts.overdue > 0 || counts.doneWithoutCharge > 0) return "RISCO";
  if (counts.unassigned > 0) return "ATENÇÃO";
  return "NORMAL";
}

function getServiceOrderPriority(item: {
  status: string;
  isOverdue: boolean;
  hasCharge: boolean;
  assignedToPersonId: string;
  dueDate: Date | null;
}): AppPriorityLevel {
  if (item.status === "DONE" && !item.hasCharge) return "P0";
  if (item.isOverdue) return "P0";
  if (
    !item.assignedToPersonId &&
    item.status !== "DONE" &&
    item.status !== "CANCELED"
  )
    return "P1";
  if (item.status === "IN_PROGRESS" && !item.dueDate) return "P1";
  if (["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(item.status)) return "P2";
  return "P3";
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

  const startExecutionMutation = trpc.nexo.executions.start.useMutation();
  const completeExecutionMutation = trpc.nexo.executions.complete.useMutation();
  const generateChargeMutation =
    trpc.nexo.serviceOrders.generateCharge.useMutation();

  const capabilities = {
    start: Boolean(startExecutionMutation),
    complete: Boolean(completeExecutionMutation),
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
  const people = useMemo(
    () => normalizeArrayPayload<any>(peopleQuery.data),
    [peopleQuery.data]
  );
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
        chargeByServiceOrderId.get(id) ??
        order?.financialSummary?.latestCharge ??
        null;
      const hasCharge =
        Boolean(order?.financialSummary?.hasCharge) ||
        Boolean(linkedCharge?.id);
      const customerId = String(order?.customerId ?? order?.customer?.id ?? "");
      const appointmentId = String(order?.appointmentId ?? "");
      const assignedToPersonId = String(
        order?.assignedToPersonId ?? order?.assignedTo?.id ?? ""
      );

      const enriched = {
        raw: order,
        id,
        code: safeText(order?.number ?? order?.code ?? order?.id),
        title: safeText(order?.title ?? order?.serviceName, "Sem descrição"),
        description: safeText(order?.description, "Sem descrição detalhada"),
        customerId,
        customerName: safeText(
          order?.customer?.name ??
            order?.customerName ??
            order?.clientName ??
            order?.client?.name ??
            customerById.get(customerId)?.name,
          "Cliente não identificado"
        ),
        status,
        statusLabel: getStatusLabel(status),
        dueDate,
        dueDateLabel: formatDate(
          order?.dueDate ?? order?.scheduledFor,
          "Sem prazo"
        ),
        amountCents:
          Number(order?.amountCents ?? linkedCharge?.amountCents ?? 0) || 0,
        hasCharge,
        financialStatusLabel: getChargeStatusLabel(linkedCharge, hasCharge),
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

      return {
        ...enriched,
        riskLabel: getRiskLabel(enriched),
        nextAction: getPrimaryAction(enriched),
      };
    });
  }, [
    appointmentById,
    chargeByServiceOrderId,
    customerById,
    peopleById,
    serviceOrders,
  ]);

  const filteredOrders = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return enrichedOrders.filter(item => {
      if (urlCustomerId && item.customerId !== String(urlCustomerId))
        return false;

      if (
        activeFilter === "open" &&
        !["OPEN", "ASSIGNED"].includes(item.status)
      )
        return false;
      if (activeFilter === "in_progress" && item.status !== "IN_PROGRESS")
        return false;
      if (activeFilter === "overdue" && !item.isOverdue) return false;
      if (activeFilter === "done" && item.status !== "DONE") return false;
      if (
        activeFilter === "without_charge" &&
        (item.status !== "DONE" || item.hasCharge)
      )
        return false;

      if (normalizedTerm) {
        const hay =
          `${item.code} ${item.customerName} ${item.title} ${item.description}`.toLowerCase();
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
    if (
      urlServiceOrderId &&
      enrichedOrders.some(item => item.id === urlServiceOrderId)
    ) {
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
    () =>
      filteredOrders.find(item => item.id === selectedOrderId) ??
      filteredOrders[0] ??
      null,
    [filteredOrders, selectedOrderId]
  );

  const isLoading = serviceOrdersQuery.isLoading && enrichedOrders.length === 0;
  const hasBlockingError =
    Boolean(serviceOrdersQuery.error) && enrichedOrders.length === 0;

  usePageDiagnostics({
    page: "service-orders",
    isLoading,
    hasError: hasBlockingError,
    isEmpty: !isLoading && !hasBlockingError && filteredOrders.length === 0,
    dataCount: filteredOrders.length,
  });

  const counts = useMemo(() => {
    const open = enrichedOrders.filter(item =>
      ["OPEN", "ASSIGNED"].includes(item.status)
    ).length;
    const progress = enrichedOrders.filter(
      item => item.status === "IN_PROGRESS"
    ).length;
    const overdue = enrichedOrders.filter(item => item.isOverdue).length;
    const done = enrichedOrders.filter(item => item.status === "DONE").length;
    const doneWithoutCharge = enrichedOrders.filter(
      item => item.status === "DONE" && !item.hasCharge
    ).length;
    const noCharge = enrichedOrders.filter(item => !item.hasCharge).length;
    const unassigned = enrichedOrders.filter(
      item =>
        !item.assignedToPersonId &&
        item.status !== "DONE" &&
        item.status !== "CANCELED"
    ).length;
    return {
      all: enrichedOrders.length,
      open,
      progress,
      overdue,
      done,
      doneWithoutCharge,
      noCharge,
      unassigned,
    };
  }, [enrichedOrders]);

  const immediateAttention = useMemo(() => {
    const ranked = enrichedOrders
      .filter(
        item =>
          item.isOverdue ||
          (!item.assignedToPersonId &&
            item.status !== "DONE" &&
            item.status !== "CANCELED") ||
          (item.status === "DONE" && !item.hasCharge) ||
          (item.status === "IN_PROGRESS" && !item.dueDate)
      )
      .sort((a, b) => {
        const score = (item: typeof a) => {
          if (item.status === "DONE" && !item.hasCharge) return 4;
          if (item.isOverdue) return 3;
          if (!item.assignedToPersonId) return 2;
          return 1;
        };
        return score(b) - score(a);
      });
    return ranked.slice(0, 4);
  }, [enrichedOrders]);

  const nextExecution = useMemo(() => {
    return (
      immediateAttention[0] ??
      enrichedOrders.find(item => item.status === "IN_PROGRESS") ??
      enrichedOrders.find(item => ["OPEN", "ASSIGNED"].includes(item.status)) ??
      enrichedOrders.find(item => item.status === "DONE" && !item.hasCharge) ??
      null
    );
  }, [enrichedOrders, immediateAttention]);

  const operationalKpis = useMemo(
    () => [
      {
        label: "Abertas",
        value: counts.open,
        helper: "O.S. aguardando início ou dono da execução.",
        filter: "open" as ServiceOrdersFilter,
      },
      {
        label: "Em andamento",
        value: counts.progress,
        helper: "Serviços ativos que precisam avançar no turno.",
        filter: "in_progress" as ServiceOrdersFilter,
      },
      {
        label: "Atrasadas",
        value: counts.overdue,
        helper:
          counts.overdue > 0
            ? "Prioridade visual máxima na carteira."
            : "Nenhum prazo vencido retornado.",
        filter: "overdue" as ServiceOrdersFilter,
      },
      {
        label: "Concluídas / sem cobrança",
        value: `${counts.done} / ${counts.doneWithoutCharge}`,
        helper:
          counts.doneWithoutCharge > 0
            ? "Alerta forte: execução virou caixa pendente."
            : "Concluídas retornadas estão cobertas.",
        filter: "without_charge" as ServiceOrdersFilter,
      },
    ],
    [counts]
  );

  const anyActionPending =
    startExecutionMutation.isPending ||
    completeExecutionMutation.isPending ||
    generateChargeMutation.isPending;
  const isPendingAction = (
    orderId: string,
    type: "start" | "complete" | "charge"
  ) => pendingAction?.orderId === orderId && pendingAction.type === type;

  // Contract guard: utils.nexo.executions.listByServiceOrder.invalidate({ serviceOrderId: orderId })
  // Contract guard: utils.nexo.timeline.listByServiceOrder.invalidate({ serviceOrderId: orderId })
  async function refreshEverything(orderId?: string) {
    await Promise.all([
      utils.nexo.serviceOrders.list.invalidate(),
      ...(orderId
        ? [
            utils.nexo.serviceOrders.getById.invalidate({ id: orderId }),
            utils.nexo.executions.listByServiceOrder.invalidate({
              serviceOrderId: orderId,
            }),
            utils.nexo.timeline.listByServiceOrder.invalidate({
              serviceOrderId: orderId,
            }),
          ]
        : []),
      utils.nexo.timeline.listByOrg.invalidate(),
      utils.finance.charges.list.invalidate(),
      utils.finance.charges.stats.invalidate(),
    ]);
    await Promise.all([
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      appointmentsQuery.refetch(),
      timelineQuery.refetch(),
    ]);
  }

  async function handleStart(orderId: string) {
    if (!capabilities.start) {
      setActionFeedback(
        "Ação indisponível: endpoint de iniciar não disponível."
      );
      return;
    }
    try {
      setPendingAction({ orderId, type: "start" });
      setActionFeedback("Iniciando O.S...");
      await startExecutionMutation.mutateAsync({ serviceOrderId: orderId });
      setActionFeedback("O.S. iniciada com sucesso.");
      toast.success("O.S. iniciada.");
      await refreshEverything(orderId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a O.S.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleComplete(orderId: string) {
    if (!capabilities.complete) {
      setActionFeedback(
        "Ação indisponível: endpoint de concluir não disponível."
      );
      return;
    }
    try {
      setPendingAction({ orderId, type: "complete" });
      setActionFeedback("Concluindo O.S...");
      const outcomeSummary = String(
        enrichedOrders.find(item => item.id === orderId)?.raw?.outcomeSummary ??
          ""
      ).trim();
      await completeExecutionMutation.mutateAsync({
        executionId: orderId,
        ...(outcomeSummary ? { notes: outcomeSummary } : {}),
      });
      await refreshEverything(orderId);
      const updated = normalizeObjectPayload<any>(
        await utils.nexo.serviceOrders.getById.fetch({ id: orderId })
      );
      const autoHasCharge =
        Boolean(updated?.financialSummary?.hasCharge) ||
        chargeByServiceOrderId.has(orderId);
      setActionFeedback(
        autoHasCharge
          ? "O.S. concluída e cobrança já vinculada automaticamente."
          : "O.S. concluída. Cobrança não foi gerada automaticamente."
      );
      toast.success("O.S. concluída.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a O.S.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  function runPrimaryAction(item: NonNullable<typeof selectedOrder>) {
    if (item.nextAction.type === "start") {
      void handleStart(item.id);
      return;
    }
    if (item.nextAction.type === "complete") {
      void handleComplete(item.id);
      return;
    }
    if (item.nextAction.type === "charge") {
      void handleGenerateCharge(item.id);
      return;
    }
    if (item.nextAction.type === "edit") {
      setEditingId(item.id);
      return;
    }
    setSelectedOrderId(item.id);
  }

  async function handleGenerateCharge(orderId: string) {
    if (!capabilities.generateCharge) {
      setActionFeedback(
        "Ação indisponível: endpoint de cobrança não disponível."
      );
      return;
    }
    try {
      setPendingAction({ orderId, type: "charge" });
      setActionFeedback("Gerando cobrança...");
      await generateChargeMutation.mutateAsync({ id: orderId });
      setActionFeedback("Cobrança gerada com sucesso.");
      toast.success("Cobrança gerada.");
      await refreshEverything(orderId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível gerar cobrança.";
      setActionFeedback(`Ação indisponível: ${message}`);
      toast.error(message);
    } finally {
      setPendingAction(null);
    }
  }

  function goToWhatsAppServiceOrder(
    customerId: string,
    serviceOrderId: string
  ) {
    if (!String(customerId ?? "").trim()) {
      toast.error("O.S. sem cliente válido para WhatsApp.");
      return;
    }
    if (!String(serviceOrderId ?? "").trim()) {
      toast.error("O.S. inválida para abrir WhatsApp.");
      return;
    }
    navigate(
      `/whatsapp?customerId=${customerId}&serviceOrderId=${serviceOrderId}&template=SERVICE_UPDATE`
    );
  }
  const serviceOrdersOperationalStatus =
    getServiceOrdersOperationalStatus(counts);

  return (
    <AppPageShell className="gap-3">
      <AppOperationalHeader
        title="Ordens de Serviço"
        description="Centro de execução: priorize atrasos, responsáveis, conclusão e cobrança antes de navegar."
        density="compact"
        primaryAction={
          <Button type="button" onClick={() => setOpenCreate(true)}>
            Nova O.S.
          </Button>
        }
        contextChips={
          <>
            <AppOperationalStatusBadge
              status={serviceOrdersOperationalStatus}
            />
            <AppStatusBadge
              label={`${counts.all} O.S. retornadas`}
              tone="neutral"
            />
            <AppStatusBadge
              label={`${counts.overdue} atrasada(s)`}
              tone="warning"
            />
            <AppStatusBadge
              label={`${counts.doneWithoutCharge} concluída(s) sem cobrança`}
              tone="danger"
            />
          </>
        }
      >
        <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-3">
          <span>Execução real antes de cadastro.</span>
          <span>Atraso, responsável e cobrança ficam visíveis.</span>
          <span>Cliente, agenda, financeiro e WhatsApp seguem conectados.</span>
        </div>
      </AppOperationalHeader>

      <AppSectionCard className="space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="nexo-overline">Próxima melhor ação</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {nextExecution
                ? `Próxima execução: #${nextExecution.code}`
                : "Próxima execução"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {nextExecution
                ? `${nextExecution.customerName} · ${nextExecution.nextAction.reason} · ${nextExecution.dueDateLabel}`
                : "Nenhuma O.S. retornada pelo backend para priorização operacional."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppOperationalStatusBadge
              status={serviceOrdersOperationalStatus}
            />
            {nextExecution ? (
              <AppPriorityBadge
                priority={getServiceOrderPriority(nextExecution)}
              />
            ) : null}
            {nextExecution ? (
              <Button size="sm" onClick={() => runPrimaryAction(nextExecution)}>
                {nextExecution.nextAction.label}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenCreate(true)}
              >
                Criar O.S.
              </Button>
            )}
          </div>
        </div>
        {nextExecution ? (
          <div className="grid gap-2 md:grid-cols-3">
            <AppStatusBadge
              label={`Ação: ${nextExecution.nextAction.label}`}
              tone="info"
            />
            <AppStatusBadge
              label={`Motivo: ${nextExecution.nextAction.reason}`}
              tone="warning"
            />
            <AppStatusBadge
              label={`Impacto: ${nextExecution.riskLabel}`}
              tone="accent"
            />
          </div>
        ) : null}
      </AppSectionCard>

      <AppSectionBlock
        title="Saúde operacional"
        subtitle="Volume, execução e cobrança derivados dos dados existentes."
        compact
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {operationalKpis.map(kpi => (
            <AppStatCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              helper={kpi.helper}
              delta={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveFilter(kpi.filter)}
                >
                  Ver carteira
                </Button>
              }
            />
          ))}
        </div>
      </AppSectionBlock>

      <AppFiltersBar className="shrink-0 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2">
        <div className="min-w-[220px] flex-1">
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Buscar por código, cliente ou descrição"
            className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: `Todas (${counts.all})` },
            { key: "open", label: `Abertas (${counts.open})` },
            { key: "in_progress", label: `Em andamento (${counts.progress})` },
            { key: "overdue", label: `Atrasadas (${counts.overdue})` },
            { key: "done", label: `Concluídas (${counts.done})` },
          ].map(filter => (
            <button
              key={filter.key}
              type="button"
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                activeFilter === filter.key
                  ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
              onClick={() => setActiveFilter(filter.key as ServiceOrdersFilter)}
            >
              {filter.label}
            </button>
          ))}
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              Mais filtros
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-[240px] gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
              <button
                type="button"
                className={cn(
                  "h-8 rounded-md border px-3 text-left text-xs font-medium transition-colors",
                  activeFilter === "without_charge"
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                onClick={() => setActiveFilter("without_charge")}
              >
                Concluídas sem cobrança ({counts.doneWithoutCharge})
              </button>
            </div>
          </details>
        </div>
        <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
          {filteredOrders.length} / {counts.all} O.S.
        </span>
      </AppFiltersBar>

      <div className="space-y-3">
        <AppSectionBlock
          title="Alertas operacionais"
          subtitle="Alertas compactos: atraso, parada, responsável e cobrança."

          compact
        >
          {isLoading ? (
            <AppPageLoadingState description="Carregando alertas de O.S..." />
          ) : immediateAttention.length === 0 ? (
            <AppPageEmptyState
              title="Sem alerta imediato"
              description="Os dados retornados não indicam O.S. atrasada, sem responsável, concluída sem cobrança ou parada sem prazo."
            />
          ) : (
            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
              {immediateAttention.slice(0, 4).map(item => (
                <article
                  key={`attention-${item.id}`}
                  className={cn(
                    "rounded-lg border p-3",
                    item.status === "DONE" && !item.hasCharge
                      ? "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-subtle))]"
                      : item.isOverdue
                        ? "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface-subtle))]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-subtle)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        #{item.code} · {item.customerName}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {item.riskLabel}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {item.title} · {item.responsibleName} ·{" "}
                        {item.dueDateLabel}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => runPrimaryAction(item)}>
                      {item.nextAction.label}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AppSectionBlock>

        <div className="flex flex-col gap-3">
          <AppSectionBlock
            title="Lista operacional de O.S."
            subtitle="Número, cliente, estado, prazo, responsável e ação rápida."
            className="flex flex-col"
            compact
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
                title={
                  searchTerm.trim()
                    ? "Busca sem resultado"
                    : "Nenhuma ordem encontrada"
                }
                description={
                  searchTerm.trim()
                    ? "Ajuste o termo de busca ou os filtros para continuar."
                    : "Crie uma nova O.S. para iniciar o fluxo operacional."
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="max-h-[560px] overflow-auto">
                  <AppDataTable className="min-w-[760px]">
                    <thead>
                      <tr>
                        <th>O.S. / cliente</th>
                        <th>Estado</th>
                        <th>Prazo / responsável</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map(item => {
                        const canStart =
                          capabilities.start &&
                          ["OPEN", "ASSIGNED"].includes(item.status);
                        const canComplete =
                          capabilities.complete &&
                          item.status === "IN_PROGRESS";
                        const canGenerateCharge =
                          capabilities.generateCharge &&
                          item.status === "DONE" &&
                          !item.hasCharge;

                        return (
                          <tr
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "cursor-pointer align-top transition-colors hover:bg-[var(--surface-subtle)]/60",
                              selectedOrder?.id === item.id
                                ? "bg-[var(--accent-soft)]/35"
                                : undefined
                            )}
                            onClick={() => setSelectedOrderId(item.id)}
                            onKeyDown={event => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedOrderId(item.id);
                              }
                            }}
                          >
                            <td>
                              <div className="min-w-[220px] space-y-1">
                                <p className="font-semibold text-[var(--text-primary)]">
                                  #{item.code} · {item.title}
                                </p>
                                <p className="max-w-[300px] truncate text-xs text-[var(--text-secondary)]">
                                  {item.customerName}
                                </p>
                                <p className="text-xs text-[var(--text-muted)]">
                                  {formatCurrency(item.amountCents)} · {item.financialStatusLabel}
                                </p>
                              </div>
                            </td>
                            <td>
                              <div className="flex min-w-[190px] flex-col items-start gap-2">
                                <AppOperationalStatusBadge
                                  status={getServiceOrderOperationalStatus(
                                    item
                                  )}
                                  label={getStatusTone(
                                    item.status,
                                    item.isOverdue
                                  )}
                                />
                                <AppPriorityBadge
                                  priority={getServiceOrderPriority(item)}
                                  label={item.riskLabel}
                                />
                                <span className="text-xs text-[var(--text-muted)]">
                                  Execução: {item.statusLabel}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="min-w-[190px] space-y-1 text-xs text-[var(--text-secondary)]">
                                <p className="font-medium text-[var(--text-primary)]">
                                  {item.responsibleName}
                                </p>
                                <p>Prazo: {item.dueDateLabel}</p>
                                <p>
                                  Agenda:{" "}
                                  {item.linkedAppointment
                                    ? formatDate(
                                        item.linkedAppointment?.startsAt
                                      )
                                    : "Sem agendamento vinculado"}
                                </p>
                              </div>
                            </td>
                            <td onClick={event => event.stopPropagation()}>
                              <div className="flex min-w-[170px] items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => runPrimaryAction(item)}
                                >
                                  {item.nextAction.label}
                                </Button>
                                <AppRowActionsDropdown
                                  triggerLabel="Ações da O.S."
                                  items={[
                                    {
                                      label: capabilities.start
                                        ? "Iniciar"
                                        : "Iniciar (indisponível)",
                                      tone: "primary",
                                      onSelect: () => void handleStart(item.id),
                                      disabled: !canStart || anyActionPending,
                                    },
                                    {
                                      label: capabilities.complete
                                        ? "Concluir"
                                        : "Concluir (indisponível)",
                                      tone: "primary",
                                      onSelect: () =>
                                        void handleComplete(item.id),
                                      disabled:
                                        !canComplete || anyActionPending,
                                    },
                                    {
                                      label: capabilities.generateCharge
                                        ? "Gerar cobrança"
                                        : "Gerar cobrança (indisponível)",
                                      tone: "primary",
                                      onSelect: () =>
                                        void handleGenerateCharge(item.id),
                                      disabled:
                                        !canGenerateCharge || anyActionPending,
                                    },
                                    {
                                      label: capabilities.edit
                                        ? "Editar"
                                        : "Editar (indisponível)",
                                      tone: "primary",
                                      onSelect: () => setEditingId(item.id),
                                      disabled: !capabilities.edit,
                                    },
                                    {
                                      type: "separator",
                                      label: "Navegação",
                                    },
                                    {
                                      label: "Abrir O.S.",
                                      onSelect: () =>
                                        setSelectedOrderId(item.id),
                                    },
                                    {
                                      label: "Enviar WhatsApp",
                                      onSelect: () =>
                                        goToWhatsAppServiceOrder(
                                          String(item.customerId ?? ""),
                                          String(item.id ?? "")
                                        ),
                                    },
                                    {
                                      label: "Ver cliente",
                                      onSelect: () =>
                                        navigate(
                                          `/customers?customerId=${item.customerId}`
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
                  </AppDataTable>
                </div>
                <AppPagination
                  currentPage={currentPage}
                  totalItems={filteredOrders.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Detalhe da O.S."
            subtitle="Status, cliente, serviço, responsável, prazo, ações, financeiro e timeline curta."
            className="flex flex-col"
            compact
          >
            {!selectedOrder ? (
              <AppPageEmptyState
                title="Selecione uma O.S."
                description="Ao selecionar, o painel mostra execução, cliente, agenda, cobrança e histórico."
              />
            ) : (
              <div className="space-y-3">
                <article className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/35 p-3">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    Resumo
                  </p>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    #{selectedOrder.code} · {selectedOrder.title}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {selectedOrder.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                    <AppOperationalStatusBadge
                      status={getServiceOrderOperationalStatus(selectedOrder)}
                      label={getStatusTone(
                        selectedOrder.status,
                        selectedOrder.isOverdue
                      )}
                    />
                    <span>Responsável: {selectedOrder.responsibleName}</span>
                    <span>Prazo: {selectedOrder.dueDateLabel}</span>
                  </div>
                </article>

                <div className="grid gap-3 md:grid-cols-2">
                  <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <p className="text-xs uppercase text-[var(--text-muted)]">
                      Cliente e datas
                    </p>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {selectedOrder.customerName}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Início execução:{" "}
                      {formatDate(selectedOrder.startedAt, "Não iniciada")}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Conclusão:{" "}
                      {formatDate(selectedOrder.finishedAt, "Não concluída")}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Criada em: {formatDate(selectedOrder.raw?.createdAt)}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Atualizada em: {formatDate(selectedOrder.raw?.updatedAt)}
                    </p>
                  </article>

                  <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                    <p className="text-xs uppercase text-[var(--text-muted)]">
                      Cobrança / financeiro
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Valor: {formatCurrency(selectedOrder.amountCents)}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Status:{" "}
                      {selectedOrder.hasCharge
                        ? "Cobrança vinculada"
                        : "Sem cobrança"}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Cobrança ID:{" "}
                      {safeText(selectedOrder.linkedCharge?.id, "—")}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Vencimento:{" "}
                      {formatDate(selectedOrder.linkedCharge?.dueDate, "—")}
                    </p>
                  </article>
                </div>

                <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                  <p className="text-xs uppercase text-[var(--text-muted)]">
                    Agendamento vinculado
                  </p>
                  {selectedOrder.linkedAppointment ? (
                    <div className="space-y-1">
                      <p className="text-[var(--text-secondary)]">
                        ID: {String(selectedOrder.linkedAppointment?.id ?? "—")}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Status:{" "}
                        {safeText(selectedOrder.linkedAppointment?.status)}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        Início:{" "}
                        {formatDate(selectedOrder.linkedAppointment?.startsAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[var(--text-secondary)]">
                      Nenhum agendamento vinculado.
                    </p>
                  )}
                </article>

                <article className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                  <p className="text-xs uppercase text-[var(--text-muted)]">
                    Timeline / histórico
                  </p>
                  {timelineQuery.isLoading ? (
                    <p className="text-[var(--text-secondary)]">
                      Carregando histórico...
                    </p>
                  ) : timeline.length === 0 ? (
                    <p className="text-[var(--text-secondary)]">
                      Sem eventos registrados para esta O.S.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {timeline.map(event => (
                        <li
                          key={String(
                            event?.id ?? `${event?.action}-${event?.createdAt}`
                          )}
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

                <AppActionBar className="gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-2">
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
                    {capabilities.complete
                      ? "Concluir"
                      : "Concluir (indisponível)"}
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
                      goToWhatsAppServiceOrder(
                        String(selectedOrder.customerId ?? ""),
                        String(selectedOrder.id ?? "")
                      )
                    }
                  >
                    Enviar WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        `/customers?customerId=${selectedOrder.customerId}`
                      )
                    }
                  >
                    Abrir cliente
                  </Button>
                </AppActionBar>

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
        initialCustomerId={
          urlCustomerId || selectedOrder?.customerId || undefined
        }
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
    </AppPageShell>
  );
}
