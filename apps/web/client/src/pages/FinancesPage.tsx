import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  AppPageErrorState,
  AppPageLoadingState,
  AppSecondaryTabs,
} from "@/components/internal-page-system";
import { toast } from "sonner";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  formatDelta,
  getWindow,
  inRange,
  percentDelta,
  safeDate,
  trendFromDelta,
} from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { setBootPhase } from "@/lib/bootPhase";
import { FinanceOverview } from "@/components/finance-modes/FinanceOverview";
import { FinancePending } from "@/components/finance-modes/FinancePending";
import { FinanceOverdue } from "@/components/finance-modes/FinanceOverdue";
import { FinancePaid } from "@/components/finance-modes/FinancePaid";
import { FinanceReports } from "@/components/finance-modes/FinanceReports";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function toDayKey(date: Date) {
  const safe = new Date(date);
  safe.setHours(0, 0, 0, 0);
  return safe.toISOString().slice(0, 10);
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function FinancesPage() {
  setBootPhase("PAGE:Financeiro");
  useRenderWatchdog("FinancesPage");
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const [mode, setMode] = useState<
    "overview" | "pending" | "overdue" | "paid" | "reports"
  >("overview");

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 100 },
    { retry: false }
  );
  const statsQuery = trpc.finance.charges.stats.useQuery(undefined, {
    retry: false,
  });
  const revenueQuery = trpc.finance.charges.revenueByMonth.useQuery(undefined, {
    retry: false,
  });

  const charges = useMemo(
    () => normalizeArrayPayload<any>(chargesQuery.data),
    [chargesQuery.data]
  );
  const stats = useMemo(
    () => normalizeObjectPayload<any>(statsQuery.data) ?? {},
    [statsQuery.data]
  );
  const pendingCharges = useMemo(
    () =>
      charges.filter(
        item => String(item?.status ?? "").toUpperCase() === "PENDING"
      ),
    [charges]
  );
  const overdueCharges = useMemo(
    () =>
      charges.filter(
        item => String(item?.status ?? "").toUpperCase() === "OVERDUE"
      ),
    [charges]
  );
  const paidCharges = useMemo(
    () =>
      charges.filter(
        item => String(item?.status ?? "").toUpperCase() === "PAID"
      ),
    [charges]
  );

  const hasChargeData = charges.length > 0;
  const showChargesInitialLoading = chargesQuery.isLoading && !hasChargeData;
  const showChargesErrorState = chargesQuery.error && !hasChargeData;

  const revenueDataParsed = useMemo(() => {
    return normalizeArrayPayload<any>(revenueQuery.data).map(item => ({
      label: String(item?.month ?? item?.label ?? "Mês"),
      revenue:
        Number(
          item?.totalRevenueCents ??
            item?.revenueCents ??
            item?.amountCents ??
            0
        ) / 100,
    }));
  }, [revenueQuery.data]);

  const current30 = getWindow(30, 0);
  const previous30 = getWindow(30, 1);
  const receivedCurrent = paidCharges
    .filter(item =>
      inRange(
        safeDate(item?.paidAt ?? item?.updatedAt),
        current30.start,
        current30.end
      )
    )
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const receivedPrevious = paidCharges
    .filter(item =>
      inRange(
        safeDate(item?.paidAt ?? item?.updatedAt),
        previous30.start,
        previous30.end
      )
    )
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const overdueCurrent = overdueCharges.filter(item =>
    inRange(safeDate(item?.dueDate), current30.start, current30.end)
  ).length;
  const overduePrevious = overdueCharges.filter(item =>
    inRange(safeDate(item?.dueDate), previous30.start, previous30.end)
  ).length;
  const openTotal = [...pendingCharges, ...overdueCharges].reduce(
    (acc, item) => acc + Number(item?.amountCents ?? 0),
    0
  );
  const overdueTotal = overdueCharges.reduce(
    (acc, item) => acc + Number(item?.amountCents ?? 0),
    0
  );
  const pendingTotal = pendingCharges.reduce(
    (acc, item) => acc + Number(item?.amountCents ?? 0),
    0
  );
  const receivedTotal = paidCharges.reduce(
    (acc, item) => acc + Number(item?.amountCents ?? 0),
    0
  );

  const dueSoon = pendingCharges.filter(item => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    const delta = due.getTime() - Date.now();
    return delta >= 0 && delta <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  const dueToday = pendingCharges.filter(item => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    return due.toDateString() === new Date().toDateString();
  }).length;

  const kpis = [
    {
      title: "Recebido no período",
      value: formatCurrency(receivedCurrent),
      delta: formatDelta(percentDelta(receivedCurrent, receivedPrevious)),
      trend: trendFromDelta(percentDelta(receivedCurrent, receivedPrevious)),
      hint: "30 dias vs período anterior",
      tone: "important" as const,
      onClick: () => setMode("paid"),
      ctaLabel: "Ver pagas",
    },
    {
      title: "Total em aberto",
      value: formatCurrency(openTotal),
      hint: "pendentes + vencidas",
      onClick: () => setMode("pending"),
      ctaLabel: "Ver pendentes",
    },
    {
      title: "Em atraso",
      value: String(stats.overdueCount ?? 0),
      delta: formatDelta(percentDelta(overdueCurrent, overduePrevious)),
      trend: trendFromDelta(percentDelta(overdueCurrent, overduePrevious)),
      hint: "cobranças vencidas",
      tone:
        Number(stats.overdueCount ?? 0) > 0
          ? ("critical" as const)
          : ("default" as const),
      onClick: () => setMode("overdue"),
      ctaLabel: "Tratar atraso",
    },
    {
      title: "Pagas no período",
      value: String(paidCharges.length),
      hint: "quantidade de cobranças pagas",
      onClick: () => setMode("paid"),
      ctaLabel: "Abrir pagas",
    },
  ];

  const trendByDay = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        revenue: number;
        projected: number;
        overdue: number;
        date: Date;
      }
    >();
    const now = new Date();
    for (let offset = 89; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = toDayKey(date);
      map.set(key, {
        label: dayLabel(date),
        revenue: 0,
        projected: 0,
        overdue: 0,
        date,
      });
    }

    paidCharges.forEach(item => {
      const paidAt = safeDate(item?.paidAt ?? item?.updatedAt);
      if (!paidAt) return;
      const key = toDayKey(paidAt);
      const entry = map.get(key);
      if (!entry) return;
      entry.revenue += Number(item?.amountCents ?? 0) / 100;
    });

    [...pendingCharges, ...overdueCharges].forEach(item => {
      const dueDate = safeDate(item?.dueDate);
      if (!dueDate) return;
      const key = toDayKey(dueDate);
      const entry = map.get(key);
      if (!entry) return;
      entry.projected += Number(item?.amountCents ?? 0) / 100;
      if (String(item?.status ?? "").toUpperCase() === "OVERDUE") {
        entry.overdue += 1;
      }
    });

    return Array.from(map.values());
  }, [overdueCharges, paidCharges, pendingCharges]);

  const trendPeriods = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return {
      "7d": trendByDay.slice(-7),
      "30d": trendByDay.slice(-30),
      "90d": trendByDay,
      month: trendByDay.filter(item => item.date >= monthStart),
    } as const;
  }, [trendByDay]);

  const revenueSafe = useMemo(
    () =>
      safeChartData<{
        label: string;
        revenue: number;
        projected: number;
        overdue: number;
      }>(trendPeriods["30d"], ["revenue", "projected", "overdue"]),
    [trendPeriods]
  );

  const statusDistribution = useMemo(
    () => [
      {
        key: "pending" as const,
        label: "Pendentes",
        value: pendingCharges.length,
        total: formatCurrency(pendingTotal),
      },
      {
        key: "overdue" as const,
        label: "Vencidas",
        value: overdueCharges.length,
        total: formatCurrency(overdueTotal),
      },
      {
        key: "paid" as const,
        label: "Pagas",
        value: paidCharges.length,
        total: formatCurrency(receivedTotal),
      },
    ],
    [
      overdueCharges.length,
      overdueTotal,
      paidCharges.length,
      pendingCharges.length,
      pendingTotal,
      receivedTotal,
    ]
  );

  const handleCharge = (charge?: any) => {
    if (charge?.customerId && charge?.id) {
      navigate(
        `/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`
      );
      return;
    }
    navigate("/whatsapp?context=overdue-charges");
  };

  const handleRemind = (charge?: any) => {
    if (charge?.customerId && charge?.id) {
      navigate(
        `/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`
      );
      return;
    }
    const firstPending = pendingCharges[0];
    if (firstPending?.customerId && firstPending?.id) {
      navigate(
        `/whatsapp?customerId=${firstPending.customerId}&chargeId=${firstPending.id}`
      );
      return;
    }
    toast.message("Sem cobrança pendente para lembrar agora.");
  };

  const queueItems = useMemo(() => {
    const ranked = [...overdueCharges, ...pendingCharges, ...paidCharges]
      .sort((a, b) => {
        const aDue = safeDate(a?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = safeDate(b?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 6)
      .map((item, index) => {
        const status = String(item?.status ?? "").toUpperCase();
        const dueDate = safeDate(item?.dueDate);
        const dueDateLabel = dueDate
          ? dueDate.toLocaleDateString("pt-BR")
          : "sem data";
        if (status === "OVERDUE") {
          return {
            id: String(item?.id ?? `overdue-${index}`),
            client: String(item?.customer?.name ?? "Cliente"),
            value: formatCurrency(Number(item?.amountCents ?? 0)),
            dueDate: dueDateLabel,
            status: "overdue" as const,
            priority: "critical" as const,
            recommendedAction: "Cobrar" as const,
            onAction: () => handleCharge(item),
          };
        }
        if (status === "PAID") {
          return {
            id: String(item?.id ?? `paid-${index}`),
            client: String(item?.customer?.name ?? "Cliente"),
            value: formatCurrency(Number(item?.amountCents ?? 0)),
            dueDate: dueDateLabel,
            status: "ready" as const,
            priority: "healthy" as const,
            recommendedAction: "Registrar pagamento" as const,
            onAction: () => setMode("paid"),
          };
        }
        return {
          id: String(item?.id ?? `pending-${index}`),
          client: String(item?.customer?.name ?? "Cliente"),
          value: formatCurrency(Number(item?.amountCents ?? 0)),
          dueDate: dueDateLabel,
          status: "pending" as const,
          priority:
            dueDate && dueDate.getTime() - Date.now() <= 1000 * 60 * 60 * 24 * 2
              ? ("attention" as const)
              : ("healthy" as const),
          recommendedAction: "Lembrar" as const,
          onAction: () => handleRemind(item),
        };
      });
    return ranked;
  }, [handleCharge, handleRemind, overdueCharges, paidCharges, pendingCharges]);

  usePageDiagnostics({
    page: "finances",
    isLoading:
      showChargesInitialLoading ||
      (revenueQuery.isLoading && revenueSafe.data.length === 0),
    hasError: Boolean(
      showChargesErrorState ||
      (revenueQuery.error && revenueSafe.data.length === 0)
    ),
    isEmpty:
      !showChargesInitialLoading &&
      !showChargesErrorState &&
      charges.length === 0 &&
      !revenueQuery.isLoading,
    dataCount: charges.length,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] finances");
  }, []);

  return (
    <PageWrapper
      title="Financeiro"
      subtitle="Dinheiro em movimento: cobrança, atraso, recebimento e decisão rápida."
    >
      <OperationalTopCard
        contextLabel="Direção de receita"
        title="Fluxo cobrança → pagamento"
        description="Agora por contexto operacional: visão, pendências, urgências, histórico e análise."
        primaryAction={
          <ActionFeedbackButton
            state="idle"
            idleLabel="Criar cobrança agora"
            onClick={() => setOpenCreate(true)}
          />
        }
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
        onChange={value => setMode(value as typeof mode)}
      />

      {showChargesInitialLoading ? (
        <AppPageLoadingState description="Carregando financeiro..." />
      ) : null}
      {showChargesErrorState ? (
        <AppPageErrorState
          description={
            chargesQuery.error?.message ?? "Falha ao carregar cobranças."
          }
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
              revenueDataByPeriod={trendPeriods}
              revenueLoading={revenueQuery.isLoading}
              revenueError={revenueQuery.error?.message}
              isRevenueValid={revenueSafe.isValid}
              revenueInvalidReason={revenueSafe.reason}
              risk={{
                riskAmount: formatCurrency(overdueTotal),
                overdueCount: Number(
                  stats.overdueCount ?? overdueCharges.length
                ),
                dueToday,
                dueSoon,
              }}
              goToMode={nextMode => setMode(nextMode)}
              openCreate={() => setOpenCreate(true)}
              cobrarAgora={() => handleCharge()}
              statusDistribution={statusDistribution}
              queueItems={queueItems}
            />
          )}
          {mode === "pending" && (
            <FinancePending
              charges={pendingCharges}
              onRemind={handleRemind}
              formatCurrency={formatCurrency}
            />
          )}
          {mode === "overdue" && (
            <FinanceOverdue
              charges={overdueCharges}
              onCharge={handleCharge}
              formatCurrency={formatCurrency}
            />
          )}
          {mode === "paid" && (
            <FinancePaid
              charges={paidCharges}
              formatCurrency={formatCurrency}
            />
          )}
          {mode === "reports" && (
            <FinanceReports
              revenueData={revenueDataParsed}
              statusDistribution={statusDistribution.map(
                ({ label, value }) => ({ label, value })
              )}
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
          void Promise.all([
            chargesQuery.refetch(),
            statsQuery.refetch(),
            revenueQuery.refetch(),
          ]);
        }}
      />
    </PageWrapper>
  );
}
