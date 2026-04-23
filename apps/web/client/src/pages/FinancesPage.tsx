import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/design-system";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppFiltersBar,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { AppPageShell, AppRowActionsDropdown, AppStatCard } from "@/components/app-system";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { safeDate } from "@/lib/operational/kpi";
import { trpc } from "@/lib/trpc";
import {
  type FinanceTrendPeriod,
  FinanceTrendEngine,
} from "@/components/finance-modes/FinanceTrendEngine";

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

function toDayKey(date: Date) {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return safe.toISOString().slice(0, 10);
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type ChargeRecord = Record<string, any>;

export default function FinancesPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [period, setPeriod] = useState<FinanceTrendPeriod>("30d");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "7d" | "15d" | "30d">("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [selectedTrendPointKey, setSelectedTrendPointKey] = useState<string | null>(null);

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 150 }, { retry: false });
  const markPaidMutation = trpc.finance.charges.pay.useMutation();

  const charges = useMemo(
    () => normalizeArrayPayload<ChargeRecord>(chargesQuery.data),
    [chargesQuery.data]
  );

  const hasData = charges.length > 0;
  const showInitialLoading = chargesQuery.isLoading && !hasData;
  const showErrorState = chargesQuery.error && !hasData;

  const now = Date.now();

  const pendingCharges = useMemo(
    () => charges.filter(item => String(item?.status ?? "").toUpperCase() === "PENDING"),
    [charges]
  );
  const overdueCharges = useMemo(
    () => charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE"),
    [charges]
  );
  const paidCharges = useMemo(
    () => charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID"),
    [charges]
  );

  const totalReceived = paidCharges.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const totalPending = pendingCharges.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const totalOverdue = overdueCharges.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const totalRevenue = totalReceived + totalPending + totalOverdue;

  const dueSoonCharges = pendingCharges.filter(item => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    const delta = due.getTime() - now;
    return delta >= 0 && delta <= 1000 * 60 * 60 * 24 * 3;
  });

  const paymentFailureCount = pendingCharges.filter(item => {
    const notes = String(item?.notes ?? "").toLowerCase();
    return notes.includes("falha") || notes.includes("erro") || notes.includes("recus");
  }).length;

  const priorityCharge = useMemo(() => {
    if (overdueCharges.length > 0) {
      return [...overdueCharges].sort(
        (a, b) => Number(b?.amountCents ?? 0) - Number(a?.amountCents ?? 0)
      )[0];
    }

    return [...pendingCharges].sort((a, b) => {
      const aDue = safeDate(a?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = safeDate(b?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0];
  }, [overdueCharges, pendingCharges]);

  const trendPoints = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number; projected: number; overdue: number; riskCents: number; date: Date }>();
    const start = new Date();
    for (let offset = 89; offset >= 0; offset -= 1) {
      const day = new Date(start);
      day.setDate(start.getDate() - offset);
      const key = toDayKey(day);
      map.set(key, { key, label: dayLabel(day), revenue: 0, projected: 0, overdue: 0, riskCents: 0, date: day });
    }

    paidCharges.forEach(item => {
      const paidAt = safeDate(item?.paidAt ?? item?.updatedAt);
      if (!paidAt) return;
      const entry = map.get(toDayKey(paidAt));
      if (entry) entry.revenue += Number(item?.amountCents ?? 0) / 100;
    });

    [...pendingCharges, ...overdueCharges].forEach(item => {
      const dueAt = safeDate(item?.dueDate);
      if (!dueAt) return;
      const entry = map.get(toDayKey(dueAt));
      if (!entry) return;
      entry.projected += Number(item?.amountCents ?? 0) / 100;
      entry.riskCents += Number(item?.amountCents ?? 0);
      if (String(item?.status ?? "").toUpperCase() === "OVERDUE") entry.overdue += 1;
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const base = Array.from(map.values());

    return {
      "7d": base.slice(-7),
      "30d": base.slice(-30),
      "90d": base,
      month: base.filter(item => item.date >= monthStart),
    } as Record<FinanceTrendPeriod, typeof base>;
  }, [overdueCharges, paidCharges, pendingCharges]);

  const customerOptions = useMemo(() => {
    return Array.from(
      new Set(
        charges
          .map(item => String(item?.customer?.name ?? item?.customerName ?? ""))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [charges]);

  const filteredRows = useMemo(() => {
    return charges.filter(item => {
      const status = String(item?.status ?? "").toUpperCase();
      if (statusFilter !== "all" && status !== statusFilter.toUpperCase()) return false;

      const customerName = String(item?.customer?.name ?? item?.customerName ?? "");
      if (customerFilter !== "all" && customerName !== customerFilter) return false;

      if (periodFilter !== "all") {
        const dueDate = safeDate(item?.dueDate);
        if (!dueDate) return false;
        const deltaDays = Math.ceil((now - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const max = Number(periodFilter.replace("d", ""));
        if (deltaDays > max) return false;
      }

      if (searchTerm.trim()) {
        const source = String(item?.serviceOrderId ?? item?.serviceOrder?.id ?? item?.origin ?? "");
        const haystack = `${customerName} ${source} ${status}`.toLowerCase();
        if (!haystack.includes(searchTerm.toLowerCase())) return false;
      }

      return true;
    });
  }, [charges, customerFilter, now, periodFilter, searchTerm, statusFilter]);

  const selectedCharge = useMemo(() => {
    const fallback = priorityCharge ? String(priorityCharge?.id ?? "") : null;
    const targetId = selectedChargeId ?? fallback;
    if (!targetId) return null;
    return charges.find(item => String(item?.id ?? "") === targetId) ?? null;
  }, [charges, priorityCharge, selectedChargeId]);

  async function markAsPaid(charge: ChargeRecord) {
    const amountCents = Number(charge?.amountCents ?? 0);
    if (amountCents <= 0) {
      toast.error("Não foi possível marcar como pago: valor inválido.");
      return;
    }
    try {
      await markPaidMutation.mutateAsync({ chargeId: String(charge?.id ?? ""), amountCents, method: "PIX" });
      toast.success("Cobrança marcada como paga.");
      await chargesQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Falha ao marcar cobrança como paga.");
    }
  }

  function triggerChargeAction(charge?: ChargeRecord) {
    const focus = charge ?? priorityCharge;
    if (!focus) {
      toast.message("Sem cobrança prioritária no momento.");
      return;
    }
    setSelectedChargeId(String(focus?.id ?? ""));
    toast.success(`Cobrança pronta para ação: ${String(focus?.customer?.name ?? "Cliente")}.`);
  }

  return (
    <PageWrapper title="Financeiro" subtitle="Cobrança, recebimento e fluxo de caixa em ação.">
      <AppPageShell className="space-y-4">
        <AppPageHeader
          title="Financeiro operacional"
          description="Aqui você vê quanto entrou, quanto falta entrar e qual cobrança fazer agora para gerar caixa."
          secondaryActions={
            <Button variant="ghost" size="sm" onClick={() => void chargesQuery.refetch()}>
              Atualizar
            </Button>
          }
          cta={<Button onClick={() => setOpenCreate(true)}>Nova cobrança</Button>}
        />

        <div className="grid gap-3 lg:grid-cols-3">
          <AppSectionBlock title="Atenção imediata" subtitle="Até 3 alertas que travam caixa.">
            <div className="space-y-2">
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Valores em atraso</p>
                <p className="text-sm font-semibold">{formatCurrency(totalOverdue)} · {overdueCharges.length} cobrança(s)</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Cobranças vencendo</p>
                <p className="text-sm font-semibold">{dueSoonCharges.length} em até 3 dias</p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Falhas de pagamento</p>
                <p className="text-sm font-semibold">{paymentFailureCount} ocorrência(s) com erro</p>
              </div>
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="Próxima melhor ação" subtitle="Uma ação clara para receber agora.">
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {priorityCharge
                  ? `Cobrar ${String(priorityCharge?.customer?.name ?? "cliente")} para recuperar ${formatCurrency(Number(priorityCharge?.amountCents ?? 0))}.`
                  : "Sem cobrança crítica no momento."}
              </p>
              <Button className="w-full" onClick={() => triggerChargeAction(priorityCharge ?? undefined)}>
                {priorityCharge ? "Cobrar cliente específico" : "Sem ação crítica"}
              </Button>
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="Conexão com receita" subtitle="Impacto direto da cobrança no caixa.">
            <p className="text-sm text-[var(--text-secondary)]">
              Cada cobrança pendente ou vencida aqui é dinheiro que ainda não entrou no caixa. As ações da lista abaixo viram receita recebida.
            </p>
          </AppSectionBlock>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <AppStatCard label="Receita" value={formatCurrency(totalRevenue)} helper="Total entre recebido + pendente + atraso." />
          <AppStatCard label="Recebido" value={formatCurrency(totalReceived)} helper="Já entrou no caixa." />
          <AppStatCard label="Pendente" value={formatCurrency(totalPending)} helper="Ainda dentro do prazo." />
          <AppStatCard label="Atraso" value={formatCurrency(totalOverdue)} helper="Prioridade de cobrança." />
        </div>

        <FinanceTrendEngine
          period={period}
          onPeriodChange={setPeriod}
          points={trendPoints[period]}
          selectedPointKey={selectedTrendPointKey}
          onSelectPoint={setSelectedTrendPointKey}
        />

        <AppFiltersBar className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>Todas</Button>
            <Button size="sm" variant={statusFilter === "pending" ? "default" : "outline"} onClick={() => setStatusFilter("pending")}>Pendentes</Button>
            <Button size="sm" variant={statusFilter === "overdue" ? "default" : "outline"} onClick={() => setStatusFilter("overdue")}>Vencidas</Button>
            <Button size="sm" variant={statusFilter === "paid" ? "default" : "outline"} onClick={() => setStatusFilter("paid")}>Pagas</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              className="h-9 min-w-[220px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente, O.S. ou status"
            />
            <select
              className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2"
              value={customerFilter}
              onChange={event => setCustomerFilter(event.target.value)}
            >
              <option value="all">Todos os clientes</option>
              {customerOptions.map(customer => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2"
              value={periodFilter}
              onChange={event => setPeriodFilter(event.target.value as typeof periodFilter)}
            >
              <option value="all">Todo período</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="15d">Últimos 15 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>
          </div>
        </AppFiltersBar>

        <AppSectionBlock title="Lista de cobranças" subtitle="Ação sem troca de tela.">
          {showInitialLoading ? <AppPageLoadingState description="Carregando cobranças..." /> : null}
          {showErrorState ? (
            <AppPageErrorState
              description={chargesQuery.error?.message ?? "Falha ao carregar cobranças."}
              actionLabel="Tentar novamente"
              onAction={() => void chargesQuery.refetch()}
            />
          ) : null}

          {!showInitialLoading && !showErrorState && filteredRows.length === 0 ? (
            <AppPageEmptyState
              title="Nenhuma cobrança neste filtro"
              description="Ajuste os filtros ou crie uma nova cobrança para continuar a operação de caixa."
            />
          ) : null}

          {!showInitialLoading && !showErrorState && filteredRows.length > 0 ? (
            <AppDataTable>
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th className="p-2.5 text-left">Cliente</th>
                    <th className="text-left">Valor</th>
                    <th className="text-left">Vencimento</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Origem (O.S.)</th>
                    <th className="p-2.5 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, 40).map(row => {
                    const status = String(row?.status ?? "").toUpperCase();
                    return (
                      <tr
                        key={String(row?.id ?? Math.random())}
                        className="cursor-pointer border-t border-[var(--border-subtle)]"
                        onClick={() => setSelectedChargeId(String(row?.id ?? ""))}
                      >
                        <td className="p-2.5">{String(row?.customer?.name ?? row?.customerName ?? "Sem cliente")}</td>
                        <td>{formatCurrency(Number(row?.amountCents ?? 0))}</td>
                        <td>{formatDate(row?.dueDate)}</td>
                        <td>
                          <AppStatusBadge
                            label={status === "OVERDUE" ? "Vencida" : status === "PAID" ? "Paga" : "Pendente"}
                          />
                        </td>
                        <td>{String(row?.serviceOrderId ?? row?.serviceOrder?.id ?? row?.origin ?? "Sem O.S.")}</td>
                        <td className="p-2.5">
                          <AppRowActionsDropdown
                            items={[
                              { label: "Cobrar", onSelect: () => triggerChargeAction(row) },
                              { label: "Reenviar link", onSelect: () => triggerChargeAction(row) },
                              { label: "Marcar pago", onSelect: () => void markAsPaid(row) },
                              {
                                label: "Abrir cliente",
                                onSelect: () => navigate(`/clientes?customerId=${String(row?.customerId ?? row?.customer?.id ?? "")}`),
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
          ) : null}
        </AppSectionBlock>

        <AppSectionBlock title="Contexto da cobrança" subtitle="Cliente, cobrança, histórico, mensagens e O.S.">
          {selectedCharge ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Cliente</p>
                <p className="font-medium">{String(selectedCharge?.customer?.name ?? selectedCharge?.customerName ?? "Sem cliente")}</p>
                <p className="text-xs text-[var(--text-secondary)]">ID: {String(selectedCharge?.customerId ?? selectedCharge?.customer?.id ?? "—")}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Cobrança</p>
                <p className="font-medium">{formatCurrency(Number(selectedCharge?.amountCents ?? 0))}</p>
                <p className="text-xs text-[var(--text-secondary)]">Vencimento: {formatDate(selectedCharge?.dueDate)}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Histórico</p>
                <p className="text-xs text-[var(--text-secondary)]">Criada em {formatDate(selectedCharge?.createdAt)} · Atualizada em {formatDate(selectedCharge?.updatedAt)}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-xs text-[var(--text-muted)]">Mensagens</p>
                <p className="text-xs text-[var(--text-secondary)]">Use as ações de cobrança para acionar o WhatsApp sem sair desta tela.</p>
              </div>
              <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3 md:col-span-2">
                <p className="text-xs text-[var(--text-muted)]">Origem (O.S.)</p>
                <p className="text-sm text-[var(--text-secondary)]">{String(selectedCharge?.serviceOrderId ?? selectedCharge?.serviceOrder?.id ?? selectedCharge?.origin ?? "Sem O.S. vinculada")}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Selecione uma cobrança na lista para abrir o contexto detalhado.</p>
          )}
        </AppSectionBlock>

        <CreateChargeModal
          isOpen={openCreate}
          onClose={() => setOpenCreate(false)}
          onSuccess={() => {
            void chargesQuery.refetch();
          }}
        />
      </AppPageShell>
    </PageWrapper>
  );
}
