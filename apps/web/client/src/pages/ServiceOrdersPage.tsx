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
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
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

function getChargeStatus(charge: any) {
  return String(charge?.status ?? "")
    .trim()
    .toUpperCase();
}

function isChargeOverdue(charge: any) {
  const status = getChargeStatus(charge);
  if (status === "OVERDUE") return true;
  if (status !== "PENDING") return false;
  const dueDate = toDate(charge?.dueDate);
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function hasPaymentEvidence(charge: any) {
  return (
    getChargeStatus(charge) === "PAID" ||
    (Array.isArray(charge?.payments) && charge.payments.length > 0)
  );
}

function getAppointmentStatus(appointment: any) {
  return String(appointment?.status ?? "")
    .trim()
    .toUpperCase();
}

function getOperationalDateLabel(value: unknown) {
  const date = toDate(value);
  return date ? formatDate(date) : "Sem data oficial";
}

function getPrimaryAction(item: {
  status: string;
  isOverdue: boolean;
  hasCharge: boolean;
  assignedToPersonId: string;
  linkedCharge?: any;
}) {
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
  if (item.status === "DONE" && !item.hasCharge) {
    return {
      label: "Gerar cobrança",
      type: "charge" as const,
      reason: "Concluída sem cobrança",
    };
  }
  if (isChargeOverdue(item.linkedCharge)) {
    return {
      label: "Cobrar cliente",
      type: "select" as const,
      reason: "Cobrança vencida vinculada",
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
  linkedCharge?: any;
}) {
  if (item.isOverdue) return "Atrasada";
  if (item.status === "DONE" && !item.hasCharge)
    return "Alerta: concluída sem cobrança";
  if (isChargeOverdue(item.linkedCharge)) return "Cobrança vencida vinculada";
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
  linkedCharge?: any;
}): AppOperationalStatus {
  if (item.isOverdue) return "RISCO";
  if (item.status === "DONE" && !item.hasCharge) return "RISCO";
  if (isChargeOverdue(item.linkedCharge)) return "RISCO";
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
  linkedCharge?: any;
}): AppPriorityLevel {
  if (item.isOverdue) return "P0";
  if (item.status === "DONE" && !item.hasCharge) return "P0";
  if (isChargeOverdue(item.linkedCharge)) return "P0";
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
      const chargeStatus = getChargeStatus(linkedCharge);
      const chargeOverdue = isChargeOverdue(linkedCharge);
      const chargePending = chargeStatus === "PENDING";
      const paymentConfirmed = hasPaymentEvidence(linkedCharge);
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
        chargeStatus,
        chargeOverdue,
        chargePending,
        paymentConfirmed,
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
    const overdueCharges = enrichedOrders.filter(
      item => item.chargeOverdue
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
      overdueCharges,
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
          item.chargeOverdue ||
          (item.status === "IN_PROGRESS" && !item.dueDate)
      )
      .sort((a, b) => {
        const score = (item: typeof a) => {
          if (item.isOverdue) return 6;
          if (!item.assignedToPersonId) return 5;
          if (item.status === "DONE" && !item.hasCharge) return 4;
          if (item.chargeOverdue) return 3;
          if (item.status === "IN_PROGRESS" && !item.dueDate) return 2;
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

  const commandTarget = selectedOrder ?? nextExecution;

  const serviceOrderCommandState = useMemo(() => {
    if (!commandTarget) {
      const level: OperationalStateLevel =
        counts.all > 0 ? "NORMAL" : "WARNING";
      return {
        level,
        reason:
          counts.all > 0
            ? "Carteira carregada sem O.S. selecionada para detalhe."
            : "Nenhuma O.S. retornada para leitura operacional.",
        impact:
          counts.all > 0
            ? "Selecione uma O.S. para conectar execução, cobrança, pagamento, Timeline e Governança."
            : "A operação ainda não tem execução rastreável nesta página.",
        cta: counts.all > 0 ? "Selecionar O.S." : "Criar O.S.",
      };
    }

    if (commandTarget.status === "CANCELED") {
      return {
        level: "WARNING" as OperationalStateLevel,
        reason:
          "O.S. cancelada; execução não deve avançar sem revisão do histórico.",
        impact:
          "Governança precisa conferir motivo, Timeline e impacto financeiro antes de nova ação.",
        cta: "Revisar histórico",
      };
    }
    if (commandTarget.isOverdue) {
      return {
        level: "RESTRICTED" as OperationalStateLevel,
        reason: `Prazo vencido em ${commandTarget.dueDateLabel}.`,
        impact:
          "Execução travada pode atrasar agenda, cobrança, pagamento e prova operacional.",
        cta: "Destravar execução",
      };
    }
    if (commandTarget.status === "DONE" && !commandTarget.hasCharge) {
      return {
        level: "RESTRICTED" as OperationalStateLevel,
        reason:
          "Serviço concluído sem cobrança vinculada nos dados carregados.",
        impact:
          "Execução já aconteceu, mas ainda não virou receita operacional rastreável.",
        cta: "Gerar cobrança",
      };
    }
    if (commandTarget.chargeOverdue) {
      return {
        level: "RESTRICTED" as OperationalStateLevel,
        reason: "Cobrança vinculada está vencida.",
        impact:
          "Pagamento bloqueia o fechamento do ciclo e aumenta risco financeiro/governança.",
        cta: "Cobrar cliente",
      };
    }
    if (!commandTarget.assignedToPersonId) {
      return {
        level: "WARNING" as OperationalStateLevel,
        reason: "O.S. aberta sem responsável definido.",
        impact:
          "Sem dono explícito, a execução pode parar e perder prova de responsabilidade.",
        cta: "Atribuir responsável",
      };
    }
    if (["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(commandTarget.status)) {
      return {
        level: "WARNING" as OperationalStateLevel,
        reason: `${commandTarget.statusLabel} aguardando avanço operacional.`,
        impact:
          "A execução ainda precisa virar conclusão para liberar cobrança e pagamento.",
        cta:
          commandTarget.status === "IN_PROGRESS"
            ? "Concluir serviço"
            : "Atualizar andamento",
      };
    }
    return {
      level: "NORMAL" as OperationalStateLevel,
      reason: "O.S. sem pendência crítica nos dados carregados.",
      impact:
        "Execução, cobrança e pagamento podem ser revisados pela Timeline e pela Governança.",
      cta: "Revisar detalhes",
    };
  }, [commandTarget, counts.all]);

  const serviceOrderRisk = useMemo(() => {
    if (!commandTarget) {
      return {
        title: "Sem O.S. em foco",
        reason: "A carteira não retornou uma execução selecionável.",
        impact: "Não há risco específico para explicar sem dados reais de O.S.",
        cta: "Criar O.S.",
      };
    }
    if (commandTarget.isOverdue) {
      return {
        title: "Execução atrasada",
        reason: `A O.S. #${commandTarget.code} passou do prazo ${commandTarget.dueDateLabel}.`,
        impact:
          "Atraso pressiona agenda, posterga cobrança/pagamento e exige evidência na Timeline.",
        cta: "Ver atrasadas",
      };
    }
    if (
      !commandTarget.assignedToPersonId &&
      commandTarget.status !== "DONE" &&
      commandTarget.status !== "CANCELED"
    ) {
      return {
        title: "Execução sem responsável",
        reason: "Nenhuma pessoa responsável foi retornada para esta O.S.",
        impact:
          "Sem owner, fica mais difícil cobrar andamento, concluir serviço e auditar governança.",
        cta: "Atribuir responsável",
      };
    }
    if (commandTarget.status === "DONE" && !commandTarget.hasCharge) {
      return {
        title: "Receita não capturada",
        reason:
          "A O.S. está concluída, mas sem cobrança vinculada nos dados carregados.",
        impact:
          "O serviço executado ainda não entrou no fluxo de recebimento e conciliação.",
        cta: "Gerar cobrança",
      };
    }
    if (commandTarget.chargeOverdue) {
      return {
        title: "Cobrança vencida vinculada",
        reason: `Cobrança ${safeText(commandTarget.linkedCharge?.id, "vinculada")} passou do vencimento ${formatDate(commandTarget.linkedCharge?.dueDate, "sem data")}.`,
        impact:
          "O dinheiro está travado após a execução e deve gerar ação de cobrança com prova operacional.",
        cta: "Cobrar cliente",
      };
    }
    if (commandTarget.status === "IN_PROGRESS" && !commandTarget.dueDate) {
      return {
        title: "Execução sem prazo",
        reason:
          "A O.S. está em andamento, mas não tem prazo confiável retornado.",
        impact:
          "Sem data, a agenda e a governança perdem referência para cobrança de avanço.",
        cta: "Editar O.S.",
      };
    }
    return {
      title: "Sem bloqueio crítico",
      reason:
        "Status, responsável, prazo e cobrança não indicam risco imediato.",
      impact:
        "Mantenha a prova operacional atualizada para sustentar cobrança, pagamento e governança.",
      cta: "Revisar detalhes",
    };
  }, [commandTarget]);

  const serviceOrderNextBestAction = useMemo(() => {
    if (!commandTarget) {
      return {
        title: "Criar ou selecionar O.S.",
        entity: "Carteira de Ordens de Serviço",
        reason: "Sem execução selecionada para orientar com segurança.",
        impact:
          "Permite iniciar o ciclo Cliente → Agendamento → O.S. → Cobrança → Pagamento.",
        safetyNote:
          "A camada apenas orienta; nenhuma O.S. é criada automaticamente.",
        primaryActionLabel: "Criar O.S.",
        secondaryActionLabel: counts.all > 0 ? "Ver carteira" : undefined,
        kind: "create" as const,
      };
    }
    const base = {
      entity: `O.S. #${commandTarget.code} · ${commandTarget.customerName}`,
      safetyNote:
        "Próxima Melhor Ação é orientação operacional; use os botões existentes para executar e registrar evidência real.",
    };
    if (commandTarget.isOverdue) {
      return {
        ...base,
        title: "Destravar execução",
        reason: `Prazo vencido (${commandTarget.dueDateLabel}) com status ${commandTarget.statusLabel}.`,
        impact:
          "Reduz atraso em agenda e libera caminho para cobrança, pagamento e Timeline.",
        primaryActionLabel:
          commandTarget.status === "IN_PROGRESS"
            ? "Concluir serviço"
            : "Iniciar agora",
        secondaryActionLabel: "Ver detalhes",
        kind:
          commandTarget.status === "IN_PROGRESS"
            ? ("complete" as const)
            : ("start" as const),
      };
    }
    if (
      !commandTarget.assignedToPersonId &&
      commandTarget.status !== "DONE" &&
      commandTarget.status !== "CANCELED"
    ) {
      return {
        ...base,
        title: "Atribuir responsável",
        reason: "A O.S. não tem owner operacional nos dados retornados.",
        impact:
          "Cria accountability para andamento, conclusão e evidência de execução.",
        primaryActionLabel: "Editar responsável",
        secondaryActionLabel: "Ver detalhes",
        kind: "edit" as const,
      };
    }
    if (["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(commandTarget.status)) {
      return {
        ...base,
        title:
          commandTarget.status === "IN_PROGRESS"
            ? "Concluir serviço"
            : "Atualizar andamento",
        reason: `A execução está ${commandTarget.statusLabel.toLowerCase()} e precisa avançar.`,
        impact:
          "A próxima movimentação aproxima a O.S. da cobrança e da prova operacional.",
        primaryActionLabel:
          commandTarget.status === "IN_PROGRESS" ? "Concluir" : "Iniciar",
        secondaryActionLabel: "Editar O.S.",
        kind:
          commandTarget.status === "IN_PROGRESS"
            ? ("complete" as const)
            : ("start" as const),
      };
    }
    if (commandTarget.status === "DONE" && !commandTarget.hasCharge) {
      return {
        ...base,
        title: "Gerar cobrança",
        reason: "Serviço concluído sem cobrança vinculada.",
        impact:
          "Transforma execução concluída em receita cobrável e rastreável.",
        primaryActionLabel: "Gerar cobrança",
        secondaryActionLabel: "Abrir financeiro",
        kind: "charge" as const,
      };
    }
    if (commandTarget.chargeOverdue) {
      return {
        ...base,
        title: "Cobrar cliente",
        reason: "Cobrança vinculada está vencida.",
        impact:
          "Tenta destravar pagamento e reduz risco financeiro/governança.",
        primaryActionLabel: "Abrir contexto de cobrança",
        secondaryActionLabel: "Abrir cliente",
        kind: "collect" as const,
      };
    }
    if (commandTarget.status === "CANCELED") {
      return {
        ...base,
        title: "Revisar histórico",
        reason:
          "O.S. cancelada não deve gerar execução/cobrança sem auditoria.",
        impact: "Protege governança e evita cobrança indevida.",
        primaryActionLabel: "Abrir Timeline",
        secondaryActionLabel: "Abrir cliente",
        kind: "timeline" as const,
      };
    }
    return {
      ...base,
      title: "Revisar detalhes da O.S.",
      reason: "Não há pendência crítica nos dados carregados.",
      impact:
        "Mantém conferência de execução, cobrança, pagamento, Timeline e Governança.",
      primaryActionLabel: "Revisar detalhes",
      secondaryActionLabel: "Abrir Timeline",
      kind: "detail" as const,
    };
  }, [commandTarget, counts.all]);

  const serviceOrderFlowStages = useMemo(() => {
    const order = commandTarget;
    const noOrderState: OperationalFlowStageState =
      counts.all > 0 ? "idle" : "warning";
    if (!order) {
      return [
        {
          id: "customer",
          label: "Cliente",
          summary: "Sem O.S. selecionada para vínculo de cliente.",
          state: noOrderState,
        },
        {
          id: "appointment",
          label: "Agendamento",
          summary: "Selecione uma O.S. para verificar origem na agenda.",
          state: "idle" as OperationalFlowStageState,
        },
        {
          id: "service-order",
          label: "O.S.",
          summary: `${counts.all} O.S. retornada(s) na carteira.`,
          countOrValue: String(counts.all),
          state:
            counts.all > 0
              ? ("active" as OperationalFlowStageState)
              : ("idle" as OperationalFlowStageState),
        },
        {
          id: "charge",
          label: "Cobrança",
          summary: `${counts.doneWithoutCharge} concluída(s) sem cobrança.`,
          countOrValue: String(counts.doneWithoutCharge),
          state:
            counts.doneWithoutCharge > 0
              ? ("blocked" as OperationalFlowStageState)
              : ("idle" as OperationalFlowStageState),
        },
        {
          id: "payment",
          label: "Pagamento",
          summary: "Pagamento depende de cobrança vinculada.",
          state: "idle" as OperationalFlowStageState,
        },
        {
          id: "timeline",
          label: "Timeline",
          summary: "Prova oficial aparece após selecionar a O.S.",
          state: "idle" as OperationalFlowStageState,
        },
        {
          id: "risk",
          label: "Risco/Governança",
          summary: `${counts.overdue + counts.unassigned + counts.doneWithoutCharge} alerta(s) de carteira.`,
          countOrValue: String(
            counts.overdue + counts.unassigned + counts.doneWithoutCharge
          ),
          state:
            counts.overdue + counts.unassigned + counts.doneWithoutCharge > 0
              ? ("warning" as OperationalFlowStageState)
              : ("done" as OperationalFlowStageState),
        },
      ];
    }
    const appointmentStatus = getAppointmentStatus(order.linkedAppointment);
    const appointmentWarning = ["PENDING", "REQUESTED", "UNCONFIRMED"].includes(
      appointmentStatus
    );
    const serviceState: OperationalFlowStageState = order.isOverdue
      ? "blocked"
      : !order.assignedToPersonId &&
          order.status !== "DONE" &&
          order.status !== "CANCELED"
        ? "warning"
        : order.status === "DONE"
          ? "done"
          : ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(order.status)
            ? "active"
            : order.status === "CANCELED"
              ? "blocked"
              : "idle";
    const chargeState: OperationalFlowStageState =
      order.status === "DONE" && !order.hasCharge
        ? "blocked"
        : order.chargeOverdue
          ? "blocked"
          : order.chargePending
            ? "warning"
            : order.hasCharge
              ? "done"
              : "idle";
    const paymentState: OperationalFlowStageState = order.paymentConfirmed
      ? "done"
      : order.chargeOverdue
        ? "blocked"
        : order.chargePending
          ? "warning"
          : order.hasCharge
            ? "warning"
            : "idle";
    const riskState: OperationalFlowStageState =
      order.isOverdue ||
      (order.status === "DONE" && !order.hasCharge) ||
      order.chargeOverdue
        ? "blocked"
        : !order.assignedToPersonId ||
            (order.status === "IN_PROGRESS" && !order.dueDate)
          ? "warning"
          : "done";
    return [
      {
        id: "customer",
        label: "Cliente",
        summary: order.customerId
          ? `Cliente vinculado: ${order.customerName}.`
          : "O.S. sem cliente confiável retornado.",
        state: order.customerId
          ? ("done" as OperationalFlowStageState)
          : ("blocked" as OperationalFlowStageState),
        hrefLabel: "Abrir cliente",
        onClick: order.customerId
          ? () => navigate(`/customers?customerId=${order.customerId}`)
          : undefined,
      },
      {
        id: "appointment",
        label: "Agendamento",
        summary: order.linkedAppointment
          ? `Origem na agenda com status ${safeText(appointmentStatus, "informado")}.`
          : "Sem agendamento vinculado nos dados carregados.",
        state: (order.linkedAppointment
          ? appointmentWarning
            ? "warning"
            : "done"
          : "idle") as OperationalFlowStageState,
        hrefLabel: "Abrir agenda",
        onClick: order.appointmentId
          ? () => navigate(`/appointments?id=${order.appointmentId}`)
          : undefined,
      },
      {
        id: "service-order",
        label: "O.S.",
        summary: `${order.statusLabel}; responsável: ${order.responsibleName}; prazo: ${order.dueDateLabel}.`,
        countOrValue: `#${order.code}`,
        state: serviceState,
      },
      {
        id: "charge",
        label: "Cobrança",
        summary: order.hasCharge
          ? `${order.financialStatusLabel}; valor ${formatCurrency(order.amountCents)}.`
          : order.status === "DONE"
            ? "Concluída sem cobrança vinculada."
            : "Cobrança ainda não gerada para esta execução.",
        countOrValue: order.hasCharge
          ? formatCurrency(order.amountCents)
          : undefined,
        state: chargeState,
        hrefLabel: "Abrir financeiro",
        onClick: () => navigate("/finances"),
      },
      {
        id: "payment",
        label: "Pagamento",
        summary: order.paymentConfirmed
          ? "Pagamento confirmado ou evidência de pagamento retornada."
          : order.hasCharge
            ? "Pagamento ainda precisa ser acompanhado no financeiro."
            : "Sem cobrança, ainda não há pagamento esperado.",
        state: paymentState,
        hrefLabel: "Abrir financeiro",
        onClick: () => navigate("/finances"),
      },
      {
        id: "timeline",
        label: "Timeline",
        summary:
          timeline.length > 0
            ? `${timeline.length} evento(s) oficiais retornados.`
            : "Sem evento oficial retornado para esta O.S.",
        countOrValue: String(timeline.length),
        state: (timeline.length > 0
          ? "done"
          : "idle") as OperationalFlowStageState,
        hrefLabel: "Abrir Timeline",
        onClick: () => navigate(`/timeline?serviceOrderId=${order.id}`),
      },
      {
        id: "risk",
        label: "Risco/Governança",
        summary: serviceOrderRisk.title,
        state: riskState,
      },
    ];
  }, [
    commandTarget,
    counts,
    navigate,
    serviceOrderRisk.title,
    timeline.length,
  ]);

  const serviceOrderTimelineEvents = useMemo(() => {
    if (timeline.length > 0) {
      return timeline.slice(0, 4).map(event => ({
        id: String(
          event?.id ?? `${event?.action ?? event?.type}-${event?.createdAt}`
        ),
        type: safeText(
          event?.action ?? event?.type ?? event?.category,
          "Timeline"
        ),
        occurredAt: getOperationalDateLabel(
          event?.createdAt ?? event?.occurredAt
        ),
        entity: commandTarget
          ? `O.S. #${commandTarget.code}`
          : "Ordem de Serviço",
        actor: event?.actor?.name ?? event?.user?.name ?? undefined,
        summary: safeText(
          event?.description ?? event?.summary,
          "Evento oficial retornado pela Timeline."
        ),
      }));
    }
    if (!commandTarget) return [];
    const contextualEvents: Array<{
      id: string;
      type: string;
      occurredAt: string;
      entity: string;
      summary: string;
      actor?: string;
    }> = [];
    if (commandTarget.raw?.createdAt) {
      contextualEvents.push({
        id: `created-${commandTarget.id}`,
        type: "O.S. criada",
        occurredAt: getOperationalDateLabel(commandTarget.raw.createdAt),
        entity: `O.S. #${commandTarget.code}`,
        summary:
          "Evento contextual derivado da data real de criação da O.S.; não substitui a Timeline oficial.",
        actor:
          commandTarget.responsibleName !== "Sem responsável"
            ? commandTarget.responsibleName
            : undefined,
      });
    }
    if (commandTarget.startedAt) {
      contextualEvents.push({
        id: `started-${commandTarget.id}`,
        type: "Execução iniciada",
        occurredAt: getOperationalDateLabel(commandTarget.startedAt),
        entity: commandTarget.title,
        summary:
          "Evento contextual derivado da data real de início da execução.",
        actor:
          commandTarget.responsibleName !== "Sem responsável"
            ? commandTarget.responsibleName
            : undefined,
      });
    }
    if (commandTarget.finishedAt) {
      contextualEvents.push({
        id: `finished-${commandTarget.id}`,
        type: "Execução concluída",
        occurredAt: getOperationalDateLabel(commandTarget.finishedAt),
        entity: commandTarget.title,
        summary: "Evento contextual derivado da data real de conclusão da O.S.",
        actor:
          commandTarget.responsibleName !== "Sem responsável"
            ? commandTarget.responsibleName
            : undefined,
      });
    }
    if (
      commandTarget.linkedCharge?.createdAt ||
      commandTarget.linkedCharge?.id
    ) {
      contextualEvents.push({
        id: `charge-${commandTarget.linkedCharge?.id ?? commandTarget.id}`,
        type: "Cobrança gerada",
        occurredAt: getOperationalDateLabel(
          commandTarget.linkedCharge?.createdAt
        ),
        entity: `${commandTarget.financialStatusLabel} · ${formatCurrency(commandTarget.amountCents)}`,
        summary:
          "Evento contextual derivado da cobrança vinculada retornada pelo financeiro.",
      });
    }
    return contextualEvents.slice(0, 4);
  }, [commandTarget, timeline]);

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

  function runCommandPrimaryAction() {
    const order = commandTarget;
    if (!order) {
      setOpenCreate(true);
      return;
    }
    setSelectedOrderId(order.id);
    if (serviceOrderNextBestAction.kind === "start") {
      void handleStart(order.id);
      return;
    }
    if (serviceOrderNextBestAction.kind === "complete") {
      void handleComplete(order.id);
      return;
    }
    if (serviceOrderNextBestAction.kind === "charge") {
      void handleGenerateCharge(order.id);
      return;
    }
    if (serviceOrderNextBestAction.kind === "edit") {
      setEditingId(order.id);
      return;
    }
    if (serviceOrderNextBestAction.kind === "collect") {
      navigate("/finances");
      return;
    }
    if (serviceOrderNextBestAction.kind === "timeline") {
      navigate(`/timeline?serviceOrderId=${order.id}`);
    }
  }

  function runCommandSecondaryAction() {
    const order = commandTarget;
    if (!order) {
      setActiveFilter("all");
      return;
    }
    setSelectedOrderId(order.id);
    if (
      serviceOrderNextBestAction.secondaryActionLabel === "Editar O.S." ||
      serviceOrderNextBestAction.secondaryActionLabel === "Ver detalhes"
    ) {
      if (serviceOrderNextBestAction.secondaryActionLabel === "Editar O.S.")
        setEditingId(order.id);
      return;
    }
    if (
      serviceOrderNextBestAction.secondaryActionLabel === "Abrir financeiro"
    ) {
      navigate("/finances");
      return;
    }
    if (serviceOrderNextBestAction.secondaryActionLabel === "Abrir cliente") {
      navigate(`/customers?customerId=${order.customerId}`);
      return;
    }
    if (serviceOrderNextBestAction.secondaryActionLabel === "Abrir Timeline") {
      navigate(`/timeline?serviceOrderId=${order.id}`);
    }
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

      <div className="grid gap-3 xl:grid-cols-2">
        <OperationalStateCard
          title={
            commandTarget
              ? "Estado operacional da O.S."
              : "Estado operacional da carteira"
          }
          level={serviceOrderCommandState.level}
          reason={serviceOrderCommandState.reason}
          impact={serviceOrderCommandState.impact}
          detailsLabel={serviceOrderCommandState.cta}
          onDetails={() => {
            if (commandTarget) {
              setSelectedOrderId(commandTarget.id);
              if (serviceOrderCommandState.cta === "Gerar cobrança") {
                void handleGenerateCharge(commandTarget.id);
              } else if (
                serviceOrderCommandState.cta === "Atribuir responsável"
              ) {
                setEditingId(commandTarget.id);
              } else if (
                serviceOrderCommandState.cta === "Destravar execução"
              ) {
                runPrimaryAction(commandTarget);
              }
              return;
            }
            if (counts.all > 0) setActiveFilter("all");
            else setOpenCreate(true);
          }}
        />
        <OperationalRiskCard
          title={serviceOrderRisk.title}
          reason={serviceOrderRisk.reason}
          impact={serviceOrderRisk.impact}
          ctaLabel={serviceOrderRisk.cta}
          onClick={() => {
            if (!commandTarget) {
              setOpenCreate(true);
              return;
            }
            if (serviceOrderRisk.cta === "Ver atrasadas")
              setActiveFilter("overdue");
            else if (
              serviceOrderRisk.cta === "Atribuir responsável" ||
              serviceOrderRisk.cta === "Editar O.S."
            )
              setEditingId(commandTarget.id);
            else if (serviceOrderRisk.cta === "Gerar cobrança")
              void handleGenerateCharge(commandTarget.id);
            else if (serviceOrderRisk.cta === "Cobrar cliente")
              navigate("/finances");
            else setSelectedOrderId(commandTarget.id);
          }}
        />
      </div>

      <AppSectionCard className="space-y-0 border-0 bg-transparent p-0">
        <span className="sr-only">Próxima melhor ação de O.S.</span>
        <NextBestActionCard
          title={serviceOrderNextBestAction.title}
          entity={serviceOrderNextBestAction.entity}
          reason={serviceOrderNextBestAction.reason}
          impact={serviceOrderNextBestAction.impact}
          safetyNote={serviceOrderNextBestAction.safetyNote}
          primaryActionLabel={serviceOrderNextBestAction.primaryActionLabel}
          onPrimaryAction={runCommandPrimaryAction}
          secondaryActionLabel={serviceOrderNextBestAction.secondaryActionLabel}
          onSecondaryAction={
            serviceOrderNextBestAction.secondaryActionLabel
              ? runCommandSecondaryAction
              : undefined
          }
        />
      </AppSectionCard>

      <OperationalFlowCard
        title="Fluxo operacional da execução"
        subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança"
        stages={serviceOrderFlowStages}
      />

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
                                  {formatCurrency(item.amountCents)} ·{" "}
                                  {item.financialStatusLabel}
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

                <EntityTimelineCard
                  title="Prova operacional da execução"
                  subtitle={
                    timelineQuery.isLoading
                      ? "Carregando últimos eventos oficiais da O.S."
                      : timeline.length > 0
                        ? "Últimos eventos oficiais da O.S. retornados pela Timeline."
                        : serviceOrderTimelineEvents.length > 0
                          ? "Fallback contextual com datas reais da O.S.; não substitui a Timeline oficial."
                          : "Sem Timeline oficial retornada e sem datas suficientes para fallback contextual."
                  }
                  events={serviceOrderTimelineEvents}
                  fullTimelineLabel="Abrir Timeline completa"
                  onFullTimeline={() =>
                    navigate(`/timeline?serviceOrderId=${selectedOrder.id}`)
                  }
                />

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
