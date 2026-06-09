import { useEffect, useMemo, useState } from "react";
import { operationalCopy } from "@/lib/operational-semantics";
import { compareOperationalPriority } from "@/lib/operational-prioritization";
import { aggregateOperationalHealth } from "@/lib/operational-health";
import {
  detectOperationalInterventions,
  getPrimaryOperationalIntervention,
} from "@/lib/operational-interventions";
import {
  getAttentionSummary,
  getVisibleAttentionItems,
  type OperationalAttentionItem,
} from "@/lib/operational-attention";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { FormModal } from "@/components/app-modal-system";
import {
  AppActionBar,
  AppDataTable,
  AppFiltersBar,
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPagination,
  AppSectionBlock,
} from "@/components/internal-page-system";
import {
  AppField,
  AppFieldGroup,
  AppFormSection,
  AppInfoCard,
  AppInput,
  AppOperationalStatusBadge,
  AppPageShell,
  AppPriorityBadge,
  AppRowActionsDropdown,
  AppSectionCard,
  AppSelect,
  AppStatCard,
  AppStatusBadge,
  AppTextarea,
  type AppOperationalStatus,
  type AppPriorityLevel,
} from "@/components/app-system";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { cn } from "@/lib/utils";
import { safeDate } from "@/lib/operational/kpi";
import { trpc } from "@/lib/trpc";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import type { OperationalSeverity } from "@/lib/operations/operational-intelligence";

type ChargeRecord = Record<string, any>;
type StatusFilter = "all" | "pending" | "overdue" | "paid" | "canceled";

type PaymentMethod = "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER";

