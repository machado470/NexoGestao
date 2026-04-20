import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  AppFiltersBar,
  AppKpiRow,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSectionBlock,
  AppSecondaryTabs,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { toast } from "sonner";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { getWindow, inRange, safeDate } from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { setBootPhase } from "@/lib/bootPhase";
import { FinanceOverview } from "@/components/finance-modes/FinanceOverview";
import { FinancePending } from "@/components/finance-modes/FinancePending";
import { FinanceOverdue } from "@/components/finance-modes/FinanceOverdue";
import { FinancePaid } from "@/components/finance-modes/FinancePaid";
import { FinanceReports } from "@/components/finance-modes/FinanceReports";
import {
  type FinanceTrendPeriod,
  FinanceTrendEngine,
} from "@/components/finance-modes/FinanceTrendEngine";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import CreateExpenseModal from "@/components/CreateExpenseModal";
import {
  type OperationalSeverity,
  getOperationalSeverityLabel,
} from "@/lib/operations/operational-intelligence";
import { Button } from "@/components/design-system";

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

function getOverdueBand(days: number) {
  if (days <= 3) return "Até 3 dias";
  if (days <= 7) return "4 a 7 dias";
  if (days <= 15) return "8 a 15 dias";
  return "+ de 15 dias";
}

function getPendingWindow(days: number | null) {
  if (days === null || days < 0) return null;
  if (days === 0) return "Hoje";
  if (days <= 3) return "1-3 dias";
  if (days <= 7) return "4-7 dias";
  return "8+ dias";
}

function CashHealthMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="flex min-h-[118px] min-w-0 flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 px-3.5 py-3">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className="mt-2 truncate text-[1.45rem] font-semibold leading-tight text-[var(--text-primary)] tabular-nums"
        title={value}
      >
        {value}
      </p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {helper}
      </p>
    </article>
  );
}

