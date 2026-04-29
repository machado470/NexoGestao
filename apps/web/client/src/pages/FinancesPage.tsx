import { useEffect, useMemo, useState } from "react";
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
  AppPageHeader,
  AppPageLoadingState,
  AppPagination,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { AppPageShell, AppRowActionsDropdown, AppStatCard } from "@/components/app-system";
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
  return String(value ?? "").trim().toUpperCase();
}

function computeDaysOverdue(value: unknown) {
  const dueDate = safeDate(value);
  if (!dueDate) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
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
  const [openPayModalFor, setOpenPayModalFor] = useState<ChargeRecord | null>(null);
  const [openEditModalFor, setOpenEditModalFor] = useState<ChargeRecord | null>(null);
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

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 500 }, { retry: false });
  const customersQuery = trpc.nexo.customers.list.useQuery({ page: 1, limit: 500 }, { retry: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 500 }, { retry: false });

  const markPaidMutation = trpc.finance.charges.pay.useMutation();
  const cancelMutation = trpc.finance.charges.delete.useMutation();
  const editMutation = trpc.finance.charges.update.useMutation();

  const charges = useMemo(() => normalizeArrayPayload<ChargeRecord>(chargesQuery.data), [chargesQuery.data]);
  const customers = useMemo(() => normalizeArrayPayload<any>(customersQuery.data), [customersQuery.data]);
  const serviceOrders = useMemo(() => normalizeArrayPayload<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);

  const customerById = useMemo(
    () => new Map(customers.map((item) => [String(item?.id ?? ""), item])),
    [customers]
  );

  const serviceOrderById = useMemo(
    () => new Map(serviceOrders.map((item) => [String(item?.id ?? ""), item])),
    [serviceOrders]
  );

  const allQueriesLoading = chargesQuery.isLoading || customersQuery.isLoading || serviceOrdersQuery.isLoading;
  const allQueriesErrored = Boolean(chargesQuery.error && charges.length === 0);

  const enrichedCharges = useMemo<ChargeRecord[]>(() => {
    return charges.map((charge: ChargeRecord) => {
      const customerId = String(charge?.customerId ?? charge?.customer?.id ?? "");
      const serviceOrderId = String(charge?.serviceOrderId ?? charge?.serviceOrder?.id ?? "");
      const status = normalizeStatus(charge?.status);
      const customer = charge?.customer ?? customerById.get(customerId) ?? null;
      const serviceOrder = charge?.serviceOrder ?? serviceOrderById.get(serviceOrderId) ?? null;
      const overdueDays = status === "OVERDUE" ? computeDaysOverdue(charge?.dueDate) : 0;

      return {
        ...charge,
        status,
        customerId,
        serviceOrderId,
        customer,
        serviceOrder,
        customerName: String(customer?.name ?? charge?.customerName ?? "Cliente não identificado"),
        serviceOrderLabel: String(serviceOrder?.number ?? serviceOrder?.id ?? serviceOrderId ?? "Sem O.S."),
        overdueDays,
      } as ChargeRecord;
    });
  }, [charges, customerById, serviceOrderById]);

  const scopedCharges = useMemo(() => {
    return enrichedCharges.filter((charge) => {
      if (queryParams.customerId && charge.customerId !== queryParams.customerId) return false;
      if (queryParams.serviceOrderId && charge.serviceOrderId !== queryParams.serviceOrderId) return false;
      return true;
    });
  }, [enrichedCharges, queryParams.customerId, queryParams.serviceOrderId]);

  const filteredCharges = useMemo(() => {
    return scopedCharges.filter((charge) => {
      if (!statusMatchesFilter(charge.status, statusFilter)) return false;
      const source = `${charge.customerName} ${charge.serviceOrderLabel} ${charge.status} ${charge.id ?? ""}`.toLowerCase();
      if (searchTerm.trim() && !source.includes(searchTerm.toLowerCase().trim())) return false;
      return true;
    });
  }, [scopedCharges, searchTerm, statusFilter]);
  const paginatedCharges = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCharges.slice(start, start + pageSize);
  }, [currentPage, filteredCharges, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, queryParams.customerId, queryParams.serviceOrderId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredCharges.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, filteredCharges.length, pageSize]);

  const hasFiltersContext = Boolean(queryParams.customerId || queryParams.serviceOrderId);

  const health = useMemo(() => {
    const received = enrichedCharges
      .filter((item) => item.status === "PAID")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const receivable = enrichedCharges
      .filter((item) => item.status === "PENDING")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const overdue = enrichedCharges
      .filter((item) => item.status === "OVERDUE")
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
    const now = Date.now();
    const nextThirtyDays = now + (1000 * 60 * 60 * 24 * 30);
    const projected = enrichedCharges
      .filter((item) => {
        if (!["PENDING", "OVERDUE"].includes(item.status)) return false;
        const due = safeDate(item?.dueDate)?.getTime();
        if (!due) return false;
        return due <= nextThirtyDays;
      })
      .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

    return { received, receivable, overdue, projected };
  }, [enrichedCharges]);

  const nextBestAction = useMemo(() => {
    const pendingOrOverdue = enrichedCharges.filter((item) => ["PENDING", "OVERDUE"].includes(item.status));
    if (pendingOrOverdue.length === 0) return null;

    const overdue = pendingOrOverdue.filter((item) => item.status === "OVERDUE");
    if (overdue.length > 0) {
      return [...overdue].sort((a, b) => {
        if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
        return Number(b?.amountCents ?? 0) - Number(a?.amountCents ?? 0);
      })[0];
    }

    const pending = pendingOrOverdue.filter((item) => item.status === "PENDING");
    if (pending.length === 0) return null;

    const byAmount = [...pending].sort((a, b) => Number(b?.amountCents ?? 0) - Number(a?.amountCents ?? 0))[0];
    if (Number(byAmount?.amountCents ?? 0) > 0) return byAmount;

    return [...pending].sort((a, b) => {
      const dueA = safeDate(a?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = safeDate(b?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    })[0];
  }, [enrichedCharges]);

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
    return enrichedCharges.find((item) => String(item?.id ?? "") === selectedChargeId) ?? null;
  }, [enrichedCharges, selectedChargeId]);

  const timelineByCustomerQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId: String(selectedCharge?.customerId ?? ""), limit: 20 },
    { enabled: Boolean(selectedCharge?.customerId), retry: false }
  );

  const timelineByServiceOrderQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: String(selectedCharge?.serviceOrderId ?? ""), limit: 20 },
    { enabled: Boolean(selectedCharge?.serviceOrderId), retry: false }
  );

  const timelineItems = useMemo(() => {
    const customerTimeline = normalizeArrayPayload<any>(timelineByCustomerQuery.data);
    const serviceOrderTimeline = normalizeArrayPayload<any>(timelineByServiceOrderQuery.data);
    const combined = [...customerTimeline, ...serviceOrderTimeline];
    const unique = new Map<string, any>();

    for (const item of combined) {
      const key = String(item?.id ?? `${item?.createdAt ?? ""}-${item?.title ?? ""}`);
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

  const hasSearchNoResults = Boolean(searchTerm.trim()) && filteredCharges.length === 0;
  const paymentsListAvailable = false;

  async function refreshAll() {
    await Promise.all([
      chargesQuery.refetch(),
      customersQuery.refetch(),
      serviceOrdersQuery.refetch(),
      timelineByCustomerQuery.refetch(),
      timelineByServiceOrderQuery.refetch(),
    ]);
  }

  async function openMarkAsPaid(charge: ChargeRecord) {
    setPayMethod("PIX");
    setPayAmount(String((Number(charge?.amountCents ?? 0) / 100).toFixed(2)).replace(".", ","));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNotes("");
    setOpenPayModalFor(charge);
  }

  async function submitMarkAsPaid() {
    if (!openPayModalFor?.id) return;
    const normalized = payAmount.replace(/\./g, "").replace(",", ".");
    const amountNumber = Number(normalized);
    const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : 0;
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
    setEditAmount(String((Number(charge?.amountCents ?? 0) / 100).toFixed(2)).replace(".", ","));
    const due = safeDate(charge?.dueDate);
    setEditDueDate(due ? due.toISOString().slice(0, 10) : "");
    setEditNotes(String(charge?.notes ?? ""));
    setOpenEditModalFor(charge);
  }

  async function submitEditCharge() {
    if (!openEditModalFor?.id) return;
    const normalized = editAmount.replace(/\./g, "").replace(",", ".");
    const amountNumber = Number(normalized);
    const amountCents = Number.isFinite(amountNumber) ? Math.round(amountNumber * 100) : 0;

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
    navigate(`/service-orders?customerId=${charge.customerId ?? ""}&serviceOrderId=${charge.serviceOrderId}`);
  }

  function goToWhatsApp(charge: ChargeRecord) {
    if (!charge?.customerId) {
      toast.error("Cliente inválido para abrir WhatsApp.");
      return;
    }
    if (String(charge.status ?? "").toUpperCase() === "PAID") {
      toast.info("Cobrança já paga. Use WhatsApp apenas para comunicação pós-pagamento.");
      navigate(`/whatsapp?customerId=${charge.customerId}`);
      return;
    }
    navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id ?? ""}`);
  }

  return (
    <PageWrapper
      title="Financeiro"
      subtitle="cobrança, recebimento e risco financeiro operacional"
    >
      <AppPageShell className="space-y-4">
        <AppPageHeader
          title="Financeiro"
          description={`cobrança, recebimento e risco financeiro operacional · ${enrichedCharges.length} cobrança(s) carregada(s)`}
          secondaryActions={
            <Button variant="ghost" size="sm" onClick={() => void refreshAll()}>
              Atualizar
            </Button>
          }
          cta={
            <Button onClick={() => setOpenCreate(true)}>
              Nova cobrança
            </Button>
          }
        />

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            label="Recebido"
            value={formatCurrency(health.received)}
            helper="Entradas já confirmadas no caixa."
          />
          <AppStatCard
            label="A receber"
            value={formatCurrency(health.receivable)}
            helper="Cobranças pendentes dentro do fluxo."
          />
          <AppStatCard
            label="Vencido"
            value={formatCurrency(health.overdue)}
            helper="Valores já em atraso."
          />
          <AppStatCard
            label="Previsto"
            value={formatCurrency(health.projected)}
            helper="Pendências previstas para até 30 dias."
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setStatusFilter("paid")}>Ver pagas</Button>
          <Button size="sm" variant="outline" onClick={() => setStatusFilter("pending")}>Pendências de cobrança</Button>
          <Button size="sm" variant="outline" onClick={() => setStatusFilter("overdue")}>Priorizar atraso</Button>
        </div>

        <AppSectionBlock title="Próxima melhor ação" subtitle="Prioridade operacional baseada em dados reais.">
          {nextBestAction ? (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.customerName}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {formatCurrency(Number(nextBestAction?.amountCents ?? 0))}
                  {nextBestAction.status === "OVERDUE" ? ` · ${nextBestAction.overdueDays} dia(s) em atraso` : " · pendência ativa"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">Origem/O.S.: {nextBestAction.serviceOrderLabel}</p>
              </div>
              <Button
               
                onClick={() => {
                  setSelectedChargeId(String(nextBestAction?.id ?? ""));
                  goToWhatsApp(nextBestAction);
                }}
              >
                Acionar WhatsApp
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-200">
              Estado saudável: nenhuma cobrança pendente ou vencida requer ação imediata.
            </div>
          )}
        </AppSectionBlock>

        <AppSectionBlock title="Filtros operacionais" subtitle="Todas, pendentes, vencidas, pagas e canceladas.">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>Todas</Button>
            <Button size="sm" variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pendentes</Button>
            <Button size="sm" variant={statusFilter === "overdue" ? "default" : "outline"} onClick={() => setStatusFilter("overdue")}>Vencidas</Button>
            <Button size="sm" variant={statusFilter === "paid" ? "default" : "outline"} onClick={() => setStatusFilter("paid")}>Pagas</Button>
            <Button size="sm" variant={statusFilter === "canceled" ? "default" : "outline"} onClick={() => setStatusFilter("canceled")}>Canceladas</Button>
            <input
              className="h-9 min-w-[220px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, O.S., status ou ID"
            />
          </div>
          {hasFiltersContext ? (
            <p className="text-xs text-[var(--text-muted)]">
              Contexto ativo via URL:{" "}
              {queryParams.customerId ? `customerId=${queryParams.customerId} ` : ""}
              {queryParams.serviceOrderId ? `serviceOrderId=${queryParams.serviceOrderId}` : ""}
            </p>
          ) : null}
        </AppSectionBlock>

        <AppSectionBlock title="Lista operacional" subtitle="Cobranças reais para cobrança, recebimento e risco.">
          {allQueriesLoading && enrichedCharges.length === 0 ? (
            <AppPageLoadingState description="Carregando cobranças, clientes e O.S...." />
          ) : null}

          {allQueriesErrored ? (
            <AppPageErrorState
              description={chargesQuery.error?.message ?? "Falha ao carregar dados financeiros."}
              actionLabel="Tentar novamente"
              onAction={() => void refreshAll()}
            />
          ) : null}

          {!allQueriesLoading && !allQueriesErrored && filteredCharges.length === 0 ? (
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

          {!allQueriesLoading && !allQueriesErrored && filteredCharges.length > 0 ? (
            <>
              <AppDataTable>
                <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5 text-left">Cliente</th>
                    <th className="text-left">Valor</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Vencimento</th>
                    <th className="text-left">Dias em atraso</th>
                    <th className="text-left">Origem/O.S.</th>
                    <th className="text-left">Forma pagto</th>
                    <th className="p-2.5 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCharges.map((row) => (
                    <tr
                      key={String(row?.id ?? "")}
                      className="cursor-pointer border-t border-[var(--border-subtle)]"
                      onClick={() => setSelectedChargeId(String(row?.id ?? ""))}
                    >
                      <td className="p-2.5">{row.customerName}</td>
                      <td>{formatCurrency(Number(row?.amountCents ?? 0))}</td>
                      <td>
                        <AppStatusBadge label={chargeStatusLabel(row.status)} />
                      </td>
                      <td>{formatDate(row?.dueDate)}</td>
                      <td>{row.status === "OVERDUE" ? `${row.overdueDays} dia(s)` : "—"}</td>
                      <td>{row.serviceOrderLabel}</td>
                      <td>{latestPaymentMethod(row)}</td>
                      <td className="p-2.5" onClick={(event) => event.stopPropagation()}>
                        <AppRowActionsDropdown
                          items={[
                            {
                              label: "Marcar como pago",
                              onSelect: () => void openMarkAsPaid(row),
                              disabled: row.status === "PAID" || row.status === "CANCELED",
                              tone: "primary",
                            },
                            {
                              label: "Editar cobrança",
                              onSelect: () => openEditCharge(row),
                              disabled: row.status === "PAID" || row.status === "CANCELED",
                              tone: "primary",
                            },
                            {
                              label: "Cancelar cobrança",
                              onSelect: () => void handleCancelCharge(row),
                              disabled: row.status === "PAID" || row.status === "CANCELED",
                              tone: "primary",
                            },
                            { type: "separator" },
                            {
                              label: normalizeStatus(row?.status) === "PAID" ? "WhatsApp pós-pagamento" : "Cobrar via WhatsApp",
                              onSelect: () => goToWhatsApp(row),
                              disabled: !row.customerId,
                            },
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
                  ))}
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

        <AppSectionBlock title="Detalhe financeiro" subtitle="Cliente, cobrança, histórico e ações de execução.">
          {selectedCharge ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Cliente</p>
                  <p className="text-sm font-semibold">{selectedCharge.customerName}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Valor</p>
                  <p className="text-sm font-semibold">{formatCurrency(Number(selectedCharge?.amountCents ?? 0))}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Status / vencimento</p>
                  <p className="text-sm font-semibold">{chargeStatusLabel(selectedCharge.status)} · {formatDate(selectedCharge?.dueDate)}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Dias em atraso</p>
                  <p className="text-sm font-semibold">{selectedCharge.status === "OVERDUE" ? `${selectedCharge.overdueDays} dia(s)` : "0"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">O.S. vinculada</p>
                <p className="text-sm text-[var(--text-secondary)]">{selectedCharge.serviceOrderLabel || "Sem O.S. vinculada"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void openMarkAsPaid(selectedCharge)} disabled={selectedCharge.status === "PAID" || selectedCharge.status === "CANCELED" || markPaidMutation.isPending}>
                  {markPaidMutation.isPending ? "Salvando..." : "Marcar como pago"}
                </Button>
                <Button variant="outline" onClick={() => openEditCharge(selectedCharge)} disabled={selectedCharge.status === "PAID" || selectedCharge.status === "CANCELED" || editMutation.isPending}>
                  {editMutation.isPending ? "Salvando..." : "Editar cobrança"}
                </Button>
                <Button variant="outline" onClick={() => void handleCancelCharge(selectedCharge)} disabled={selectedCharge.status === "PAID" || selectedCharge.status === "CANCELED" || cancelMutation.isPending}>
                  {cancelMutation.isPending ? "Salvando..." : "Cancelar cobrança"}
                </Button>
                <Button variant="outline" onClick={() => goToWhatsApp(selectedCharge)}>
                  Enviar WhatsApp contextual
                </Button>
                <Button variant="outline" onClick={() => goToCustomer(selectedCharge)}>
                  Abrir cliente
                </Button>
                <Button variant="outline" onClick={() => goToServiceOrder(selectedCharge)}>
                  Abrir O.S.
                </Button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Histórico / timeline</p>
                  {timelineByCustomerQuery.isLoading || timelineByServiceOrderQuery.isLoading ? (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">Carregando histórico...</p>
                  ) : timelineItems.length === 0 ? (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">Histórico indisponível neste ambiente.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-[var(--text-secondary)]">
                      {timelineItems.map((item) => (
                        <li key={String(item?.id ?? `${item?.createdAt ?? ""}-${item?.title ?? ""}`)} className="rounded-lg border border-[var(--border-subtle)] p-2.5">
                          <p className="font-medium text-[var(--text-primary)]">{String(item?.title ?? item?.description ?? "Evento")}</p>
                          <p className="text-xs text-[var(--text-muted)]">{formatDate(item?.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">Mensagens / cobranças enviadas</p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {paymentsListAvailable
                      ? "Integração de mensagens/pagamentos conectada."
                      : "ação indisponível neste ambiente: endpoint de listagem de pagamentos/mensagens não exposto no BFF."}
                  </p>
                  <Button className="mt-3" variant="outline" onClick={() => goToWhatsApp(selectedCharge)}>
                    Ir para WhatsApp com contexto
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Selecione uma cobrança para abrir o painel detalhado.</p>
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
          onOpenChange={(open) => {
            if (!open) setOpenPayModalFor(null);
          }}
          title="Marcar como pago"
          description="Registrar recebimento real da cobrança."
          size="md"
          closeBlocked={markPaidMutation.isPending}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                Resumo: {openPayModalFor ? formatCurrency(Number(openPayModalFor?.amountCents ?? 0)) : "—"}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenPayModalFor(null)} disabled={markPaidMutation.isPending}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void submitMarkAsPaid()} disabled={markPaidMutation.isPending}>
                  {markPaidMutation.isPending ? "Salvando..." : "Confirmar pagamento"}
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
                onChange={(event) => setPayAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Método</span>
              <select
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={payMethod}
                onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Data de pagamento</span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={payDate}
                onChange={(event) => setPayDate(event.target.value)}
                type="date"
              />
              <span className="text-[11px] text-[var(--text-muted)]">Campo informativo (backend atual não persiste data manual).</span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Observação</span>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
                value={payNotes}
                onChange={(event) => setPayNotes(event.target.value)}
                placeholder="Observação operacional"
              />
              <span className="text-[11px] text-[var(--text-muted)]">Campo informativo (endpoint pay não recebe observação neste ambiente).</span>
            </label>
          </div>
        </QuickActionModal>

        <QuickActionModal
          open={Boolean(openEditModalFor)}
          onOpenChange={(open) => {
            if (!open) setOpenEditModalFor(null);
          }}
          title="Editar cobrança"
          description="Atualize valor, vencimento e observações com persistência no backend."
          size="md"
          closeBlocked={editMutation.isPending}
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">Resumo atualizado no backend em tempo real.</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenEditModalFor(null)} disabled={editMutation.isPending}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void submitEditCharge()} disabled={editMutation.isPending}>
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
                onChange={(event) => setEditAmount(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-[var(--text-muted)]">Vencimento</span>
              <input
                className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
                type="date"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-[var(--text-muted)]">Observações</span>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
              />
            </label>
          </div>
        </QuickActionModal>
      </AppPageShell>
    </PageWrapper>
  );
}