const PAYMENT_METHOD_OPTIONS: Array<{ label: string; value: PaymentMethod }> = [
  { label: "PIX", value: "PIX" },
  { label: "Cartão", value: "CARD" },
  { label: "Transferência", value: "TRANSFER" },
  { label: "Dinheiro", value: "CASH" },
  { label: "Outro", value: "OTHER" },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(value: unknown) {
  const date = safeDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "Sem data";
}

function normalizeStatus(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function computeDaysOverdue(value: unknown) {
  const dueDate = safeDate(value);
  if (!dueDate) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (start.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(diff, 0);
}

function computeDaysUntilDue(value: unknown) {
  const dueDate = safeDate(value);
  if (!dueDate) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function latestPaymentMethod(charge: ChargeRecord): string {
  const payments = Array.isArray(charge?.payments) ? charge.payments : [];
  if (payments.length === 0) return "—";
  const sorted = [...payments].sort((a, b) => {
    const aTime = safeDate(a?.paidAt ?? a?.createdAt)?.getTime() ?? 0;
    const bTime = safeDate(b?.paidAt ?? b?.createdAt)?.getTime() ?? 0;
    return bTime - aTime;
  });
  return String(sorted[0]?.method ?? "—");
}

function getChargeStatusTone(
  status: string
): "warning" | "success" | "danger" | "neutral" {
  if (status === "PAID") return "success";
  if (status === "OVERDUE") return "danger";
  if (status === "CANCELED") return "neutral";
  return "warning";
}

function getFinanceOperationalStatus(
  overdueCount: number,
  pendingCount: number
): AppOperationalStatus {
  if (overdueCount >= 5) return "CRÍTICO";
  if (overdueCount > 0) return "RISCO";
  if (pendingCount > 0) return "ATENÇÃO";
  return "NORMAL";
}

function getChargePriority(charge: ChargeRecord): AppPriorityLevel {
  const status = normalizeStatus(charge?.status);
  const amountCents = Number(charge?.amountCents ?? 0);
  const overdueDays = Number(
    charge?.overdueDays ?? computeDaysOverdue(charge?.dueDate)
  );
  if (status === "OVERDUE" && (overdueDays >= 15 || amountCents >= 500000))
    return "P0";
  if (status === "OVERDUE") return "P1";
  if (status === "PENDING") {
    const dueDate = safeDate(charge?.dueDate);
    if (!dueDate) return "P2";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 3 ? "P2" : "P3";
  }
  return "P3";
}

function chargeStatusLabel(status: string) {
  if (status === "OVERDUE") return "Vencida";
  if (status === "PAID") return "Paga";
  if (status === "CANCELED") return "Cancelada";
  return "Pendente";
}

function statusMatchesFilter(status: string, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "pending") return status === "PENDING";
  if (filter === "overdue") return status === "OVERDUE";
  if (filter === "paid") return status === "PAID";
  if (filter === "canceled") return status === "CANCELED";
  return true;
}

function safeText(value: unknown, fallback = "—") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function getChargePrimaryAction(charge: ChargeRecord) {
  const status = normalizeStatus(charge?.status);
  if (status === "OVERDUE") {
    return {
      label: "Cobrar agora",
      reason: "Cobrança vencida precisa de ação",
      kind: "collect" as const,
    };
  }
  if (status === "PENDING") {
    return {
      label: "Enviar link",
      reason: "Pendência ativa antes de virar atraso",
      kind: "collect" as const,
    };
  }
  if (status === "PAID") {
    return {
      label: "Ver recebimento",
      reason: "Pagamento já confirmado",
      kind: "detail" as const,
    };
  }
  return {
    label: "Revisar",
    reason: "Status exige conferência",
    kind: "detail" as const,
  };
}

function getChargeRisk(charge: ChargeRecord) {
  const status = normalizeStatus(charge?.status);
  if (status === "OVERDUE")
    return `Risco alto · ${Number(charge?.overdueDays ?? 0)} dia(s) em atraso`;
  if (status === "PENDING" && !safeDate(charge?.dueDate))
    return "Pendência: sem vencimento confiável";
  if (status === "PENDING")
    return "Risco monitorado · cobrar antes do vencimento";
  if (status === "PAID") return "Sem risco financeiro imediato";
  if (status === "CANCELED") return "Cancelada · sem ação de cobrança";
  return "Revisar dados da cobrança";
}

function hasRegisteredPayment(charge: ChargeRecord) {
  if (normalizeStatus(charge?.status) !== "PAID") return true;
  return Array.isArray(charge?.payments) && charge.payments.length > 0;
}

function getCommunicationState(charge: ChargeRecord) {
  const communicationFields = [
    charge?.whatsappSentAt,
    charge?.lastWhatsappSentAt,
    charge?.reminderSentAt,
    charge?.lastReminderAt,
    charge?.paymentLinkSentAt,
    charge?.messageSentAt,
  ];

  if (communicationFields.some(Boolean)) return "sent" as const;
  if (
    "whatsappSentAt" in charge ||
    "lastWhatsappSentAt" in charge ||
    "reminderSentAt" in charge ||
    "lastReminderAt" in charge
  ) {
    return "not_sent" as const;
  }
  return "unknown" as const;
}

export default function FinancesPage() {
  const [location, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const _operationalSeverityContract: OperationalSeverity = "healthy";
  void _operationalSeverityContract;
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [openPayModalFor, setOpenPayModalFor] = useState<ChargeRecord | null>(
    null
  );
  const [openEditModalFor, setOpenEditModalFor] = useState<ChargeRecord | null>(
    null
  );
  const [payMethod, setPayMethod] = useState<PaymentMethod>("PIX");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const queryParams = useMemo(() => {
    const url = location.includes("?") ? location.split("?")[1] : "";
    const params = new URLSearchParams(url);
    return {
      customerId: params.get("customerId") ?? "",
      serviceOrderId: params.get("serviceOrderId") ?? "",
      chargeId: params.get("chargeId") ?? "",
    };
  }, [location]);

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const customersQuery = trpc.nexo.customers.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 500 },
    { retry: false }
  );

  const markPaidMutation = trpc.finance.charges.pay.useMutation();
  const cancelMutation = trpc.finance.charges.delete.useMutation();
  const editMutation = trpc.finance.charges.update.useMutation();

  const charges = useMemo(
    () => normalizeArrayPayload<ChargeRecord>(chargesQuery.data),
    [chargesQuery.data]
  );
  const customers = useMemo(
    () => normalizeArrayPayload<any>(customersQuery.data),
    [customersQuery.data]
  );
  const serviceOrders = useMemo(
    () => normalizeArrayPayload<any>(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );

  const customerById = useMemo(
    () => new Map(customers.map(item => [String(item?.id ?? ""), item])),
    [customers]
  );

  const serviceOrderById = useMemo(
    () => new Map(serviceOrders.map(item => [String(item?.id ?? ""), item])),
    [serviceOrders]
  );

  const allQueriesLoading =
    chargesQuery.isLoading ||
    customersQuery.isLoading ||
    serviceOrdersQuery.isLoading;
  const allQueriesErrored = Boolean(chargesQuery.error && charges.length === 0);

  const enrichedCharges = useMemo<ChargeRecord[]>(() => {
    return charges.map((charge: ChargeRecord) => {
      const customerId = String(
        charge?.customerId ?? charge?.customer?.id ?? ""
      );
      const serviceOrderId = String(
        charge?.serviceOrderId ?? charge?.serviceOrder?.id ?? ""
      );
      const status = normalizeStatus(charge?.status);
      const customer = charge?.customer ?? customerById.get(customerId) ?? null;
      const serviceOrder =
        charge?.serviceOrder ?? serviceOrderById.get(serviceOrderId) ?? null;
      const overdueDays =
        status === "OVERDUE" ? computeDaysOverdue(charge?.dueDate) : 0;

      return {
        ...charge,
        status,
        customerId,
        serviceOrderId,
        customer,
        serviceOrder,
        customerName: String(
          customer?.name ?? charge?.customerName ?? "Cliente não identificado"
        ),
        serviceOrderLabel: String(
          serviceOrder?.number ??
            serviceOrder?.id ??
            serviceOrderId ??
            "Sem O.S."
        ),
        overdueDays,
      } as ChargeRecord;
    });
  }, [charges, customerById, serviceOrderById]);

  const scopedCharges = useMemo(() => {
    return enrichedCharges.filter(charge => {
      if (
        queryParams.customerId &&
        charge.customerId !== queryParams.customerId
      )
        return false;
      if (
        queryParams.serviceOrderId &&
        charge.serviceOrderId !== queryParams.serviceOrderId
      )
        return false;
      return true;
    });
  }, [enrichedCharges, queryParams.customerId, queryParams.serviceOrderId]);

  const filteredCharges = useMemo(() => {
    const filtered = scopedCharges.filter(charge => {
      if (!statusMatchesFilter(charge.status, statusFilter)) return false;
      const source =
        `${charge.customerName} ${charge.serviceOrderLabel} ${charge.status} ${charge.id ?? ""}`.toLowerCase();
      if (
        searchTerm.trim() &&
        !source.includes(searchTerm.toLowerCase().trim())
      )
        return false;
      return true;
    });

    return [...filtered].sort((a, b) =>
      compareOperationalPriority(
        {
          severity:
            a.status === "OVERDUE"
              ? "WARNING"
              : a.status === "PENDING"
                ? "ATTENTION"
                : "NORMAL",
          dueDate: a.dueDate,
          amountCents: Number(a.amountCents ?? 0),
        },
        {
          severity:
            b.status === "OVERDUE"
              ? "WARNING"
              : b.status === "PENDING"
                ? "ATTENTION"
                : "NORMAL",
          dueDate: b.dueDate,
          amountCents: Number(b.amountCents ?? 0),
        }
      )
    );
  }, [scopedCharges, searchTerm, statusFilter]);
  const paginatedCharges = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCharges.slice(start, start + pageSize);
  }, [currentPage, filteredCharges, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    queryParams.customerId,
    queryParams.serviceOrderId,
  ]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredCharges.length / pageSize)
    );
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, filteredCharges.length, pageSize]);

  const hasFiltersContext = Boolean(
    queryParams.customerId || queryParams.serviceOrderId
  );

  const health = useMemo(() => {
    const received = enrichedCharges
      .filter(item => item.status === "PAID")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const receivable = enrichedCharges
      .filter(item => item.status === "PENDING")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const overdue = enrichedCharges
      .filter(item => item.status === "OVERDUE")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const now = Date.now();
    const nextThirtyDays = now + 1000 * 60 * 60 * 24 * 30;
    const projected = enrichedCharges
      .filter(item => {
        if (!["PENDING", "OVERDUE"].includes(item.status)) return false;
        const due = safeDate(item?.dueDate)?.getTime();
        if (!due) return false;
        return due <= nextThirtyDays;
      })
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

    return { received, receivable, overdue, projected };
  }, [enrichedCharges]);

  const operationalHealth = useMemo(
    () =>
      aggregateOperationalHealth({
        charges: enrichedCharges,
        payments: enrichedCharges.flatMap(item =>
          Array.isArray(item.payments) ? item.payments : []
        ),
        serviceOrders,
      }),
    [enrichedCharges, serviceOrders]
  );

  const financeIntervention = useMemo(
    () =>
      getPrimaryOperationalIntervention(
        detectOperationalInterventions({
          charges: enrichedCharges,
          payments: enrichedCharges.flatMap(item =>
            Array.isArray(item.payments) ? item.payments : []
          ),
          serviceOrders,
        })
      ),
    [enrichedCharges, serviceOrders]
  );
  const highlightedFinancialAttention = useMemo(
    () =>
      getVisibleAttentionItems(
        enrichedCharges
          .filter(item => item.status === "OVERDUE")
          .map(
            item =>
              ({
                ...item,
                key: String(item.id ?? ""),
                domain: "finances",
                type: "overdue_charge",
                severity: "WARNING",
                amountCents: Number(item.amountCents ?? 0),
              }) as OperationalAttentionItem
          ),
        2
      ),
    [enrichedCharges]
  );
  const highlightedFinancialSummary = useMemo(
    () => getAttentionSummary(highlightedFinancialAttention),
    [highlightedFinancialAttention]
  );

  useEffect(() => {
    if (queryParams.chargeId) {
      setSelectedChargeId(queryParams.chargeId);
      return;
    }

    if (!selectedChargeId && filteredCharges.length > 0) {
      setSelectedChargeId(String(filteredCharges[0]?.id ?? ""));
    }
  }, [filteredCharges, queryParams.chargeId, selectedChargeId]);

  const selectedCharge = useMemo(() => {
    if (!selectedChargeId) return null;
    return (
      enrichedCharges.find(
        item => String(item?.id ?? "") === selectedChargeId
      ) ?? null
    );
  }, [enrichedCharges, selectedChargeId]);

  const selectedChargeDetailsQuery = trpc.finance.charges.getById.useQuery(
    { id: String(selectedChargeId ?? "") },
    { enabled: Boolean(selectedChargeId), retry: false }
  );

  const selectedFinancialRecord = useMemo(() => {
    const detailed = selectedChargeDetailsQuery.data as
      | ChargeRecord
      | undefined;
    return { ...(selectedCharge ?? {}), ...(detailed ?? {}) } as ChargeRecord;
  }, [selectedCharge, selectedChargeDetailsQuery.data]);

  const timelineByCustomerQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId: String(selectedCharge?.customerId ?? ""), limit: 20 },
    { enabled: Boolean(selectedCharge?.customerId), retry: false }
  );

  const timelineByServiceOrderQuery =
    trpc.nexo.timeline.listByServiceOrder.useQuery(
      {
        serviceOrderId: String(selectedCharge?.serviceOrderId ?? ""),
        limit: 20,
      },
      { enabled: Boolean(selectedCharge?.serviceOrderId), retry: false }
    );

  const timelineItems = useMemo(() => {
    const customerTimeline = normalizeArrayPayload<any>(
      timelineByCustomerQuery.data
    );
    const serviceOrderTimeline = normalizeArrayPayload<any>(
      timelineByServiceOrderQuery.data
    );
    const combined = [...customerTimeline, ...serviceOrderTimeline];
    const unique = new Map<string, any>();

    for (const item of combined) {
      const key = String(
        item?.id ?? `${item?.createdAt ?? ""}-${item?.title ?? ""}`
      );
      if (!unique.has(key)) unique.set(key, item);
    }

    return Array.from(unique.values())
      .sort((a, b) => {
        const aTime = safeDate(a?.createdAt)?.getTime() ?? 0;
        const bTime = safeDate(b?.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [timelineByCustomerQuery.data, timelineByServiceOrderQuery.data]);

  const hasSearchNoResults =
    Boolean(searchTerm.trim()) && filteredCharges.length === 0;
  const paymentsListAvailable = false;

  const completedOrdersWithoutCharge = useMemo(() => {
    const chargedOrderIds = new Set(
      enrichedCharges
        .map(charge => String(charge?.serviceOrderId ?? ""))
        .filter(Boolean)
    );

    return serviceOrders.filter(order => {
      const status = normalizeStatus(order?.status);
      const orderId = String(order?.id ?? "");
      return status === "DONE" && orderId && !chargedOrderIds.has(orderId);
    });
  }, [enrichedCharges, serviceOrders]);

  const cashHealth = useMemo(() => {
    const paidCount = enrichedCharges.filter(
      item => item.status === "PAID"
    ).length;
    const pendingCount = enrichedCharges.filter(
      item => item.status === "PENDING"
    ).length;
    const overdueCount = enrichedCharges.filter(
      item => item.status === "OVERDUE"
    ).length;
    const pendingAmount = health.receivable;
    const riskAmount = health.overdue;
    const collectionBottleneck = (() => {
      if (overdueCount > 0)
        return `${overdueCount} cobrança(s) vencida(s) travando recebimento`;
      if (completedOrdersWithoutCharge.length > 0)
        return `${completedOrdersWithoutCharge.length} O.S. concluída(s) sem cobrança`;
      if (pendingCount > paidCount)
        return "Mais pendências abertas do que recebimentos confirmados";
      return "Fluxo cobrança → pagamento sem gargalo crítico";
    })();

    return {
      paidCount,
      pendingCount,
      overdueCount,
      pendingAmount,
      riskAmount,
      collectionBottleneck,
    };
  }, [
    completedOrdersWithoutCharge.length,
    enrichedCharges,
    health.overdue,
    health.receivable,
  ]);

  const financeOperationalStatus = getFinanceOperationalStatus(
    cashHealth.overdueCount,
    cashHealth.pendingCount
  );

  const paidWithoutRegisteredPayment = useMemo(
    () => enrichedCharges.filter(item => !hasRegisteredPayment(item)),
    [enrichedCharges]
  );

  const mostCriticalCharge = useMemo(() => {
    const candidates = enrichedCharges.filter(item =>
      ["PENDING", "OVERDUE"].includes(item.status)
    );
    if (candidates.length === 0) return null;

    return [...candidates].sort((a, b) => {
      if (a.status !== b.status) return a.status === "OVERDUE" ? -1 : 1;
      const overdueDiff =
        Number(b.overdueDays ?? 0) - Number(a.overdueDays ?? 0);
      if (overdueDiff !== 0) return overdueDiff;
      return Number(b.amountCents ?? 0) - Number(a.amountCents ?? 0);
    })[0];
  }, [enrichedCharges]);

  const financeCommandState = useMemo(() => {
    const overdueCharges = enrichedCharges.filter(
      item => item.status === "OVERDUE"
    );
    const pendingCharges = enrichedCharges.filter(
      item => item.status === "PENDING"
    );
    const dueSoonCount = pendingCharges.filter(item => {
      const daysUntilDue = computeDaysUntilDue(item.dueDate);
      return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
    }).length;
    const largestOverdueDays = overdueCharges.reduce(
      (max, item) => Math.max(max, Number(item.overdueDays ?? 0)),
      0
    );
    const averageOverdueDays = overdueCharges.length
      ? Math.round(
          overdueCharges.reduce(
            (sum, item) => sum + Number(item.overdueDays ?? 0),
            0
          ) / overdueCharges.length
        )
      : 0;
    const hasMaterialOverdue =
      health.overdue >= 100000 || overdueCharges.length >= 2;
    const level: OperationalStateLevel =
      overdueCharges.length > 0 &&
      (hasMaterialOverdue || pendingCharges.length > 1)
        ? "RESTRICTED"
        : overdueCharges.length > 0 ||
            dueSoonCount > 0 ||
            pendingCharges.length > 0
          ? "WARNING"
          : "NORMAL";
    const reason = (() => {
      if (overdueCharges.length > 0) {
        return `${overdueCharges.length} cobrança(s) vencida(s) somando ${formatCurrency(health.overdue)}; maior atraso de ${largestOverdueDays} dia(s).`;
      }
      if (dueSoonCount > 0)
        return `${dueSoonCount} cobrança(s) pendente(s) vencem em até 3 dias.`;
      if (pendingCharges.length > 0)
        return `${pendingCharges.length} cobrança(s) pendente(s) ainda precisam virar pagamento.`;
      if (paidWithoutRegisteredPayment.length > 0)
        return `${paidWithoutRegisteredPayment.length} cobrança(s) paga(s) sem pagamento vinculado na lista carregada.`;
      return "Sem vencidas ou pendências relevantes nos dados financeiros carregados.";
    })();
    const impact = (() => {
      if (overdueCharges.length > 0)
        return "Dinheiro travado impacta caixa, priorização da Timeline e leitura de Risco/Governança.";
      if (pendingCharges.length > 0)
        return "A cobrança preventiva evita atraso e mantém o fluxo Cobrança → Pagamento com prova operacional.";
      return "Operação pode manter rotina preventiva e revisar carteira sem bloqueio financeiro imediato.";
    })();

    return {
      level,
      reason,
      impact,
      overdueCharges,
      pendingCharges,
      dueSoonCount,
      largestOverdueDays,
      averageOverdueDays,
    };
  }, [enrichedCharges, health.overdue, paidWithoutRegisteredPayment.length]);

  const financeRisk = useMemo(() => {
    const critical = mostCriticalCharge;
    if (!critical) {
      return {
        title: "Sem risco financeiro dominante",
        reason:
          "Não há cobrança vencida ou pendente crítica nos dados carregados.",
        impact:
          "Caixa sem bloqueio imediato; mantenha revisão preventiva da carteira e da Timeline.",
      };
    }

    if (critical.status === "OVERDUE") {
      return {
        title: `${formatCurrency(Number(critical.amountCents ?? 0))} travados em ${critical.customerName}`,
        reason: `${financeCommandState.overdueCharges.length} cobrança(s) vencida(s), ${formatCurrency(health.overdue)} em atraso, média de ${financeCommandState.averageOverdueDays} dia(s) e maior atraso de ${financeCommandState.largestOverdueDays} dia(s).`,
        impact: `Priorizar ${critical.customerName} reduz risco de caixa e alimenta Timeline/Risco/Governança com ação comprovável.`,
      };
    }

    return {
      title: `Pendência próxima: ${critical.customerName}`,
      reason: `${formatCurrency(Number(critical.amountCents ?? 0))} ainda pendente para ${formatDate(critical.dueDate)}; ${financeCommandState.dueSoonCount} vencimento(s) próximo(s).`,
      impact:
        "Enviar link/lembrar antes do vencimento reduz chance de dinheiro ficar travado.",
    };
  }, [financeCommandState, health.overdue, mostCriticalCharge]);

  const financeNextBestAction = useMemo(() => {
    const overdue = enrichedCharges.filter(item => item.status === "OVERDUE");
    const pendingDueSoon = enrichedCharges.filter(item => {
      if (item.status !== "PENDING") return false;
      const daysUntilDue = computeDaysUntilDue(item.dueDate);
      return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
    });

    const target =
      [...overdue].sort((a, b) => {
        const amountDiff =
          Number(b.amountCents ?? 0) - Number(a.amountCents ?? 0);
        if (amountDiff !== 0) return amountDiff;
        return Number(b.overdueDays ?? 0) - Number(a.overdueDays ?? 0);
      })[0] ??
      [...pendingDueSoon].sort((a, b) => {
        const aDue = safeDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = safeDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })[0] ??
      paidWithoutRegisteredPayment[0] ??
      null;

    if (target?.status === "OVERDUE") {
      return {
        target,
        title: "Cobrar cliente",
        entity: `${target.customerName} · ${formatCurrency(Number(target.amountCents ?? 0))}`,
        reason: `Cobrança vencida há ${target.overdueDays} dia(s), vinculada à O.S. ${target.serviceOrderLabel}.`,
        impact:
          "Destravar recebimento e registrar ação que sustenta caixa, Timeline e Governança.",
        safetyNote:
          "Orientação apenas: não envia mensagem nem registra pagamento automaticamente.",
        primaryActionLabel: "Cobrar no WhatsApp contextual",
        secondaryActionLabel: "Filtrar vencidas",
      };
    }

    if (target?.status === "PENDING") {
      return {
        target,
        title: "Enviar link de pagamento",
        entity: `${target.customerName} · vence ${formatDate(target.dueDate)}`,
        reason: `${formatCurrency(Number(target.amountCents ?? 0))} pendente antes de virar atraso.`,
        impact:
          "Aumenta previsibilidade de caixa e evita entrada no fluxo restrito.",
        safetyNote:
          "Use apenas os CTAs existentes; nenhum fluxo novo de WhatsApp foi criado.",
        primaryActionLabel: "Abrir WhatsApp contextual",
        secondaryActionLabel: "Filtrar pendentes",
      };
    }

    if (target) {
      return {
        target,
        title: "Revisar recebimento",
        entity: `${target.customerName} · cobrança paga`,
        reason: "Status pago sem pagamento vinculado na lista carregada.",
        impact:
          "Evita divergência entre cobrança, pagamento e prova operacional.",
        safetyNote:
          "Fallback seguro: confirmar detalhe antes de qualquer ajuste.",
        primaryActionLabel: "Conferir cobrança",
        secondaryActionLabel: "Ver pagas",
      };
    }

    if (completedOrdersWithoutCharge.length > 0) {
      const order = completedOrdersWithoutCharge[0];
      return {
        target: null,
        title: "Gerar cobrança",
        entity: `O.S. ${safeText(order?.number ?? order?.id, "concluída")}`,
        reason: `${completedOrdersWithoutCharge.length} O.S. concluída(s) ainda não viraram cobrança nos dados carregados.`,
        impact: "Transforma operação concluída em receita rastreável.",
        safetyNote: "Ação orientativa; use o fluxo existente de nova cobrança.",
        primaryActionLabel: "Criar cobrança",
        secondaryActionLabel: "Abrir O.S.",
      };
    }

    return {
      target: null,
      title: "Revisar carteira financeira",
      entity: `${enrichedCharges.length} cobrança(s) monitorada(s)`,
      reason: "Sem pendência crítica nos dados financeiros carregados.",
      impact:
        "Mantém governança preventiva sobre cobrança, pagamento e Timeline.",
      safetyNote:
        "Nenhuma execução automática; apenas direcionamento para revisão.",
      primaryActionLabel: "Ver carteira",
      secondaryActionLabel: undefined,
    };
  }, [
    completedOrdersWithoutCharge,
    enrichedCharges,
    paidWithoutRegisteredPayment,
  ]);

  const financeFlowStages = useMemo(
    () =>
      [
        {
          id: "customer",
          label: "Cliente",
          summary: "Clientes vinculados às cobranças carregadas.",
          countOrValue: String(
            new Set(
              enrichedCharges.map(item => item.customerId).filter(Boolean)
            ).size
          ),
          state: enrichedCharges.some(item => item.customerId)
            ? "done"
            : "idle",
          hrefLabel: "Abrir clientes",
          onClick: () => navigate("/customers"),
        },
        {
          id: "service-order",
          label: "O.S.",
          summary:
            completedOrdersWithoutCharge.length > 0
              ? "Há O.S. concluída sem cobrança."
              : "Origem operacional vinculada quando informada.",
          countOrValue: String(
            new Set(
              enrichedCharges.map(item => item.serviceOrderId).filter(Boolean)
            ).size
          ),
          state:
            completedOrdersWithoutCharge.length > 0
              ? "warning"
              : enrichedCharges.some(item => item.serviceOrderId)
                ? "done"
                : "idle",
          hrefLabel: "Abrir O.S.",
          onClick: () => navigate("/service-orders"),
        },
        {
          id: "charge",
          label: "Cobrança",
          summary: cashHealth.collectionBottleneck,
          countOrValue: `${enrichedCharges.length} cobrança(s)`,
          state:
            cashHealth.overdueCount > 0
              ? "blocked"
              : cashHealth.pendingCount > 0
                ? "warning"
                : "done",
          hrefLabel: "Ver carteira",
          onClick: () => setStatusFilter("all"),
        },
        {
          id: "payment",
          label: "Pagamento",
          summary:
            cashHealth.overdueCount > 0
              ? "Vencidas impedem conversão em caixa."
              : cashHealth.pendingCount > 0
                ? "Pendências aguardam recebimento."
                : "Pagamentos confirmados na carteira.",
          countOrValue: `${cashHealth.paidCount} pago(s)`,
          state:
            cashHealth.overdueCount > 0
              ? "blocked"
              : cashHealth.pendingCount > 0
                ? "warning"
                : "done",
        },
        {
          id: "timeline",
          label: "Timeline",
          summary:
            timelineItems.length > 0
              ? "Eventos oficiais encontrados para o contexto selecionado."
              : "Sem timeline retornada; abrir prova completa.",
          countOrValue:
            timelineItems.length > 0
              ? `${timelineItems.length} evento(s)`
              : "Fallback",
          state: timelineItems.length > 0 ? "done" : "idle",
          hrefLabel: "Abrir Timeline",
          onClick: () =>
            navigate(
              selectedCharge?.customerId
                ? `/timeline?customerId=${selectedCharge.customerId}`
                : "/timeline"
            ),
        },
        {
          id: "risk",
          label: "Risco/Governança",
          summary:
            cashHealth.overdueCount > 0
              ? "Atrasos elevam risco financeiro e governança."
              : "Risco financeiro monitorado sem bloqueio dominante.",
          countOrValue: financeCommandState.level,
          state:
            financeCommandState.level === "RESTRICTED"
              ? "blocked"
              : financeCommandState.level === "WARNING"
                ? "warning"
                : "done",
          hrefLabel: "Abrir governança",
          onClick: () => navigate("/governance?source=finances"),
        },
      ] as Array<{
        id: string;
        label: string;
        summary: string;
        state: OperationalFlowStageState;
        countOrValue?: string;
        hrefLabel?: string;
        onClick?: () => void;
      }>,
    [
      cashHealth,
      completedOrdersWithoutCharge.length,
      enrichedCharges,
      financeCommandState.level,
      navigate,
      selectedCharge?.customerId,
      timelineItems.length,
    ]
  );

  const financeTimelineEvents = useMemo(() => {
    if (timelineItems.length > 0) {
      return timelineItems.slice(0, 4).map(item => ({
        id: String(item?.id ?? `${item?.createdAt ?? ""}-${item?.title ?? ""}`),
        type: String(item?.type ?? item?.category ?? "Timeline"),
        occurredAt: formatDate(item?.createdAt),
        entity: String(item?.title ?? item?.description ?? "Evento financeiro"),
        actor: item?.actor?.name ?? item?.user?.name ?? undefined,
        summary: String(
          item?.description ??
            item?.summary ??
            "Evento oficial retornado pela Timeline."
        ),
      }));
    }

    const contextualEvents: Array<{
      id: string;
      type: string;
      occurredAt: string;
      entity: string;
      summary: string;
    }> = [];
    if (selectedFinancialRecord?.id) {
      contextualEvents.push({
        id: `charge-${selectedFinancialRecord.id}`,
        type: "Cobrança contextual",
        occurredAt: formatDate(
          selectedFinancialRecord.createdAt ?? selectedFinancialRecord.dueDate
        ),
        entity: `${safeText(selectedFinancialRecord.customerName, "Cliente")} · ${formatCurrency(Number(selectedFinancialRecord.amountCents ?? 0))}`,
        summary: `Cobrança ${chargeStatusLabel(selectedFinancialRecord.status)} derivada dos dados financeiros carregados; não substitui a Timeline oficial.`,
      });
    }
    const payments = Array.isArray(selectedFinancialRecord?.payments)
      ? selectedFinancialRecord.payments
      : [];
    for (const payment of payments.slice(0, 3)) {
      contextualEvents.push({
        id: `payment-${payment?.id ?? payment?.paidAt ?? contextualEvents.length}`,
        type: "Pagamento contextual",
        occurredAt: formatDate(payment?.paidAt ?? payment?.createdAt),
        entity: `${safeText(selectedFinancialRecord.customerName, "Cliente")} · ${formatCurrency(Number(payment?.amountCents ?? 0))}`,
        summary: `Pagamento retornado no detalhe da cobrança com método ${safeText(payment?.method)}.`,
      });
    }
    return contextualEvents.slice(0, 4);
  }, [selectedFinancialRecord, timelineItems]);

  const filterTabs = useMemo(
    () => [
      {
        key: "all" as const,
        label: `Todas (${scopedCharges.length})`,
      },
      {
        key: "pending" as const,
        label: `Pendentes (${
          scopedCharges.filter(item => item.status === "PENDING").length
        })`,
      },
      {
        key: "overdue" as const,
        label: `Vencidas (${
          scopedCharges.filter(item => item.status === "OVERDUE").length
        })`,
      },
      {
        key: "paid" as const,
        label: `Pagas (${
          scopedCharges.filter(item => item.status === "PAID").length
        })`,
      },
      {
        key: "canceled" as const,
        label: `Canceladas (${
          scopedCharges.filter(item => item.status === "CANCELED").length
        })`,
      },
    ],
    [scopedCharges]
  );

  const immediateAttentionItems = useMemo(() => {
    const overdueCharges = enrichedCharges.filter(
      item => item.status === "OVERDUE"
    );
    const pendingWithoutWhatsApp = enrichedCharges.filter(item => {
      if (!["PENDING", "OVERDUE"].includes(item.status)) return false;
      return getCommunicationState(item) === "not_sent";
    });
    const communicationUnknownCount = enrichedCharges.filter(item => {
      if (!["PENDING", "OVERDUE"].includes(item.status)) return false;
      return getCommunicationState(item) === "unknown";
    }).length;

    return [
      {
        key: "overdue",
        title: "Cobrança vencida",
        value: String(highlightedFinancialAttention.length),
        consequence:
          overdueCharges.length > 0
            ? "Priorize cobrança por WhatsApp ou registre pagamento."
            : "Sem atraso financeiro no momento.",
        actionLabel:
          overdueCharges.length > 0 ? "Priorizar atraso" : "Ver carteira",
        onAction: () =>
          setStatusFilter(overdueCharges.length > 0 ? "overdue" : "all"),
      },
      {
        key: "whatsapp",
        title: "Cobrança sem WhatsApp enviado",
        value:
          pendingWithoutWhatsApp.length > 0
            ? String(pendingWithoutWhatsApp.length)
            : "fallback",
        consequence:
          pendingWithoutWhatsApp.length > 0
            ? "Há pendência sem comunicação registrada nos campos retornados."
            : communicationUnknownCount > 0
              ? "Backend não retornou telemetria de envio; use WhatsApp contextual para cobrar."
              : "Nenhuma pendência sem envio registrada.",
        actionLabel: "Abrir pendências",
        onAction: () => setStatusFilter("pending"),
      },
      {
        key: "os-without-charge",
        title: "O.S. concluída sem cobrança",
        value: String(completedOrdersWithoutCharge.length),
        consequence:
          completedOrdersWithoutCharge.length > 0
            ? "Receita operacional ainda não virou cobrança."
            : "Nenhuma O.S. concluída sem cobrança encontrada nos dados carregados.",
        actionLabel:
          completedOrdersWithoutCharge.length > 0
            ? "Ver O.S."
            : "Ver cobranças",
        onAction: () => {
          if (completedOrdersWithoutCharge.length > 0)
            navigate("/service-orders");
          else setStatusFilter("all");
        },
      },
      {
        key: "payment-register",
        title: "Pagamento não registrado",
        value:
          paidWithoutRegisteredPayment.length > 0
            ? String(paidWithoutRegisteredPayment.length)
            : "fallback",
        consequence:
          paidWithoutRegisteredPayment.length > 0
            ? "Cobrança paga sem lista de pagamentos vinculada no detalhe."
            : "Endpoint de lista geral de pagamentos não está exposto; detalhe busca pagamentos apenas por cobrança.",
        actionLabel: "Conferir detalhe",
        onAction: () =>
          selectedChargeId
            ? undefined
            : setSelectedChargeId(String(enrichedCharges[0]?.id ?? "")),
      },
      {
        key: "communication-failure",
        title: "Falha de cobrança/comunicação",
        value: "fallback",
        consequence:
          "A página não recebeu campo de falha de envio; sem inventar incidentes.",
        actionLabel: "Usar WhatsApp contextual",
        onAction: () =>
          selectedCharge
            ? goToWhatsApp(selectedCharge)
            : setStatusFilter("overdue"),
      },
    ];
  }, [
    completedOrdersWithoutCharge,
    enrichedCharges,
    navigate,
    selectedCharge,
    selectedChargeId,
  ]);

  async function refreshAll() {
    await Promise.all([
      chargesQuery.refetch(),
      customersQuery.refetch(),
      serviceOrdersQuery.refetch(),
      selectedChargeDetailsQuery.refetch(),
      timelineByCustomerQuery.refetch(),
      timelineByServiceOrderQuery.refetch(),
    ]);
  }

  async function openMarkAsPaid(charge: ChargeRecord) {
    setPayMethod("PIX");
    setPayAmount(
      String((Number(charge?.amountCents ?? 0) / 100).toFixed(2)).replace(
        ".",
        ","
      )
    );
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes("");
    setOpenPayModalFor(charge);
  }

  async function submitMarkAsPaid() {
    if (!openPayModalFor?.id) return;
    const normalized = payAmount.replace(/\./g, "").replace(",", ".");
    const amountNumber = Number(normalized);
    const amountCents = Number.isFinite(amountNumber)
      ? Math.round(amountNumber * 100)
      : 0;
    if (amountCents <= 0) {
      toast.error("Valor inválido para registrar pagamento.");
      return;
    }

    try {
      await markPaidMutation.mutateAsync({
        chargeId: String(openPayModalFor.id),
        amountCents,
        method: payMethod,
        paidAt: payDate
          ? new Date(`${payDate}T12:00:00`).toISOString()
          : new Date().toISOString(),
        notes: payNotes.trim() || undefined,
      });
      toast.success("Pagamento registrado com sucesso.");
      setOpenPayModalFor(null);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao registrar pagamento.");
    }
  }

  function openEditCharge(charge: ChargeRecord) {
    setEditAmount(
      String((Number(charge?.amountCents ?? 0) / 100).toFixed(2)).replace(
        ".",
        ","
      )
    );
    const due = safeDate(charge?.dueDate);
    setEditDueDate(due ? due.toISOString().slice(0, 10) : "");
    setEditNotes(String(charge?.notes ?? ""));
    setOpenEditModalFor(charge);
  }

  async function submitEditCharge() {
    if (!openEditModalFor?.id) return;
    const normalized = editAmount.replace(/\./g, "").replace(",", ".");
    const amountNumber = Number(normalized);
    const amountCents = Number.isFinite(amountNumber)
      ? Math.round(amountNumber * 100)
      : 0;

    if (amountCents <= 0 || !editDueDate) {
      toast.error("Preencha valor e vencimento para editar a cobrança.");
      return;
    }

    try {
      await editMutation.mutateAsync({
        id: String(openEditModalFor.id),
        amountCents,
        dueDate: new Date(`${editDueDate}T12:00:00`),
        notes: editNotes.trim() || undefined,
      });
      toast.success("Cobrança atualizada com sucesso.");
      setOpenEditModalFor(null);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao editar cobrança.");
    }
  }

  async function handleCancelCharge(charge: ChargeRecord) {
    if (!charge?.id) return;
    try {
      await cancelMutation.mutateAsync({ id: String(charge.id) });
      toast.success("Cobrança cancelada com sucesso.");
      if (selectedChargeId === String(charge.id)) setSelectedChargeId(null);
      await refreshAll();
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao cancelar cobrança.");
    }
  }

  function goToCustomer(charge: ChargeRecord) {
    if (!charge?.customerId) {
      toast.error("Cliente inválido para abrir WhatsApp.");
      return;
    }
    navigate(`/customers?customerId=${charge.customerId}`);
  }

  function goToServiceOrder(charge: ChargeRecord) {
    if (!charge?.serviceOrderId) {
      toast.error("Cliente inválido para abrir WhatsApp.");
      return;
    }
    navigate(
      `/service-orders?customerId=${charge.customerId ?? ""}&serviceOrderId=${charge.serviceOrderId}`
    );
  }

  function goToWhatsApp(charge: ChargeRecord) {
    if (!charge?.customerId) {
      toast.error("Cliente inválido para abrir WhatsApp.");
      return;
    }
    if (String(charge.status ?? "").toUpperCase() === "PAID") {
      toast.info(
        "Cobrança já paga. Use WhatsApp apenas para comunicação pós-pagamento."
      );
      navigate(`/whatsapp?customerId=${charge.customerId}`);
      return;
    }
    navigate(
      `/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id ?? ""}`
    );
  }

  return (
    <AppPageShell className="gap-3">
      <AppOperationalHeader
        title="Financeiro"
        description={`Centro operacional de cobrança e receita · ${enrichedCharges.length} cobrança(s), ${cashHealth.overdueCount} vencida(s) e ${completedOrdersWithoutCharge.length} O.S. concluída(s) sem cobrança.`}
        secondaryActions={
          <Button variant="ghost" size="sm" onClick={() => void refreshAll()}>
            Atualizar
          </Button>
        }
        primaryAction={
          <Button onClick={() => setOpenCreate(true)}>Novo recebimento</Button>
        }
        contextChips={
          <>
            <AppOperationalStatusBadge
              status={financeOperationalStatus}
              label={`Saúde ${financeOperationalStatus.toLowerCase()}`}
            />
            <AppStatusBadge
              label={`Carteira: ${enrichedCharges.length}`}
              tone="info"
            />
            <AppStatusBadge
              label={`Atrasos: ${cashHealth.overdueCount}`}
              tone={cashHealth.overdueCount > 0 ? "danger" : "success"}
            />
            <AppStatusBadge
              label={`Pendências: ${cashHealth.pendingCount}`}
              tone={cashHealth.pendingCount > 0 ? "warning" : "neutral"}
            />
            {hasFiltersContext ? (
              <AppStatusBadge label="Contexto via operação" tone="accent" />
            ) : null}
          </>
        }
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Ação real primeiro: cobrar, enviar link ou registrar pagamento antes
          de navegar para cliente/O.S.
        </p>
      </AppOperationalHeader>

      <div className="grid gap-3 xl:grid-cols-2">
        <OperationalStateCard
          title="Estado financeiro operacional"
          level={financeCommandState.level}
          reason={financeCommandState.reason}
          impact={financeCommandState.impact}
          detailsLabel={
            cashHealth.overdueCount > 0 ? "Ver vencidas" : "Ver carteira"
          }
          onDetails={() =>
            setStatusFilter(cashHealth.overdueCount > 0 ? "overdue" : "all")
          }
        />
        <OperationalRiskCard
          title={financeRisk.title}
          reason={financeRisk.reason}
          impact={financeRisk.impact}
          ctaLabel={
            cashHealth.overdueCount > 0
              ? "Priorizar atrasos"
              : "Revisar carteira"
          }
          onClick={() =>
            setStatusFilter(cashHealth.overdueCount > 0 ? "overdue" : "all")
          }
        />
      </div>

      <AppSectionCard className="space-y-0 border-0 bg-transparent p-0">
        <span className="sr-only">Próxima melhor ação financeira</span>
        <NextBestActionCard
          title={financeNextBestAction.title}
          entity={financeNextBestAction.entity}
          reason={financeNextBestAction.reason}
          impact={financeNextBestAction.impact}
          safetyNote={financeNextBestAction.safetyNote}
          primaryActionLabel={financeNextBestAction.primaryActionLabel}
          onPrimaryAction={() => {
            const target = financeNextBestAction.target;
            if (target) {
              setSelectedChargeId(String(target.id ?? ""));
              if (target.status === "OVERDUE" || target.status === "PENDING") {
                goToWhatsApp(target);
                return;
              }
              setStatusFilter("paid");
              return;
            }
            if (financeNextBestAction.title === "Gerar cobrança") {
              setOpenCreate(true);
              return;
            }
            setStatusFilter("all");
          }}
          secondaryActionLabel={financeNextBestAction.secondaryActionLabel}
          onSecondaryAction={
            financeNextBestAction.secondaryActionLabel
              ? () => {
                  if (financeNextBestAction.title === "Cobrar cliente")
                    setStatusFilter("overdue");
                  else if (
                    financeNextBestAction.title === "Enviar link de pagamento"
                  )
                    setStatusFilter("pending");
                  else if (
                    financeNextBestAction.title === "Revisar recebimento"
                  )
                    setStatusFilter("paid");
                  else if (financeNextBestAction.title === "Gerar cobrança")
                    navigate("/service-orders");
                  else setStatusFilter("all");
                }
              : undefined
          }
        />
      </AppSectionCard>

      <OperationalFlowCard
        title="Fluxo financeiro operacional"
        subtitle="Cliente → O.S. → Cobrança → Pagamento → Timeline → Risco/Governança"
        stages={financeFlowStages}
      />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <AppStatCard
          label="Recebido"
          value={formatCurrency(health.received)}
          helper={`Consequência: ${cashHealth.paidCount} cobrança(s) confirmada(s) no caixa.`}
        />
        <AppStatCard
          label="A receber"
          value={formatCurrency(health.receivable)}
          helper={`Consequência: ${cashHealth.pendingCount} cobrança(s) ainda pedem acompanhamento.`}
        />
        <AppStatCard
          label="Vencido"
          value={formatCurrency(health.overdue)}
          helper={
            cashHealth.overdueCount > 0
              ? "Consequência: cobrar antes de navegar."
              : "Consequência: manter rotina preventiva."
          }
        />
        <AppStatCard
          label="Previsto"
          value={formatCurrency(health.projected)}
          helper="Consequência: visão dos próximos 30 dias com dados de vencimento."
        />
      </div>

      <AppSectionBlock
        title="Saúde do caixa"
        subtitle="Leitura operacional do dinheiro e do gargalo cobrança → pagamento."
        compact
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AppInfoCard>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Dinheiro recebido
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(health.received)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Já entrou no caixa conforme cobranças pagas.
            </p>
          </AppInfoCard>
          <AppInfoCard>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Dinheiro pendente
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(cashHealth.pendingAmount)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Precisa de acompanhamento antes do vencimento.
            </p>
          </AppInfoCard>
          <AppInfoCard>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Dinheiro em risco
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(cashHealth.riskAmount)}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Toda cobrança vencida sugere cobrança imediata.
            </p>
          </AppInfoCard>
          <AppInfoCard>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Saúde financeira
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
              {operationalHealth.label}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {operationalHealth.bottleneck.label}:{" "}
              {operationalHealth.bottleneck.reason}
            </p>
          </AppInfoCard>
        </div>
      </AppSectionBlock>

      <AppSectionBlock
        title="Intervenção financeira dominante"
        subtitle="Recomendação contextual para destravar cobrança → pagamento."
        compact
        className="hidden"
      >
        {financeIntervention ? (
          <AppInfoCard>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {financeIntervention.label}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {financeIntervention.summary}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Owner sugerido: {financeIntervention.recommendedOwner}
            </p>
          </AppInfoCard>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            Sem intervenção financeira dominante no momento.
          </p>
        )}
      </AppSectionBlock>

      <AppSectionBlock
        title={operationalCopy.immediateAttention}
        subtitle={`Pendências que afetam cobrança, comunicação e registro de pagamento. ${highlightedFinancialSummary.hidden > 0 ? highlightedFinancialSummary.hiddenMessage : ""}`}
        compact
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {immediateAttentionItems.slice(0, 5).map(item => (
            <AppInfoCard key={item.key}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {item.title}
                </p>
                <AppStatusBadge label={item.value} tone="neutral" />
              </div>
              <p className="mt-2 min-h-12 text-xs leading-5 text-[var(--text-secondary)]">
                {item.consequence}
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={item.onAction}
              >
                {item.actionLabel}
              </Button>
            </AppInfoCard>
          ))}
        </div>
      </AppSectionBlock>

      <AppSectionBlock
        title="Carteira operacional"
        subtitle="Cobranças reais com risco, origem e ação primária antes da navegação."
      >
        <AppFiltersBar className="shrink-0 gap-2 border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2">
          <div className="min-w-[220px] flex-1">
            <input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, O.S., status ou ID"
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map(filter => (
              <button
                key={filter.key}
                type="button"
                className={cn(
                  "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                  statusFilter === filter.key
                    ? "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                )}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)]">
              Mais filtros
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-[190px] gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFilter("overdue")}
              >
                Priorizar atraso
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatusFilter("pending")}
              >
                Cobrar pendências
              </Button>
            </div>
          </details>
          <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
            {filteredCharges.length} / {scopedCharges.length} cobrança(s)
          </span>
        </AppFiltersBar>

        {hasFiltersContext ? (
          <p className="text-xs text-[var(--text-muted)]">
            Contexto ativo via URL:{" "}
            {queryParams.customerId
              ? `customerId=${queryParams.customerId} `
              : ""}
            {queryParams.serviceOrderId
              ? `serviceOrderId=${queryParams.serviceOrderId}`
              : ""}
          </p>
        ) : null}

        {allQueriesLoading && enrichedCharges.length === 0 ? (
          <AppPageLoadingState description="Carregando cobranças, clientes e O.S...." />
        ) : null}

        {allQueriesErrored ? (
          <AppPageErrorState
            description={
              chargesQuery.error?.message ??
              "Falha ao carregar dados financeiros."
            }
            actionLabel="Tentar novamente"
            onAction={() => void refreshAll()}
          />
        ) : null}

        {!allQueriesLoading &&
        !allQueriesErrored &&
        filteredCharges.length === 0 ? (
          hasSearchNoResults ? (
            <AppPageEmptyState
              title="Busca sem resultado"
              description="Nenhuma cobrança encontrada para os termos pesquisados."
            />
          ) : (
            <AppPageEmptyState
              title="Nenhuma cobrança disponível"
              description="Não há cobranças para o contexto atual."
            />
          )
        ) : null}

        {!allQueriesLoading &&
        !allQueriesErrored &&
        filteredCharges.length > 0 ? (
          <>
            <AppDataTable className="min-w-[760px]">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-2.5 text-left">Cliente</th>
                  <th className="text-left">Valor / status</th>
                  <th className="text-left">Vencimento / atraso</th>
                  <th className="text-left">Prioridade</th>
                  <th className="p-2.5 text-left">Ação</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCharges.map(row => {
                  const primaryAction = getChargePrimaryAction(row);
                  return (
                    <tr
                      key={String(row?.id ?? "")}
                      className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--surface-subtle)]/60"
                      onClick={() => setSelectedChargeId(String(row?.id ?? ""))}
                    >
                      <td className="p-2.5">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">
                            {row.customerName}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {safeText(
                              row?.customer?.phone,
                              "Telefone não retornado"
                            )}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-2">
                          <p className="font-medium text-[var(--text-primary)]">
                            {formatCurrency(Number(row?.amountCents ?? 0))}
                          </p>
                          <AppStatusBadge
                            label={chargeStatusLabel(row.status)}
                            tone={getChargeStatusTone(row.status)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                          <p className="font-medium text-[var(--text-primary)]">
                            {formatDate(row?.dueDate)}
                          </p>
                          <p>
                            {row.status === "OVERDUE"
                              ? `${row.overdueDays} dia(s)`
                              : "Sem atraso"}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          <AppPriorityBadge priority={getChargePriority(row)} />
                          <p className="max-w-[180px] truncate text-xs text-[var(--text-muted)]">
                            {safeText(row.serviceOrderLabel, "Sem O.S.")}
                          </p>
                        </div>
                      </td>
                      <td
                        className="p-2.5"
                        onClick={event => event.stopPropagation()}
                      >
                        <div className="flex min-w-[160px] items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant={
                              primaryAction.kind === "collect"
                                ? "default"
                                : "outline"
                            }
                            onClick={() => {
                              setSelectedChargeId(String(row?.id ?? ""));
                              if (primaryAction.kind === "collect")
                                goToWhatsApp(row);
                            }}
                            disabled={row.status === "CANCELED"}
                          >
                            {primaryAction.label}
                          </Button>
                          <AppRowActionsDropdown
                            items={[
                              {
                                label: "Ver histórico",
                                onSelect: () =>
                                  setSelectedChargeId(String(row?.id ?? "")),
                              },
                              {
                                label: "Marcar como pago",
                                onSelect: () => void openMarkAsPaid(row),
                                disabled:
                                  row.status === "PAID" ||
                                  row.status === "CANCELED",
                                tone: "primary",
                              },
                              {
                                label:
                                  normalizeStatus(row?.status) === "PAID"
                                    ? "WhatsApp pós-pagamento"
                                    : "Cobrar via WhatsApp",
                                onSelect: () => goToWhatsApp(row),
                                disabled: !row.customerId,
                                tone: "primary",
                              },
                              {
                                label: "Enviar link",
                                onSelect: () => goToWhatsApp(row),
                                disabled:
                                  !row.customerId ||
                                  row.status === "PAID" ||
                                  row.status === "CANCELED",
                              },
                              {
                                label: "Editar cobrança",
                                onSelect: () => openEditCharge(row),
                                disabled:
                                  row.status === "PAID" ||
                                  row.status === "CANCELED",
                              },
                              {
                                label: "Cancelar cobrança",
                                onSelect: () => void handleCancelCharge(row),
                                disabled:
                                  row.status === "PAID" ||
                                  row.status === "CANCELED",
                              },
                              { type: "separator", label: "Navegação" },
                              {
                                label: "Abrir cliente",
                                onSelect: () => goToCustomer(row),
                                disabled: !row.customerId,
                              },
                              {
                                label: "Abrir O.S.",
                                onSelect: () => goToServiceOrder(row),
                                disabled: !row.serviceOrderId,
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
            <AppPagination
              currentPage={currentPage}
              totalItems={filteredCharges.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </AppSectionBlock>

      <AppSectionBlock
        title="Painel financeiro secundário"
        subtitle="Resumo compacto com origem, risco e histórico quando uma cobrança está selecionada."
        compact
      >
        {selectedCharge ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AppInfoCard>
                <p className="text-xs text-[var(--text-muted)]">
                  Cliente vinculado
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {selectedFinancialRecord.customerName}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {safeText(
                    selectedFinancialRecord?.customer?.phone,
                    "Telefone não retornado"
                  )}
                </p>
              </AppInfoCard>
              <AppInfoCard>
                <p className="text-xs text-[var(--text-muted)]">
                  Valor da cobrança
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatCurrency(
                    Number(selectedFinancialRecord?.amountCents ?? 0)
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Método recebido:{" "}
                  {latestPaymentMethod(selectedFinancialRecord)}
                </p>
              </AppInfoCard>
              <AppInfoCard>
                <p className="text-xs text-[var(--text-muted)]">
                  Status / vencimento
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {chargeStatusLabel(selectedFinancialRecord.status)} ·{" "}
                  {formatDate(selectedFinancialRecord?.dueDate)}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {getChargeRisk(selectedFinancialRecord)}
                </p>
              </AppInfoCard>
              <AppInfoCard>
                <p className="text-xs text-[var(--text-muted)]">
                  Origem operacional
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {safeText(
                    selectedFinancialRecord.serviceOrderLabel,
                    "Sem O.S. vinculada"
                  )}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  ID: {safeText(selectedFinancialRecord?.id)}
                </p>
              </AppInfoCard>
            </div>

            <AppActionBar className="gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-2">
              <Button
                onClick={() => goToWhatsApp(selectedFinancialRecord)}
                disabled={selectedFinancialRecord.status === "CANCELED"}
              >
                {selectedFinancialRecord.status === "OVERDUE"
                  ? "Cobrar agora"
                  : "Enviar link"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void openMarkAsPaid(selectedFinancialRecord)}
                disabled={
                  selectedFinancialRecord.status === "PAID" ||
                  selectedFinancialRecord.status === "CANCELED" ||
                  markPaidMutation.isPending
                }
              >
                {markPaidMutation.isPending
                  ? "Salvando..."
                  : "Marcar como pago"}
              </Button>
              <Button
                variant="outline"
                onClick={() => openEditCharge(selectedFinancialRecord)}
                disabled={
                  selectedFinancialRecord.status === "PAID" ||
                  selectedFinancialRecord.status === "CANCELED" ||
                  editMutation.isPending
                }
              >
                {editMutation.isPending ? "Salvando..." : "Editar cobrança"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleCancelCharge(selectedFinancialRecord)}
                disabled={
                  selectedFinancialRecord.status === "PAID" ||
                  selectedFinancialRecord.status === "CANCELED" ||
                  cancelMutation.isPending
                }
              >
                {cancelMutation.isPending ? "Salvando..." : "Cancelar"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => goToCustomer(selectedFinancialRecord)}
              >
                Abrir cliente
              </Button>
              <Button
                variant="ghost"
                onClick={() => goToServiceOrder(selectedFinancialRecord)}
              >
                Abrir O.S.
              </Button>
            </AppActionBar>

            <div className="grid gap-3 lg:grid-cols-3">
              <EntityTimelineCard
                className="lg:col-span-2"
                title="Prova operacional financeira"
                subtitle={
                  timelineByCustomerQuery.isLoading ||
                  timelineByServiceOrderQuery.isLoading
                    ? "Carregando Timeline oficial para cliente/O.S. selecionados."
                    : timelineItems.length > 0
                      ? "Últimos eventos oficiais retornados pela Timeline para sustentar cobrança, pagamento e risco."
                      : "Fallback contextual: eventos abaixo vêm de cobranças/pagamentos carregados e não substituem a Timeline oficial."
                }
                events={financeTimelineEvents}
                fullTimelineLabel="Abrir Timeline completa"
                onFullTimeline={() =>
                  navigate(
                    selectedFinancialRecord?.customerId
                      ? `/timeline?customerId=${selectedFinancialRecord.customerId}`
                      : "/timeline"
                  )
                }
              />
              <AppInfoCard>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Comunicação / WhatsApp
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {getCommunicationState(selectedFinancialRecord) === "sent"
                    ? "Envio de cobrança identificado nos campos retornados."
                    : getCommunicationState(selectedFinancialRecord) ===
                        "not_sent"
                      ? "Sem envio registrado nos campos retornados."
                      : "Backend não retornou telemetria de envio; ação disponível via WhatsApp contextual."}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {paymentsListAvailable
                    ? "Listagem de pagamentos/mensagens conectada."
                    : "Fallback: endpoint de lista geral de pagamentos/mensagens não exposto no BFF."}
                </p>
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  onClick={() => goToWhatsApp(selectedFinancialRecord)}
                >
                  Ir para WhatsApp com contexto
                </Button>
              </AppInfoCard>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Selecione uma cobrança para abrir o painel detalhado.
          </p>
        )}
      </AppSectionBlock>

      <CreateChargeModal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          toast.success("Cobrança criada com sucesso.");
          void refreshAll();
        }}
      />

      <FormModal
        open={Boolean(openPayModalFor)}
        onOpenChange={open => {
          if (!open) setOpenPayModalFor(null);
        }}
        title="Marcar como pago"
        description="Registrar recebimento real da cobrança."
        size="md"
        closeBlocked={markPaidMutation.isPending}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Resumo:{" "}
              {openPayModalFor
                ? formatCurrency(Number(openPayModalFor?.amountCents ?? 0))
                : "—"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenPayModalFor(null)}
                disabled={markPaidMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void submitMarkAsPaid()}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending
                  ? "Salvando..."
                  : "Confirmar pagamento"}
              </Button>
            </div>
          </div>
        }
      >
        <AppFormSection
          title="Recebimento"
          subtitle="Campos preservam o payload atual de pagamento."
        >
          <AppFieldGroup>
            <AppField label="Valor">
              <AppInput
                value={payAmount}
                onChange={event => setPayAmount(event.target.value)}
              />
            </AppField>
            <AppField label="Método">
              <AppSelect
                value={payMethod}
                onValueChange={value => setPayMethod(value as PaymentMethod)}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </AppField>
            <AppField
              label="Data de pagamento"
              hint="A data selecionada será registrada no pagamento."
            >
              <AppInput
                value={payDate}
                onChange={event => setPayDate(event.target.value)}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
              />
            </AppField>
            <AppField
              label="Observação"
              hint="A observação será salva no histórico do pagamento."
            >
              <AppTextarea
                className="min-h-[80px]"
                value={payNotes}
                onChange={event => setPayNotes(event.target.value)}
                placeholder="Observação operacional"
              />
            </AppField>
          </AppFieldGroup>
        </AppFormSection>
      </FormModal>

      <FormModal
        open={Boolean(openEditModalFor)}
        onOpenChange={open => {
          if (!open) setOpenEditModalFor(null);
        }}
        title="Editar cobrança"
        description="Atualize valor, vencimento e observações com persistência no backend."
        size="md"
        closeBlocked={editMutation.isPending}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Resumo atualizado no backend em tempo real.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenEditModalFor(null)}
                disabled={editMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void submitEditCharge()}
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? "Salvando..." : "Salvar edição"}
              </Button>
            </div>
          </div>
        }
      >
        <AppFormSection
          title="Dados da cobrança"
          subtitle="Edição curta preservando valor, vencimento e observações atuais."
        >
          <AppFieldGroup>
            <AppField label="Valor">
              <AppInput
                value={editAmount}
                onChange={event => setEditAmount(event.target.value)}
              />
            </AppField>
            <AppField label="Vencimento">
              <AppInput
                value={editDueDate}
                onChange={event => setEditDueDate(event.target.value)}
                type="date"
              />
            </AppField>
            <div className="sm:col-span-2">
              <AppField label="Observações">
                <AppTextarea
                  className="min-h-[110px]"
                  value={editNotes}
                  onChange={event => setEditNotes(event.target.value)}
                />
              </AppField>
            </div>
          </AppFieldGroup>
        </AppFormSection>
      </FormModal>
    </AppPageShell>
  );
}