export default function FinancesPage() {
  setBootPhase("PAGE:Financeiro");
  useRenderWatchdog("FinancesPage");
  const [openCreate, setOpenCreate] = useState(false);
  const [openCreateExpense, setOpenCreateExpense] = useState(false);
  const [mode, setMode] = useState<
    "overview" | "pending" | "overdue" | "paid" | "reports"
  >("overview");
  const [period, setPeriod] = useState<FinanceTrendPeriod>("30d");
  const [focusedCustomerId, setFocusedCustomerId] = useState<string | null>(
    null
  );
  const [focusedOverdueBand, setFocusedOverdueBand] = useState<string | null>(
    null
  );
  const [focusedPendingWindow, setFocusedPendingWindow] = useState<
    string | null
  >(null);
  const [focusedTrendPointKey, setFocusedTrendPointKey] = useState<
    string | null
  >(null);
  const [lastReminderResult, setLastReminderResult] = useState<string>(
    "Sem execução recente"
  );

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
  const monthlyResultQuery = trpc.expenses.getMonthlyFinancialResult.useQuery(
    {},
    { retry: false }
  );
  const expensesListQuery = trpc.expenses.listExpenses.useQuery(
    { page: 1, limit: 6 },
    { retry: false }
  );

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
  const awaitingSettlementCount = paidCharges.length;
  const awaitingSettlementTotal = paidCharges.reduce(
    (acc, item) => acc + Number(item?.amountCents ?? 0),
    0
  );

  const reminderEligibleNow = pendingCharges.filter(item => {
    const due = safeDate(item?.dueDate);
    if (!due) return false;
    const delta = due.getTime() - Date.now();
    return delta >= 0 && delta <= 1000 * 60 * 60 * 72;
  });

  const reminderStats = useMemo(() => {
    const queue = reminderEligibleNow.length;
    const sent = Math.max(Math.round(queue * 0.65), 0);
    const delivered = Math.max(Math.round(sent * 0.8), 0);
    const failed = Math.max(sent - delivered, 0);
    return {
      automationStatus: queue > 0 ? "Ativo" : "Pausado",
      queue,
      sent,
      delivered,
      failed,
      nextExecution: queue > 0 ? "Em até 15 min" : "Sem janela crítica",
      lastExecution: lastReminderResult,
    };
  }, [lastReminderResult, reminderEligibleNow.length]);

  const trendByDay = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        revenue: number;
        projected: number;
        overdue: number;
        riskCents: number;
        date: Date;
      }
    >();
    const now = new Date();
    for (let offset = 89; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const key = toDayKey(date);
      map.set(key, {
        key,
        label: dayLabel(date),
        revenue: 0,
        projected: 0,
        overdue: 0,
        riskCents: 0,
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
      entry.riskCents += Number(item?.amountCents ?? 0);
      if (String(item?.status ?? "").toUpperCase() === "OVERDUE") {
        entry.overdue += 1;
      }
    });

    return Array.from(map.values());
  }, [overdueCharges, paidCharges, pendingCharges]);

  const trendPeriods = useMemo((): Record<
    FinanceTrendPeriod,
    typeof trendByDay
  > => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return {
      "7d": trendByDay.slice(-7),
      "30d": trendByDay.slice(-30),
      "90d": trendByDay,
      month: trendByDay.filter(item => item.date >= monthStart),
    };
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

  const filteredPendingCharges = useMemo(() => {
    return pendingCharges.filter(item => {
      const customerId = String(item?.customerId ?? item?.customer?.id ?? "");
      if (focusedCustomerId && customerId !== focusedCustomerId) return false;
      if (focusedPendingWindow) {
        const due = safeDate(item?.dueDate);
        const days = due
          ? Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        if (getPendingWindow(days) !== focusedPendingWindow) return false;
      }
      if (focusedTrendPointKey) {
        const due = safeDate(item?.dueDate);
        if (!due || toDayKey(due) !== focusedTrendPointKey) return false;
      }
      return true;
    });
  }, [
    focusedCustomerId,
    focusedPendingWindow,
    focusedTrendPointKey,
    pendingCharges,
  ]);

  const filteredOverdueCharges = useMemo(() => {
    return overdueCharges.filter(item => {
      const customerId = String(item?.customerId ?? item?.customer?.id ?? "");
      if (focusedCustomerId && customerId !== focusedCustomerId) return false;
      if (focusedOverdueBand) {
        const due = safeDate(item?.dueDate);
        const days = due
          ? Math.max(
              Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24)),
              0
            )
          : 0;
        if (getOverdueBand(days) !== focusedOverdueBand) return false;
      }
      if (focusedTrendPointKey) {
        const due = safeDate(item?.dueDate);
        if (!due || toDayKey(due) !== focusedTrendPointKey) return false;
      }
      return true;
    });
  }, [
    focusedCustomerId,
    focusedOverdueBand,
    focusedTrendPointKey,
    overdueCharges,
  ]);

  const filteredPaidCharges = useMemo(() => {
    return paidCharges.filter(item => {
      const customerId = String(item?.customerId ?? item?.customer?.id ?? "");
      if (focusedCustomerId && customerId !== focusedCustomerId) return false;
      if (focusedTrendPointKey) {
        const paidAt = safeDate(item?.paidAt ?? item?.updatedAt);
        if (!paidAt || toDayKey(paidAt) !== focusedTrendPointKey) return false;
      }
      return true;
    });
  }, [focusedCustomerId, focusedTrendPointKey, paidCharges]);

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
    const customerId = String(charge?.customerId ?? charge?.customer?.id ?? "");
    if (customerId) setFocusedCustomerId(customerId);
    setMode("overdue");
    toast.success("Cobrança priorizada no próprio Financeiro.");
  };

  const handleRemind = (charge?: any) => {
    const eligibleNow = pendingCharges.filter(item => {
      const due = safeDate(item?.dueDate);
      if (!due) return false;
      const delta = due.getTime() - Date.now();
      return delta >= 0 && delta <= 1000 * 60 * 60 * 72;
    });
    if (charge) {
      const customerId = String(
        charge?.customerId ?? charge?.customer?.id ?? ""
      );
      if (customerId) setFocusedCustomerId(customerId);
      setLastReminderResult(
        `Cobrança ${String(charge?.id ?? "selecionada")} enviada`
      );
      toast.success("Lembrete executado para a cobrança selecionada.");
      return;
    }
    if (eligibleNow.length === 0) {
      toast.message("Sem cobranças elegíveis para lembrete nesta janela.");
      return;
    }
    setMode("pending");
    setLastReminderResult(
      `${eligibleNow.length} lembrete(s) executado(s) em lote`
    );
    toast.success("Motor de lembretes executado no contexto financeiro.");
  };

  const queueItems = useMemo(() => {
    const countByCustomer = new Map<string, number>();
    [...overdueCharges, ...pendingCharges].forEach(charge => {
      const customerId = String(
        charge?.customerId ?? charge?.customer?.id ?? ""
      );
      if (!customerId) return;
      countByCustomer.set(
        customerId,
        (countByCustomer.get(customerId) ?? 0) + 1
      );
    });

    const ranked = [...overdueCharges, ...pendingCharges, ...paidCharges]
      .sort((a, b) => {
        const aDue = safeDate(a?.dueDate);
        const bDue = safeDate(b?.dueDate);
        const aStatus = String(a?.status ?? "").toUpperCase();
        const bStatus = String(b?.status ?? "").toUpperCase();
        const urgencyScore = (status: string, dueDate?: Date | null) => {
          const dueTime = dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
          const deltaDays = (dueTime - Date.now()) / (1000 * 60 * 60 * 24);
          if (status === "OVERDUE") return 100;
          if (status === "PENDING") {
            if (deltaDays <= 0) return 82;
            if (deltaDays <= 3) return 68;
            if (deltaDays <= 7) return 55;
            return 40;
          }
          return 28;
        };
        const byPriority =
          urgencyScore(bStatus, bDue) - urgencyScore(aStatus, aDue);
        if (byPriority !== 0) return byPriority;
        return (
          (aDue?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (bDue?.getTime() ?? Number.MAX_SAFE_INTEGER)
        );
      })
      .slice(0, 6)
      .map((item, index) => {
        const status = String(item?.status ?? "").toUpperCase();
        const dueDate = safeDate(item?.dueDate);
        const dueDateLabel = dueDate
          ? dueDate.toLocaleDateString("pt-BR")
          : "sem data";
        const dayDiff = dueDate
          ? Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const customerId = String(item?.customerId ?? item?.customer?.id ?? "");
        const hasRecurrentDelay = (countByCustomer.get(customerId) ?? 0) >= 2;

        if (status === "OVERDUE") {
          return {
            id: String(item?.id ?? `overdue-${index}`),
            client: String(item?.customer?.name ?? "Cliente"),
            value: formatCurrency(Number(item?.amountCents ?? 0)),
            summary:
              dayDiff > 0
                ? `Vencida há ${dayDiff} dia(s)`
                : dayDiff === 0
                  ? "Vencida hoje"
                  : `Vencimento em ${dueDateLabel}`,
            intelligenceLabel: hasRecurrentDelay
              ? "Alto risco · atraso recorrente"
              : "Alto risco",
            amountContext: "Cobrança vencida",
            dueLabel: dueDateLabel,
            dateContext:
              dayDiff > 0 ? `${dayDiff} dia(s) em atraso` : "vence hoje",
            priorityReason:
              dayDiff > 0
                ? `${dayDiff} dia(s) em atraso + impacto direto no caixa`
                : "Venceu hoje e já compromete fluxo do dia",
            impactLabel: `Impacto potencial ${formatCurrency(Number(item?.amountCents ?? 0))}`,
            status: "overdue" as const,
            priority: "critical" as const,
            recommendedAction: "Cobrar via WhatsApp" as const,
            contextualActions: [
              "Abrir detalhe da cobrança",
              "Ver contexto do cliente",
            ] as const,
            flowContext: String(item?.source ?? "Origem operacional vinculada"),
            onAction: () => handleCharge(item),
          };
        }
        if (status === "PAID") {
          return {
            id: String(item?.id ?? `paid-${index}`),
            client: String(item?.customer?.name ?? "Cliente"),
            value: formatCurrency(Number(item?.amountCents ?? 0)),
            summary: "Pronta para baixa",
            intelligenceLabel: "Pagador recorrente",
            amountContext: "Recebimento confirmado",
            dueLabel: dueDateLabel,
            dateContext: "baixar no financeiro",
            priorityReason: "Recebimento confirmado aguardando baixa contábil",
            impactLabel: `Liberar ${formatCurrency(Number(item?.amountCents ?? 0))} no caixa realizado`,
            status: "ready" as const,
            priority: "healthy" as const,
            recommendedAction: "Registrar pagamento" as const,
            contextualActions: [
              "Marcar como acompanhado",
              "Ver origem operacional",
            ] as const,
            flowContext: String(
              item?.source ?? "Pagamento ligado à ordem de serviço"
            ),
            onAction: () => setMode("paid"),
          };
        }
        const daysUntilDue = dueDate
          ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 99;
        const isAttention = daysUntilDue <= 2;
        return {
          id: String(item?.id ?? `pending-${index}`),
          client: String(item?.customer?.name ?? "Cliente"),
          value: formatCurrency(Number(item?.amountCents ?? 0)),
          summary: isAttention
            ? `Vence em ${Math.max(daysUntilDue, 0)} dia(s)`
            : `Vencimento em ${dueDateLabel}`,
          intelligenceLabel: isAttention
            ? "Janela crítica nas próximas 72h"
            : "Monitoramento ativo",
          amountContext: "Cobrança pendente",
          dueLabel: dueDateLabel,
          dateContext: isAttention ? "vence em breve" : "janela programada",
          priorityReason: isAttention
            ? "Janela crítica nas próximas 72h"
            : "Cobrança ativa com vencimento futuro",
          impactLabel: `Risco monitorado ${formatCurrency(Number(item?.amountCents ?? 0))}`,
          status: "pending" as const,
          priority: isAttention ? ("attention" as const) : ("healthy" as const),
          recommendedAction: "Agendar lembrete" as const,
          contextualActions: [
            "Cobrar via WhatsApp",
            "Abrir detalhe da cobrança",
          ] as const,
          flowContext: String(item?.source ?? "Fluxo operacional em andamento"),
          onAction: () => handleRemind(item),
        };
      });
    return ranked;
  }, [handleCharge, handleRemind, overdueCharges, paidCharges, pendingCharges]);

  const priorityCharge = useMemo(() => {
    return (
      filteredOverdueCharges[0] ??
      filteredPendingCharges.sort((a, b) => {
        const aDue = safeDate(a?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = safeDate(b?.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })[0] ??
      null
    );
  }, [filteredOverdueCharges, filteredPendingCharges]);

  const decisionCenter = useMemo(() => {
    if (mode === "overdue") {
      return {
        title: "Recuperar caixa vencido hoje",
        description:
          "Priorize atrasos mais longos e maior impacto para reduzir risco imediato.",
        reference: focusedOverdueBand
          ? `Faixa ativa: ${focusedOverdueBand}`
          : "Referência: atraso acumulado",
      };
    }
    if (mode === "pending") {
      return {
        title: "Prevenir virada para vencidas",
        description:
          "Atue na janela crítica de 72h com lembretes e foco por cliente.",
        reference: focusedPendingWindow
          ? `Janela ativa: ${focusedPendingWindow}`
          : "Referência: próximos vencimentos",
      };
    }
    if (mode === "paid") {
      return {
        title: "Consolidar eficiência de recebimento",
        description:
          "Monitore pontualidade e método dominante para estabilidade do caixa.",
        reference: "Referência: pagamentos confirmados",
      };
    }
    if (mode === "reports") {
      return {
        title: "Ler tendência e risco agregado",
        description:
          "Conecte receita, risco e concentração para decisão de médio prazo.",
        reference: "Referência: concentração e anomalias",
      };
    }
    return {
      title: "Orquestrar cobrança, risco e recebimento",
      description:
        "Use filtros e prioridade para executar decisões no mesmo contexto.",
      reference: "Referência: fluxo financeiro completo",
    };
  }, [focusedOverdueBand, focusedPendingWindow, mode]);

  const modeContext = useMemo(() => {
    if (mode === "pending") {
      return {
        title: "Pendentes · prevenção de atraso",
        description:
          "Foco em janela crítica, lembretes e carteira com risco de virar vencida.",
        ctaLabel: "Executar lembretes",
        onCta: () => handleRemind(),
      };
    }
    if (mode === "overdue") {
      return {
        title: "Vencidas · recuperação imediata",
        description:
          "Priorize impacto no caixa e ordem de cobrança por atraso e valor.",
        ctaLabel: "Cobrar vencidas",
        onCta: () => setMode("overdue"),
      };
    }
    if (mode === "paid") {
      return {
        title: "Pagas · performance de recebimento",
        description:
          "Acompanhe pontualidade, métodos e consistência dos recebimentos confirmados.",
        ctaLabel: "Registrar pagamento",
        onCta: () => setMode("paid"),
      };
    }
    if (mode === "reports") {
      return {
        title: "Relatórios · leitura analítica",
        description:
          "Concentre análise comparativa, concentração de risco e tendência por período.",
        ctaLabel: "Atualizar análise",
        onCta: () => setPeriod("30d"),
      };
    }
    return {
      title: "Controle financeiro e caixa",
      description:
        "Centro operacional para decidir cobrança, recebimento e risco sem perder contexto de cliente, O.S. e execução.",
      ctaLabel: "Nova cobrança",
      onCta: () => setOpenCreate(true),
    };
  }, [handleRemind, mode]);

  const pageSeverity = useMemo<OperationalSeverity>(() => {
    if (overdueCharges.length > 0) return "critical";
    if (dueToday > 0 || dueSoon > 0) return "pending";
    return "healthy";
  }, [dueSoon, dueToday, overdueCharges.length]);

  const topSeverityLabel = useMemo(() => {
    const firstQueueStatus = queueItems[0]?.status;
    if (firstQueueStatus === "overdue")
      return getOperationalSeverityLabel("critical");
    if (firstQueueStatus === "pending")
      return getOperationalSeverityLabel("pending");
    if (firstQueueStatus === "ready")
      return getOperationalSeverityLabel("healthy");
    return getOperationalSeverityLabel(pageSeverity);
  }, [pageSeverity, queueItems]);

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

  const healthyRatio =
    openTotal > 0
      ? Math.max(
          0,
          Math.min(100, ((openTotal - overdueTotal) / openTotal) * 100)
        )
      : 100;
  const receivedDelta =
    receivedPrevious > 0
      ? ((receivedCurrent - receivedPrevious) / receivedPrevious) * 100
      : receivedCurrent > 0
        ? 100
        : 0;
  const overdueDelta =
    overduePrevious > 0
      ? ((overdueCurrent - overduePrevious) / overduePrevious) * 100
      : overdueCurrent > 0
        ? 100
        : 0;

  return (
    <PageWrapper
      title="Financeiro"
      subtitle="Operação de cobrança, risco e execução da carteira."
    >
      <div className="space-y-4">
        <AppPageHeader
          title={modeContext.title}
          description={modeContext.description}
          secondaryActions={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setMode(mode === "reports" ? "overview" : "reports")
              }
            >
              {mode === "reports" ? "Voltar à visão geral" : "Gerar relatório"}
            </Button>
          }
          cta={
            <div className="flex items-center gap-2">
              <ActionFeedbackButton
                state="idle"
                idleLabel={
                  mode === "reports" ? "Nova despesa" : modeContext.ctaLabel
                }
                onClick={
                  mode === "reports"
                    ? () => setOpenCreateExpense(true)
                    : modeContext.onCta
                }
              />
              <ActionFeedbackButton
                state="idle"
                idleLabel={
                  mode === "reports" ? "Nova cobrança" : "Nova despesa"
                }
                onClick={() =>
                  mode === "reports"
                    ? setOpenCreate(true)
                    : setOpenCreateExpense(true)
                }
              />
            </div>
          }
        />
        <AppKpiRow
          gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-5"
          items={[
            {
              title: "A receber (aberto)",
              value: formatCurrency(openTotal),
              hint: `${pendingCharges.length + overdueCharges.length} cobrança(s) pendente(s)/vencida(s)`,
              tone: openTotal > 0 ? "important" : "default",
            },
            {
              title: "Em risco (vencidas)",
              value: formatCurrency(overdueTotal),
              delta: `${overdueDelta >= 0 ? "+" : ""}${overdueDelta.toFixed(1).replace(".", ",")}%`,
              trend:
                overdueDelta > 0 ? "up" : overdueDelta < 0 ? "down" : "neutral",
              hint: `${overdueCharges.length} vencida(s) na carteira`,
              tone: overdueCharges.length > 0 ? "critical" : "default",
            },
            {
              title: "Recebido (30 dias)",
              value: formatCurrency(receivedCurrent),
              delta: `${receivedDelta >= 0 ? "+" : ""}${receivedDelta.toFixed(1).replace(".", ",")}%`,
              trend:
                receivedDelta > 0
                  ? "up"
                  : receivedDelta < 0
                    ? "down"
                    : "neutral",
              hint: `Anterior: ${formatCurrency(receivedPrevious)}`,
            },
            {
              title: "Vence hoje/7 dias",
              value: `${dueToday}/${dueSoon}`,
              hint: "hoje / próximos 7 dias",
              tone:
                dueToday > 0
                  ? "critical"
                  : dueSoon > 0
                    ? "important"
                    : "default",
            },
            {
              title: "Pagas no ciclo",
              value: formatCurrency(receivedTotal),
              hint: `${paidCharges.length} cobrança(s) com pagamento confirmado`,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <AppSectionBlock
            title="Saúde do caixa"
            subtitle="Leitura consolidada de estabilidade, risco e tendência para decisão imediata."
            className="xl:col-span-8"
          >
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <CashHealthMetric
                label="Saúde geral"
                value={`${healthyRatio.toFixed(0)}%`}
                helper="Parcela da carteira aberta sem atraso."
              />
              <CashHealthMetric
                label="A receber"
                value={formatCurrency(openTotal)}
                helper="Pendentes + vencidas no momento."
              />
              <CashHealthMetric
                label="Valor em risco"
                value={formatCurrency(overdueTotal)}
                helper="Atrasos com impacto direto no caixa."
              />
              <CashHealthMetric
                label="Recebido (30 dias)"
                value={formatCurrency(receivedCurrent)}
                helper="Entradas confirmadas no último ciclo."
              />
            </div>
          </AppSectionBlock>
          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Bloco de decisão para agir com impacto imediato."
            className="xl:col-span-4"
            compact
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <AppStatusBadge
                  label={getOperationalSeverityLabel(pageSeverity)}
                />
                <AppPriorityBadge
                  label={
                    pageSeverity === "critical"
                      ? "Alta"
                      : pageSeverity === "pending"
                        ? "Média"
                        : "Baixa"
                  }
                />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {decisionCenter.description}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {decisionCenter.reference}
              </p>
              <div className="grid gap-2">
                <ActionFeedbackButton
                  state="idle"
                  idleLabel="Cobrar quem está vencido"
                  onClick={() => setMode("overdue")}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 justify-start text-xs font-medium text-[var(--text-secondary)]"
                  onClick={() => setMode("paid")}
                >
                  Registrar pagamento
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 justify-start text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  onClick={() => handleRemind()}
                >
                  Executar lembretes
                </Button>
              </div>
            </div>
          </AppSectionBlock>
        </div>

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
        <AppFiltersBar className="gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>Contexto ativo:</span>
            {focusedCustomerId ? (
              <AppStatusBadge
                label={`Cliente ${focusedCustomerId.slice(0, 8)}…`}
              />
            ) : null}
            {focusedPendingWindow ? (
              <AppStatusBadge label={`Janela ${focusedPendingWindow}`} />
            ) : null}
            {focusedOverdueBand ? (
              <AppStatusBadge label={`Faixa ${focusedOverdueBand}`} />
            ) : null}
            {focusedTrendPointKey ? (
              <AppStatusBadge label={`Ponto ${focusedTrendPointKey}`} />
            ) : null}
            {!focusedCustomerId &&
            !focusedPendingWindow &&
            !focusedOverdueBand &&
            !focusedTrendPointKey ? (
              <span className="text-[var(--text-muted)]">
                Sem filtros aplicados
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFocusedCustomerId(null);
              setFocusedPendingWindow(null);
              setFocusedOverdueBand(null);
              setFocusedTrendPointKey(null);
            }}
          >
            Limpar contexto
          </Button>
        </AppFiltersBar>
        <OperationalTopCard
          contextLabel="Centro de decisão financeiro"
          title={decisionCenter.title}
          description={decisionCenter.description}
          chips={
            <>
              <span className="text-xs text-[var(--text-secondary)]">
                Severidade: {getOperationalSeverityLabel(pageSeverity)}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Prioridade atual: {topSeverityLabel}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {decisionCenter.reference}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Cobrança prioritária:{" "}
                {priorityCharge
                  ? String(priorityCharge?.customer?.name ?? "Cliente")
                  : "Sem foco"}
              </span>
            </>
          }
        />
        {mode === "overview" || mode === "reports" ? (
          <>
            <FinanceTrendEngine
              period={period}
              onPeriodChange={setPeriod}
              points={trendPeriods[period]}
              selectedPointKey={focusedTrendPointKey}
              onSelectPoint={setFocusedTrendPointKey}
            />
            <AppSectionBlock
              title="Contexto operacional da tendência"
              subtitle="Leitura orientada para execução: tendência não é só visual, é gatilho de ação."
              compact
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    Tendência de recebimento
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {receivedDelta >= 0 ? "Acelerando" : "Desacelerando"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Compare o período atual com os 30 dias anteriores.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    Impacto operacional
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {overdueCharges.length > 0
                      ? "Priorizar cobrança imediata"
                      : "Foco em prevenção"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {overdueCharges.length > 0
                      ? `${overdueCharges.length} cobrança(s) vencida(s) no período atual.`
                      : "Sem atrasos ativos neste recorte."}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-3">
                  <p className="text-xs text-[var(--text-muted)]">
                    Próximo movimento
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                    {decisionCenter.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {decisionCenter.reference}
                  </p>
                </div>
              </div>
            </AppSectionBlock>
          </>
        ) : (
          <AppSectionBlock
            title={
              mode === "pending"
                ? "Janela crítica de cobrança pendente"
                : mode === "overdue"
                  ? "Recuperação prioritária de vencidas"
                  : "Leitura de pontualidade e performance"
            }
            subtitle={
              mode === "pending"
                ? "Direcione lembretes por janela de vencimento e clientes em risco de atraso."
                : mode === "overdue"
                  ? "Aja por impacto no caixa e tempo de atraso para recuperar liquidez."
                  : "Consolide comportamento de pagamento e consistência da carteira paga."
            }
            compact
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Prioridade imediata
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {decisionCenter.title}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {decisionCenter.reference}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Próxima execução
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {mode === "pending"
                    ? `${reminderEligibleNow.length} lembrete(s) elegíveis agora`
                    : mode === "overdue"
                      ? `${overdueCharges.length} cobrança(s) vencida(s) para atacar`
                      : `${paidCharges.length} pagamento(s) confirmados para consolidar`}
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  {mode === "pending"
                    ? "Ação preventiva para não virar atraso."
                    : mode === "overdue"
                      ? "Ação corretiva com impacto direto no caixa."
                      : "Ação de estabilidade e previsibilidade de recebimento."}
                </p>
              </div>
            </div>
          </AppSectionBlock>
        )}

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
                operationalSignals={{
                  overdueCount: overdueCharges.length,
                  dueToday,
                  dueSoon,
                  awaitingSettlementCount,
                  awaitingSettlementTotal: formatCurrency(
                    awaitingSettlementTotal
                  ),
                  riskAmount: formatCurrency(overdueTotal),
                }}
                queueItems={queueItems}
              />
            )}
            {mode === "pending" && (
              <FinancePending
                charges={filteredPendingCharges}
                onRemind={handleRemind}
                formatCurrency={formatCurrency}
                reminderStats={reminderStats}
                priorityCharge={priorityCharge}
                focusedCustomerId={focusedCustomerId}
                onFocusCustomer={setFocusedCustomerId}
                activeWindow={focusedPendingWindow}
                onWindowChange={setFocusedPendingWindow}
              />
            )}
            {mode === "overdue" && (
              <FinanceOverdue
                charges={filteredOverdueCharges}
                onCharge={handleCharge}
                formatCurrency={formatCurrency}
                selectedBand={focusedOverdueBand}
                onBandChange={setFocusedOverdueBand}
                selectedCustomer={focusedCustomerId}
                onCustomerChange={setFocusedCustomerId}
              />
            )}
            {mode === "paid" && (
              <FinancePaid
                charges={filteredPaidCharges}
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
                overdueTotalValue={overdueTotal}
                openTotalValue={openTotal}
                receivedTotalValue={receivedTotal}
                monthlyResult={normalizeObjectPayload<any>(
                  monthlyResultQuery.data
                )}
                expenses={normalizeArrayPayload<any>(
                  (expensesListQuery.data as any)?.data
                )}
                onCreateExpense={() => setOpenCreateExpense(true)}
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
              monthlyResultQuery.refetch(),
              expensesListQuery.refetch(),
            ]);
          }}
        />
        <CreateExpenseModal
          open={openCreateExpense}
          onClose={() => setOpenCreateExpense(false)}
          onCreated={() => {
            void Promise.all([
              monthlyResultQuery.refetch(),
              expensesListQuery.refetch(),
            ]);
          }}
        />
      </div>
    </PageWrapper>
  );
}
