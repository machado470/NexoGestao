import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppPageErrorState, AppPageLoadingState, AppSecondaryTabs } from "@/components/internal-page-system";
import { toast } from "sonner";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { formatDelta, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { setBootPhase } from "@/lib/bootPhase";
import { FinanceOverview } from "@/components/finance-modes/FinanceOverview";
import { FinancePending } from "@/components/finance-modes/FinancePending";
import { FinanceOverdue } from "@/components/finance-modes/FinanceOverdue";
import { FinancePaid } from "@/components/finance-modes/FinancePaid";
import { FinanceReports } from "@/components/finance-modes/FinanceReports";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function FinancesPage() {
  setBootPhase("PAGE:Financeiro");
  useRenderWatchdog("FinancesPage");
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [mode, setMode] = useState<"overview" | "pending" | "overdue" | "paid" | "reports">("overview");

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const statsQuery = trpc.finance.charges.stats.useQuery(undefined, { retry: false });
  const revenueQuery = trpc.finance.charges.revenueByMonth.useQuery(undefined, { retry: false });

  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const stats = useMemo(() => normalizeObjectPayload<any>(statsQuery.data) ?? {}, [statsQuery.data]);
  const pendingCharges = useMemo(() => charges.filter(item => String(item?.status ?? "").toUpperCase() === "PENDING"), [charges]);
  const overdueCharges = useMemo(() => charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE"), [charges]);
  const paidCharges = useMemo(() => charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID"), [charges]);

  const hasChargeData = charges.length > 0;
  const showChargesInitialLoading = chargesQuery.isLoading && !hasChargeData;
  const showChargesErrorState = chargesQuery.error && !hasChargeData;

  const revenueDataParsed = useMemo(() => {
    return normalizeArrayPayload<any>(revenueQuery.data).map((item) => ({
      label: String(item?.month ?? item?.label ?? "Mês"),
      revenue: Number(item?.totalRevenueCents ?? item?.revenueCents ?? item?.amountCents ?? 0) / 100,
    }));
  }, [revenueQuery.data]);

  const revenueSafe = useMemo(
    () => safeChartData<{ label: string; revenue: number }>(revenueDataParsed, ["revenue"]),
    [revenueDataParsed]
  );

  const statusDistribution = useMemo(
    () => ([
      { label: "Pendentes", value: pendingCharges.length },
      { label: "Vencidas", value: overdueCharges.length },
      { label: "Pagas", value: paidCharges.length },
    ]),
    [overdueCharges.length, paidCharges.length, pendingCharges.length]
  );

  const current30 = getWindow(30, 0);
  const previous30 = getWindow(30, 1);
  const receivedCurrent = paidCharges
    .filter(item => inRange(safeDate(item?.paidAt ?? item?.updatedAt), current30.start, current30.end))
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const receivedPrevious = paidCharges
    .filter(item => inRange(safeDate(item?.paidAt ?? item?.updatedAt), previous30.start, previous30.end))
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const overdueCurrent = overdueCharges.filter(item => inRange(safeDate(item?.dueDate), current30.start, current30.end)).length;
  const overduePrevious = overdueCharges.filter(item => inRange(safeDate(item?.dueDate), previous30.start, previous30.end)).length;
  const openTotal = [...pendingCharges, ...overdueCharges].reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const overdueTotal = overdueCharges.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const receivedTotal = paidCharges.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);

  const dueSoon = pendingCharges.filter((item) => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    const delta = due.getTime() - Date.now();
    return delta >= 0 && delta <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  const dueToday = pendingCharges.filter((item) => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    return due.toDateString() === new Date().toDateString();
  }).length;

  const clientesPossivelAtraso = new Set(
    pendingCharges
      .filter((item) => Number(item?.reminderCount ?? 0) >= 2)
      .map((item) => String(item?.customerId ?? ""))
      .filter(Boolean)
  ).size;

  const cobrancasFilaResumo = [...overdueCharges, ...pendingCharges]
    .slice(0, 6)
    .map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} · ${formatCurrency(Number(item?.amountCents ?? 0))}`,
      subtitle: `${String(item?.status ?? "").toUpperCase() === "OVERDUE" ? "Vencida" : "Pendente"} · vence ${item?.dueDate ? new Date(String(item?.dueDate)).toLocaleDateString("pt-BR") : "sem data"}`,
    }));

  const kpis = [
    {
      title: "Recebido no período",
      value: formatCurrency(receivedCurrent),
      delta: formatDelta(percentDelta(receivedCurrent, receivedPrevious)),
      trend: trendFromDelta(percentDelta(receivedCurrent, receivedPrevious)),
      hint: "30 dias vs período anterior",
      tone: "important" as const,
    },
    { title: "Total em aberto", value: formatCurrency(openTotal), hint: "pendentes + vencidas" },
    {
      title: "Em atraso",
      value: String(stats.overdueCount ?? 0),
      delta: formatDelta(percentDelta(overdueCurrent, overduePrevious)),
      trend: trendFromDelta(percentDelta(overdueCurrent, overduePrevious)),
      hint: "cobranças vencidas",
      tone: Number(stats.overdueCount ?? 0) > 0 ? "critical" as const : "default" as const,
    },
    { title: "Recebidas", value: String(paidCharges.length), hint: "quantidade de cobranças pagas" },
  ];

  usePageDiagnostics({
    page: "finances",
    isLoading: showChargesInitialLoading || (revenueQuery.isLoading && revenueSafe.data.length === 0),
    hasError: Boolean(showChargesErrorState || (revenueQuery.error && revenueSafe.data.length === 0)),
    isEmpty: !showChargesInitialLoading && !showChargesErrorState && charges.length === 0 && !revenueQuery.isLoading,
    dataCount: charges.length,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] finances");
  }, []);

  const handleCharge = (charge?: any) => {
    if (charge?.customerId && charge?.id) {
      navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`);
      return;
    }
    navigate("/whatsapp?context=overdue-charges");
  };

  const handleRemind = (charge?: any) => {
    if (charge?.customerId && charge?.id) {
      navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`);
      return;
    }
    const firstPending = pendingCharges[0];
    if (firstPending?.customerId && firstPending?.id) {
      navigate(`/whatsapp?customerId=${firstPending.customerId}&chargeId=${firstPending.id}`);
      return;
    }
    toast.message("Sem cobrança pendente para lembrar agora.");
  };

  return (
    <PageWrapper title="Financeiro" subtitle="Dinheiro em movimento: cobrança, atraso, recebimento e decisão rápida.">
      <OperationalTopCard
        contextLabel="Direção de receita"
        title="Fluxo cobrança → pagamento"
        description="Agora por contexto operacional: visão, pendências, urgências, histórico e análise."
        primaryAction={<ActionFeedbackButton state="idle" idleLabel="Criar cobrança agora" onClick={() => setOpenCreate(true)} />}
      />

      <AppSecondaryTabs
        items={[
          { value: "overview", label: "Visão geral" },
          { value: "pending", label: "Pendentes" },
          { value: "overdue", label: "Vencidas" },
          { value: "paid", label: "Pagas" },
          { value: "reports", label: "Relatórios" },
        ]}
        value={mode}
        onChange={(value) => setMode(value as typeof mode)}
      />

      {showChargesInitialLoading ? <AppPageLoadingState description="Carregando financeiro..." /> : null}
      {showChargesErrorState ? (
        <AppPageErrorState
          description={chargesQuery.error?.message ?? "Falha ao carregar cobranças."}
          actionLabel="Tentar novamente"
          onAction={() => void chargesQuery.refetch()}
        />
      ) : null}

      {!showChargesInitialLoading && !showChargesErrorState ? (
        <>
          {mode === "overview" && (
            <FinanceOverview
              kpis={kpis}
              revenueData={revenueSafe.data}
              revenueLoading={revenueQuery.isLoading}
              revenueError={revenueQuery.error?.message}
              isRevenueValid={revenueSafe.isValid}
              revenueInvalidReason={revenueSafe.reason}
              riskSummary={`${String(stats.overdueCount ?? 0)} vencidas · ${dueToday} vencendo hoje · ${dueSoon} em até 7 dias · ${clientesPossivelAtraso} clientes em risco alto.`}
              openCreate={() => setOpenCreate(true)}
              cobrarAgora={() => handleCharge()}
              nextActions={cobrancasFilaResumo}
            />
          )}
          {mode === "pending" && <FinancePending charges={pendingCharges} onRemind={handleRemind} formatCurrency={formatCurrency} />}
          {mode === "overdue" && <FinanceOverdue charges={overdueCharges} onCharge={handleCharge} formatCurrency={formatCurrency} />}
          {mode === "paid" && <FinancePaid charges={paidCharges} formatCurrency={formatCurrency} />}
          {mode === "reports" && (
            <FinanceReports
              revenueData={revenueSafe.data}
              statusDistribution={statusDistribution}
              overdueTotal={formatCurrency(overdueTotal)}
              openTotal={formatCurrency(openTotal)}
              receivedTotal={formatCurrency(receivedTotal)}
            />
          )}
        </>
      ) : null}

      <CreateChargeModal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        onSuccess={() => {
          void Promise.all([chargesQuery.refetch(), statsQuery.refetch(), revenueQuery.refetch()]);
        }}
      />
    </PageWrapper>
  );
}
