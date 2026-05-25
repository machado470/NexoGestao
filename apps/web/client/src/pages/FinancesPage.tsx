import { useEffect, useMemo, useState } from "react";
import { operationalCopy } from "@/lib/operational-semantics";
import { compareOperationalPriority } from "@/lib/operational-prioritization";
import {
  getAttentionSummary,
  getVisibleAttentionItems,
  type OperationalAttentionItem,
} from "@/lib/operational-attention";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { QuickActionModal } from "@/components/app-modal-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppOperationalBar,
  AppPageLoadingState,
  AppPagination,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import {
  AppInfoCard,
  AppPageShell,
  AppRowActionsDropdown,
  AppStatCard,
} from "@/components/app-system";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { safeDate } from "@/lib/operational/kpi";
import { trpc } from "@/lib/trpc";
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
        { severity: a.status === "OVERDUE" ? "WARNING" : a.status === "PENDING" ? "ATTENTION" : "NORMAL", dueDate: a.dueDate, amountCents: Number(a.amountCents ?? 0) },
        { severity: b.status === "OVERDUE" ? "WARNING" : b.status === "PENDING" ? "ATTENTION" : "NORMAL", dueDate: b.dueDate, amountCents: Number(b.amountCents ?? 0) }
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

  const nextBestAction = useMemo(() => {
    const pendingOrOverdue = getVisibleAttentionItems(
      [...enrichedCharges]
      .filter(item => ["PENDING", "OVERDUE"].includes(item.status))
      .map(
        item =>
          ({
            ...item,
            key: String(item.id ?? ""),
            domain: "finances",
            type: item.status === "OVERDUE" ? "overdue_charge" : "pending_charge",
            severity: item.status === "OVERDUE" ? "WARNING" : "ATTENTION",
            amountCents: Number(item.amountCents ?? 0),
          }) as OperationalAttentionItem
      ),
      1
    );
    return (pendingOrOverdue[0] as ChargeRecord | null) ?? null;
  }, [enrichedCharges]);

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

  const immediateAttentionItems = useMemo(() => {
    const overdueCharges = enrichedCharges.filter(
      item => item.status === "OVERDUE"
    );
    const pendingWithoutWhatsApp = enrichedCharges.filter(item => {
      if (!["PENDING", "OVERDUE"].includes(item.status)) return false;
      return getCommunicationState(item) === "not_sent";
    });
    const paidWithoutRegisteredPayment = enrichedCharges.filter(
      item => !hasRegisteredPayment(item)
    );
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
    <PageWrapper
      title="Financeiro"
      subtitle="cobrança, recebimento e risco financeiro operacional"
    >
      <AppPageShell className="space-y-4">
        <AppOperationalHeader
          title="Financeiro"
          description={`Centro operacional de cobrança e receita · ${enrichedCharges.length} cobrança(s), ${cashHealth.overdueCount} vencida(s) e ${completedOrdersWithoutCharge.length} O.S. concluída(s) sem cobrança.`}
          secondaryActions={
            <Button variant="ghost" size="sm" onClick={() => void refreshAll()}>
              Atualizar
            </Button>
          }
          primaryAction={
            <Button onClick={() => setOpenCreate(true)}>Nova cobrança</Button>
          }
          contextChips={
            <>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                Carteira: {enrichedCharges.length}
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                Atrasos: {cashHealth.overdueCount}
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                Pendências: {cashHealth.pendingCount}
              </span>
              {hasFiltersContext ? (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  Contexto via operação
                </span>
              ) : null}
            </>
          }
        >
          <p className="text-sm text-[var(--text-secondary)]">
            Ação real primeiro: cobrar, enviar link ou registrar pagamento antes
            de navegar para cliente/O.S.
          </p>
        </AppOperationalHeader>

        <OperationalTopCard
          contextLabel="Próxima decisão financeira"
          title={
            nextBestAction
              ? `Cobrar ${nextBestAction.customerName}`
              : "Caixa sem cobrança crítica agora"
          }
          description={
            nextBestAction
              ? `${formatCurrency(Number(nextBestAction?.amountCents ?? 0))} · ${nextBestAction.status === "OVERDUE" ? `${nextBestAction.overdueDays} dia(s) em atraso` : "pendência ativa"} · Origem/O.S.: ${nextBestAction.serviceOrderLabel}`
              : "Nenhuma cobrança pendente ou vencida foi retornada pelo backend para ação imediata."
          }
          chips={
            nextBestAction ? (
              <>
                <AppStatusBadge
                  label={chargeStatusLabel(nextBestAction.status)}
                />
                <span className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                  {getChargeRisk(nextBestAction)}
                </span>
              </>
            ) : null
          }
          primaryAction={
            nextBestAction ? (
              <Button
                onClick={() => {
                  setSelectedChargeId(String(nextBestAction?.id ?? ""));
                  goToWhatsApp(nextBestAction);
                }}
              >
                Cobrar agora
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStatusFilter("all")}>
                Ver carteira
              </Button>
            )
          }
          secondaryActions={
            nextBestAction ? (
              <Button
                variant="outline"
                onClick={() => void openMarkAsPaid(nextBestAction)}
              >
                Marcar como pago
              </Button>
            ) : null
          }
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
                Gargalo principal
              </p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {cashHealth.collectionBottleneck}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Use a ação principal da linha antes de abrir detalhes.
              </p>
            </AppInfoCard>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title={operationalCopy.immediateAttention}
          subtitle={`Pendências que afetam cobrança, comunicação e registro de pagamento. ${highlightedFinancialSummary.hidden > 0 ? highlightedFinancialSummary.hiddenMessage : ""}`}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {immediateAttentionItems.map(item => (
              <article
                key={item.key}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </p>
                  <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                    {item.value}
                  </span>
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
              </article>
            ))}
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Carteira operacional"
          subtitle="Cobranças reais com risco, origem e ação primária antes da navegação."
        >
          <AppOperationalBar
            tabs={[
              { value: "all", label: "Todas" },
              { value: "pending", label: "Pendentes" },
              { value: "overdue", label: "Vencidas" },
              { value: "paid", label: "Pagas" },
              { value: "canceled", label: "Canceladas" },
            ]}
            activeTab={statusFilter}
            onTabChange={setStatusFilter}
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar cliente, O.S., status ou ID"
            quickFilters={
              <>
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
              </>
            }
            variant="embedded"
          />

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
              <AppDataTable>
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                    <tr>
                      <th className="p-2.5 text-left">Cliente</th>
                      <th className="text-left">Valor</th>
                      <th className="text-left">Status</th>
                      <th className="text-left">Vencimento</th>
                      <th className="text-left">Atraso</th>
                      <th className="text-left">Origem/O.S.</th>
                      <th className="text-left">Risco/pendência</th>
                      <th className="text-left">Ação primária</th>
                      <th className="p-2.5 text-left">Menu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCharges.map(row => {
                      const primaryAction = getChargePrimaryAction(row);
                      return (
                        <tr
                          key={String(row?.id ?? "")}
                          className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--surface-subtle)]/60"
                          onClick={() =>
                            setSelectedChargeId(String(row?.id ?? ""))
                          }
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
                            {formatCurrency(Number(row?.amountCents ?? 0))}
                          </td>
                          <td>
                            <AppStatusBadge
                              label={chargeStatusLabel(row.status)}
                            />
                          </td>
                          <td>{formatDate(row?.dueDate)}</td>
                          <td>
                            {row.status === "OVERDUE"
                              ? `${row.overdueDays} dia(s)`
                              : "—"}
                          </td>
                          <td>{safeText(row.serviceOrderLabel, "Sem O.S.")}</td>
                          <td>
                            <p className="max-w-[220px] text-xs leading-5 text-[var(--text-secondary)]">
                              {getChargeRisk(row)}
                            </p>
                          </td>
                          <td onClick={event => event.stopPropagation()}>
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
                            <p className="mt-1 max-w-[180px] text-[11px] text-[var(--text-muted)]">
                              {primaryAction.reason}
                            </p>
                          </td>
                          <td
                            className="p-2.5"
                            onClick={event => event.stopPropagation()}
                          >
                            <AppRowActionsDropdown
                              items={[
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          title="Detalhe financeiro"
          subtitle="Resumo, cliente, origem operacional, histórico e comunicação quando disponíveis."
        >
          {selectedCharge ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  onClick={() =>
                    void handleCancelCharge(selectedFinancialRecord)
                  }
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
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Histórico / timeline
                  </p>
                  {timelineByCustomerQuery.isLoading ||
                  timelineByServiceOrderQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Carregando histórico...
                    </p>
                  ) : timelineItems.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Histórico indisponível neste ambiente para cliente/O.S.
                      selecionados.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
                      {timelineItems.map(item => (
                        <li
                          key={String(
                            item?.id ??
                              `${item?.createdAt ?? ""}-${item?.title ?? ""}`
                          )}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/40 p-2.5"
                        >
                          <p className="font-medium text-[var(--text-primary)]">
                            {String(
                              item?.title ?? item?.description ?? "Evento"
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatDate(item?.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
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
                </div>
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

        <QuickActionModal
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Valor</span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={payAmount}
                onChange={event => setPayAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Método</span>
              <select
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={payMethod}
                onChange={event =>
                  setPayMethod(event.target.value as PaymentMethod)
                }
              >
                {PAYMENT_METHOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">
                Data de pagamento
              </span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={payDate}
                onChange={event => setPayDate(event.target.value)}
                type="date"
              />
              <span className="text-[11px] text-[var(--text-muted)]">
                Campo informativo (backend atual não persiste data manual).
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">
                Observação
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
                value={payNotes}
                onChange={event => setPayNotes(event.target.value)}
                placeholder="Observação operacional"
              />
              <span className="text-[11px] text-[var(--text-muted)]">
                Campo informativo (endpoint pay não recebe observação neste
                ambiente).
              </span>
            </label>
          </div>
        </QuickActionModal>

        <QuickActionModal
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Valor</span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={editAmount}
                onChange={event => setEditAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">
                Vencimento
              </span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={editDueDate}
                onChange={event => setEditDueDate(event.target.value)}
                type="date"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-[var(--text-muted)]">
                Observações
              </span>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
                value={editNotes}
                onChange={event => setEditNotes(event.target.value)}
              />
            </label>
          </div>
        </QuickActionModal>
      </AppPageShell>
    </PageWrapper>
  );
}
