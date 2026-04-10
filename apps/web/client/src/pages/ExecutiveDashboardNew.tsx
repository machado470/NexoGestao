import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { OperationalActionFeed } from "@/components/operations/OperationalActionFeed";
import { AlertStrip } from "@/components/operating-system/AlertStrip";
import { ActionFeed } from "@/components/operating-system/ActionFeed";
import { PipelineStage } from "@/components/operating-system/PipelineStage";
import { PrimaryActionButton } from "@/components/operating-system/PrimaryActionButton";
import { getLatestActionFlowSuggestion } from "@/lib/actionFlow";
import { buildDashboardExecutionPlan } from "@/lib/execution/decision-engine";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import {
  buildCrossEntitySignals,
  buildDecisionLog,
  evaluateSafetyLimits,
  mapBackendModeToOperationMode,
  resolveModeForAction,
  type ActionType,
  type OperationMode,
} from "@/lib/operations/automation-control";
import { rankPriorityProblems } from "@/lib/priorityEngine";
import {
  AlertTriangle,
  Bot,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function normalizeKeyLabel(key: string) {
  const normalized = String(key ?? "").trim();

  const labels: Record<string, string> = {
    OPEN: "Abertas",
    ASSIGNED: "Atribuídas",
    IN_PROGRESS: "Em andamento",
    DONE: "Concluídas",
    CANCELED: "Canceladas",
    CANCELLED: "Canceladas",
    PENDING: "Pendentes",
    PAID: "Pagas",
    OVERDUE: "Vencidas",
    open: "Abertas",
    assigned: "Atribuídas",
    inProgress: "Em andamento",
    completed: "Concluídas",
    cancelled: "Canceladas",
    canceled: "Canceladas",
    pending: "Pendentes",
    paid: "Pagas",
    overdue: "Vencidas",
  };

  return labels[normalized] ?? (normalized || "Sem rótulo");
}

type MetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  description?: string;
  loading?: boolean;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  loading,
}: MetricCardProps) {
  return (
    <div className="nexo-card-kpi nexo-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="nexo-text-wrap text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] dark:text-[var(--text-muted)]">
            {label}
          </p>
          <div className="relative mt-3 min-h-10 text-5xl font-black tracking-tight text-zinc-950 dark:text-white">
            {loading ? (
              <div className="nexo-skeleton h-10 w-24 rounded-lg" />
            ) : (
              value
            )}
          </div>
          {description ? (
            <p className="nexo-text-wrap mt-2 min-h-4 text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
              {loading ? (
                <span className="nexo-skeleton inline-block h-4 w-44 rounded" />
              ) : (
                description
              )}
            </p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function OperationalHealthView({
  criticalPending,
  overdueItems,
  bottlenecks,
  urgentActions,
}: {
  criticalPending: number;
  overdueItems: number;
  bottlenecks: number;
  urgentActions: number;
}) {
  return (
    <section className="nexo-card-operational nexo-cockpit-zone">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Operational health
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-red-300/60 bg-red-50/60 p-2 text-xs font-medium">
          Críticas: <strong className="text-sm">{criticalPending}</strong>
        </div>
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-2 text-xs font-medium">
          Atrasadas: <strong className="text-sm">{overdueItems}</strong>
        </div>
        <div className="rounded-lg border border-violet-300/60 bg-violet-50/60 p-2 text-xs font-medium">
          Gargalos: <strong className="text-sm">{bottlenecks}</strong>
        </div>
        <div className="rounded-lg border border-orange-300/60 bg-orange-50/60 p-2 text-xs font-medium">
          Urgentes: <strong className="text-sm">{urgentActions}</strong>
        </div>
      </div>
    </section>
  );
}

function DashboardCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`nexo-skeleton-panel ${className}`}>
      <div className="nexo-skeleton h-5 w-56 rounded" />
      <div className="mt-2 nexo-skeleton h-4 w-72 rounded" />
      <div className="mt-4 space-y-3">
        <div className="nexo-skeleton h-10 w-full rounded-xl" />
        <div className="nexo-skeleton h-10 w-[92%] rounded-xl" />
        <div className="nexo-skeleton h-10 w-[86%] rounded-xl" />
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? ""
    ).trim();
    if (message) return message;
  }

  return "Erro ao carregar bloco.";
}

function normalizeMetrics(payload: unknown) {
  const raw =
    (payload as any)?.data?.data ?? (payload as any)?.data ?? payload ?? {};

  return {
    totalCustomers: Number((raw as any)?.totalCustomers ?? 0),
    createdCustomers: Number((raw as any)?.createdCustomers ?? 0),
    totalServiceOrders: Number((raw as any)?.totalServiceOrders ?? 0),
    openServiceOrders: Number(
      (raw as any)?.openServiceOrders ?? (raw as any)?.openOrders ?? 0
    ),
    inProgressOrders: Number(
      (raw as any)?.inProgressOrders ??
        (raw as any)?.inProgressServiceOrders ??
        0
    ),
    totalRevenueInCents: Number((raw as any)?.totalRevenueInCents ?? 0),
    paidRevenueInCents: Number((raw as any)?.paidRevenueInCents ?? 0),
    pendingPaymentsInCents: Number(
      (raw as any)?.pendingPaymentsInCents ??
        (raw as any)?.pendingRevenueInCents ??
        0
    ),
    weeklyRevenueInCents: Number((raw as any)?.weeklyRevenueInCents ?? 0),
    completedOrders: Number(
      (raw as any)?.completedOrders ?? (raw as any)?.doneServiceOrders ?? 0
    ),
    completedServices: Number(
      (raw as any)?.completedServices ?? (raw as any)?.completedOrders ?? 0
    ),
    chargesGenerated: Number((raw as any)?.chargesGenerated ?? 0),
    riskTickets: Number((raw as any)?.riskTickets ?? 0),
    delayedOrders: Number((raw as any)?.delayedOrders ?? 0),
  };
}

function normalizeSeriesArray(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw;
  }

  if (Array.isArray((raw as any)?.items)) {
    return (raw as any).items;
  }

  if (Array.isArray((raw as any)?.data)) {
    return (raw as any).data;
  }

  return [];
}

function normalizeStatusCollection(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw
      .map((item: any, index: number) => {
        const key =
          String(
            item?.key ??
              item?.status ??
              item?.name ??
              item?.label ??
              `item_${index}`
          ).trim() || `item_${index}`;

        const value = Number(
          item?.value ?? item?.count ?? item?.total ?? item?.amount ?? 0
        );

        return {
          key,
          label: normalizeKeyLabel(key),
          value,
        };
      })
      .filter(item => item.key);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(
      ([key, value]) => ({
        key,
        label: normalizeKeyLabel(key),
        value: Number(value ?? 0),
      })
    );
  }

  return [];
}

export default function ExecutiveDashboardNew() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [location, navigate] = useLocation();
  const canQuery = isAuthenticated && !isInitializing;

  const queryOptions = useMemo(
    () => ({
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }),
    [canQuery]
  );

  const metricsQuery = trpc.dashboard.kpis.useQuery(undefined, queryOptions);
  const revenueQuery = trpc.dashboard.revenueTrend.useQuery(
    undefined,
    queryOptions
  );
  const serviceOrdersStatusQuery = trpc.dashboard.serviceOrdersStatus.useQuery(
    undefined,
    queryOptions
  );
  const chargesStatusQuery = trpc.dashboard.chargeDistribution.useQuery(
    undefined,
    queryOptions
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    undefined,
    queryOptions
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    queryOptions
  );
  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 100 },
    queryOptions
  );
  const billingLimitsQuery = trpc.billing.limits.useQuery(
    undefined,
    queryOptions
  );
  const governanceSummaryQuery = trpc.governance.summary.useQuery(
    undefined,
    queryOptions
  );
  const executionModeQuery = trpc.nexo.executions.mode.useQuery(
    undefined,
    queryOptions
  );
  const { logs } = useExecutionMemory();
  const executionMode = String(
    (executionModeQuery.data as any)?.mode ?? "manual"
  );
  const orgOperationMode = useMemo<OperationMode>(
    () => mapBackendModeToOperationMode(executionMode),
    [executionMode]
  );
  const [userOperationMode, setUserOperationMode] = useState<
    OperationMode | undefined
  >(undefined);
  const [actionTypeOverrides, setActionTypeOverrides] = useState<
    Partial<Record<ActionType, OperationMode>>
  >({});
  const [focusCriticalOnly, setFocusCriticalOnly] = useState(true);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [optimisticTick, setOptimisticTick] = useState(false);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<
    string | null
  >(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stableMetrics, setStableMetrics] = useState(() =>
    normalizeMetrics(undefined)
  );
  const [stableRevenue, setStableRevenue] = useState<any[]>([]);
  const [stableServiceOrdersStatus, setStableServiceOrdersStatus] = useState<
    any[]
  >([]);
  const [stableChargesStatus, setStableChargesStatus] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("nexo.operation.mode.user.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        userMode?: OperationMode;
        actionTypeOverrides?: Partial<Record<ActionType, OperationMode>>;
        focusCriticalOnly?: boolean;
      };
      setUserOperationMode(parsed.userMode);
      setActionTypeOverrides(parsed.actionTypeOverrides ?? {});
      setFocusCriticalOnly(parsed.focusCriticalOnly ?? true);
    } catch {
      setUserOperationMode(undefined);
      setActionTypeOverrides({});
      setFocusCriticalOnly(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "nexo.operation.mode.user.v1",
      JSON.stringify({
        userMode: userOperationMode,
        actionTypeOverrides,
        focusCriticalOnly,
      })
    );
  }, [actionTypeOverrides, focusCriticalOnly, userOperationMode]);

  const metrics = useMemo(
    () => normalizeMetrics(metricsQuery.data),
    [metricsQuery.data]
  );
  const revenue = useMemo(
    () => normalizeSeriesArray(revenueQuery.data),
    [revenueQuery.data]
  );
  const serviceOrdersStatus = useMemo(
    () => normalizeStatusCollection(serviceOrdersStatusQuery.data),
    [serviceOrdersStatusQuery.data]
  );
  const chargesStatus = useMemo(
    () => normalizeStatusCollection(chargesStatusQuery.data),
    [chargesStatusQuery.data]
  );

  useEffect(() => {
    if (metricsQuery.data !== undefined) {
      setStableMetrics(metrics);
      setLastUpdatedAt(new Date());
    }
  }, [metrics, metricsQuery.data]);

  useEffect(() => {
    if (revenueQuery.data !== undefined) {
      setStableRevenue(revenue);
      setLastUpdatedAt(new Date());
    }
  }, [revenue, revenueQuery.data]);

  useEffect(() => {
    if (serviceOrdersStatusQuery.data !== undefined) {
      setStableServiceOrdersStatus(serviceOrdersStatus);
      setLastUpdatedAt(new Date());
    }
  }, [serviceOrdersStatus, serviceOrdersStatusQuery.data]);

  useEffect(() => {
    if (chargesStatusQuery.data !== undefined) {
      setStableChargesStatus(chargesStatus);
      setLastUpdatedAt(new Date());
    }
  }, [chargesStatus, chargesStatusQuery.data]);

  const displayMetrics =
    metricsQuery.data !== undefined ? metrics : stableMetrics;
  const displayRevenue =
    revenueQuery.data !== undefined ? revenue : stableRevenue;
  const displayServiceOrdersStatus =
    serviceOrdersStatusQuery.data !== undefined
      ? serviceOrdersStatus
      : stableServiceOrdersStatus;
  const displayChargesStatus =
    chargesStatusQuery.data !== undefined ? chargesStatus : stableChargesStatus;

  const riskOperationalState = useMemo(() => {
    const payload =
      (governanceSummaryQuery.data as any)?.data ??
      governanceSummaryQuery.data ??
      {};
    const state = String(
      payload?.operationalState ??
        payload?.riskState ??
        payload?.state ??
        "UNKNOWN"
    ).toUpperCase();

    if (
      state === "SUSPENDED" ||
      state === "RESTRICTED" ||
      state === "WARNING" ||
      state === "NORMAL"
    ) {
      return state as "SUSPENDED" | "RESTRICTED" | "WARNING" | "NORMAL";
    }

    return "UNKNOWN" as const;
  }, [governanceSummaryQuery.data]);

  const quotaWarnings = useMemo(() => {
    const usage = (billingLimitsQuery.data as any)?.usage;
    if (!usage || typeof usage !== "object") return [];

    return Object.entries(usage)
      .filter(([, value]: any) => {
        if (value?.unlimited) return false;
        const used = Number(value?.used ?? 0);
        const limit = Number(value?.limit ?? 0);
        return Number.isFinite(limit) && limit > 0 && used >= limit;
      })
      .map(([key]) => key);
  }, [billingLimitsQuery.data]);

  const lineChartData = useMemo(
    () =>
      displayRevenue.map((item: any, index: number) => ({
        period: item?.month ?? item?.date ?? `P${index + 1}`,
        value: Number(item?.revenue ?? item?.amount ?? 0),
      })),
    [displayRevenue]
  );

  const paidCharges =
    displayChargesStatus.find(item => item.key.toLowerCase() === "paid")
      ?.value ?? 0;
  const funnelData = [
    { value: Math.max(displayMetrics.totalCustomers, 0), name: "Clientes" },
    {
      value: Math.max(
        displayMetrics.totalServiceOrders + displayMetrics.openServiceOrders,
        0
      ),
      name: "Agendamentos",
    },
    { value: Math.max(displayMetrics.totalServiceOrders, 0), name: "O.S." },
    { value: Math.max(paidCharges, 0), name: "Pagamentos" },
  ];

  const totalPausedRevenue = Math.max(
    displayMetrics.pendingPaymentsInCents ?? 0,
    0
  );
  const overdueCharges =
    displayChargesStatus.find(item => item.key.toLowerCase() === "overdue")
      ?.value ?? 0;
  const averageOrderValueCents =
    displayMetrics.totalServiceOrders > 0
      ? Math.round(
          displayMetrics.totalRevenueInCents /
            Math.max(displayMetrics.totalServiceOrders, 1)
        )
      : 0;
  const nonBilledServices = Math.max(displayMetrics.openServiceOrders, 0);
  const nonBilledServicesImpact = Math.max(
    nonBilledServices * averageOrderValueCents,
    0
  );
  const overdueImpactCents = Math.max(
    overdueCharges *
      Math.max(
        averageOrderValueCents,
        Math.round(
          (displayMetrics.pendingPaymentsInCents || 0) /
            Math.max(overdueCharges || 1, 1)
        )
      ),
    0
  );
  const operationalRiskItems = Math.max(
    Number(displayMetrics.riskTickets) + Number(displayMetrics.delayedOrders),
    0
  );
  const operationalRiskImpact = Math.round(
    operationalRiskItems * Math.max(averageOrderValueCents, 0) * 0.4
  );

  const priorityProblems = rankPriorityProblems([
    {
      id: "idle-cash",
      type: "idle_cash",
      title: "Dinheiro parado",
      count: Math.max(overdueCharges + nonBilledServices, 0),
      impactCents: totalPausedRevenue + nonBilledServicesImpact,
      ctaLabel: "Recuperar receita agora",
      ctaPath: "/finances",
      helperText: `${formatCurrency(totalPausedRevenue + nonBilledServicesImpact)} aguardando ação.`,
    },
    {
      id: "overdue",
      type: "overdue_charges",
      title: "Cobranças vencidas",
      count: overdueCharges,
      impactCents: overdueImpactCents,
      ctaLabel: "Cobrar vencidas",
      ctaPath: "/finances",
      helperText: `${formatCurrency(overdueImpactCents)} pendente de recebimento.`,
    },
    {
      id: "stalled-os",
      type: "stalled_service_orders",
      title: "O.S. paradas",
      count: Math.max(displayMetrics.delayedOrders, 0),
      impactCents:
        Math.max(displayMetrics.delayedOrders, 0) *
        Math.max(averageOrderValueCents, 0),
      ctaLabel: "Destravar O.S.",
      ctaPath: "/service-orders",
      helperText: "Execução travada impactando faturamento.",
    },
    {
      id: "operational-risk",
      type: "operational_risk",
      title: "Risco operacional",
      count: operationalRiskItems,
      impactCents: operationalRiskImpact,
      ctaLabel: "Corrigir riscos",
      ctaPath: "/service-orders",
      helperText: `${formatCurrency(operationalRiskImpact)} em risco se não agir hoje.`,
    },
  ]);
  const dominantProblem = priorityProblems[0];
  const heroState =
    overdueCharges > 0 || displayMetrics.delayedOrders > 0
      ? "Operação requer intervenção imediata"
      : "Operação estável e em ritmo controlado";
  const heroStateTone =
    overdueCharges > 0 || displayMetrics.delayedOrders > 0
      ? "text-red-700 dark:text-red-300"
      : "text-emerald-700 dark:text-emerald-300";
  const actionFlowSuggestion = getLatestActionFlowSuggestion();
  const todayAppointments = useMemo(() => {
    const raw =
      (appointmentsQuery.data as any)?.data ?? appointmentsQuery.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    const today = new Date().toDateString();
    return list.filter((item: any) => {
      const startsAt = item?.startsAt ? new Date(item.startsAt) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) return false;
      const status = String(item?.status ?? "").toUpperCase();
      return (
        startsAt.toDateString() === today &&
        (status === "SCHEDULED" || status === "CONFIRMED")
      );
    }).length;
  }, [appointmentsQuery.data]);

  const doneWithoutChargeCandidate = useMemo(() => {
    const serviceOrdersRaw = (serviceOrdersQuery.data as any)?.data ?? [];
    const serviceOrders = Array.isArray(serviceOrdersRaw)
      ? serviceOrdersRaw
      : [];
    return (
      serviceOrders.find((item: any) => {
        const status = String(item?.status ?? "").toUpperCase();
        return status === "DONE" && !item?.financialSummary?.hasCharge;
      }) ?? null
    );
  }, [serviceOrdersQuery.data]);

  const overdueChargeCandidate = useMemo(() => {
    const chargesRaw = (chargesQuery.data as any)?.data ?? [];
    const charges = Array.isArray(chargesRaw) ? chargesRaw : [];
    return (
      charges
        .filter(
          (item: any) => String(item?.status ?? "").toUpperCase() === "OVERDUE"
        )
        .sort(
          (a: any, b: any) =>
            Number(b?.amountCents ?? 0) - Number(a?.amountCents ?? 0)
        )[0] ?? null
    );
  }, [chargesQuery.data]);

  const daysOverdue = overdueChargeCandidate?.dueDate
    ? Math.floor(
        (Date.now() - new Date(overdueChargeCandidate.dueDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const executionPlan = useMemo(() => {
    return buildDashboardExecutionPlan({
      totalCustomers: displayMetrics.totalCustomers,
      totalServiceOrders: displayMetrics.totalServiceOrders,
      completedOrders: displayMetrics.completedOrders,
      chargesGenerated: displayMetrics.chargesGenerated,
      overdueCharges,
      todayAppointments,
      hasWhatsappContext: location.includes("customerId="),
      doneWithoutChargeCandidate: doneWithoutChargeCandidate
        ? {
            serviceOrderId: String(doneWithoutChargeCandidate.id),
            customerName: String(
              doneWithoutChargeCandidate?.customer?.name ?? ""
            ),
            amountCents: Number(doneWithoutChargeCandidate?.amountCents ?? 0),
          }
        : null,
      overdueChargeCandidate: overdueChargeCandidate
        ? {
            chargeId: String(overdueChargeCandidate.id),
            customerId: String(overdueChargeCandidate.customerId ?? ""),
            customerName: String(overdueChargeCandidate?.customer?.name ?? ""),
            amountCents: Number(overdueChargeCandidate.amountCents ?? 0),
            dueDate: String(overdueChargeCandidate.dueDate ?? ""),
            daysOverdue,
          }
        : null,
      executionLogs: logs,
    });
  }, [
    displayMetrics.chargesGenerated,
    displayMetrics.completedOrders,
    displayMetrics.totalCustomers,
    displayMetrics.totalServiceOrders,
    doneWithoutChargeCandidate,
    overdueChargeCandidate,
    daysOverdue,
    logs,
    location,
    overdueCharges,
    todayAppointments,
  ]);

  const operationalActionFeed = useMemo(() => {
    const actions: Array<{
      id: string;
      entity: string;
      reason: string;
      priority: "critical" | "warning" | "normal" | "success";
      nextAction: string;
      onExecute: () => void;
      amountLabel?: string;
      group?: "financeiro" | "operacional" | "atendimento";
      impactScore?: number;
      urgencyScore?: number;
      isCritical?: boolean;
      mode?: OperationMode;
      origin?: "user" | "auto";
    }> = [];

    if (overdueChargeCandidate) {
      const actionMode = resolveModeForAction(
        {
          orgMode: orgOperationMode,
          userMode: userOperationMode,
          actionTypeOverrides,
        },
        "finance"
      );
      const autoReady = actionMode === "automatic";
      actions.push({
        id: `charge-${overdueChargeCandidate.id}`,
        entity: String(
          overdueChargeCandidate?.customer?.name ?? "Cliente sem nome"
        ),
        reason: `Cobrança vencida há ${Math.max(daysOverdue ?? 0, 0)} dias`,
        priority: "critical",
        nextAction: "Cobrar agora",
        onExecute: () =>
          navigate(`/finances?chargeId=${overdueChargeCandidate.id}`),
        amountLabel: formatCurrency(
          Number(overdueChargeCandidate.amountCents ?? 0)
        ),
        group: "financeiro",
        impactScore: 94,
        urgencyScore: Math.min(80 + Number(daysOverdue ?? 0), 100),
        isCritical: true,
        mode: actionMode,
        origin: autoReady ? "auto" : "user",
      });
    }

    if (doneWithoutChargeCandidate) {
      const actionMode = resolveModeForAction(
        {
          orgMode: orgOperationMode,
          userMode: userOperationMode,
          actionTypeOverrides,
        },
        "service_order"
      );
      actions.push({
        id: `os-${doneWithoutChargeCandidate.id}`,
        entity: `O.S. #${doneWithoutChargeCandidate.id}`,
        reason: "Concluída sem cobrança vinculada",
        priority: "warning",
        nextAction: "Gerar cobrança",
        onExecute: () =>
          navigate(`/finances?serviceOrderId=${doneWithoutChargeCandidate.id}`),
        group: "operacional",
        impactScore: 88,
        urgencyScore: 78,
        isCritical: true,
        mode: actionMode,
        origin: actionMode === "automatic" ? "auto" : "user",
      });
    }

    return actions;
  }, [
    actionTypeOverrides,
    daysOverdue,
    doneWithoutChargeCandidate,
    navigate,
    orgOperationMode,
    overdueChargeCandidate,
    userOperationMode,
  ]);

  const pipelineStages = useMemo(
    () => [
      { label: "Agendado", value: todayAppointments },
      { label: "O.S.", value: displayMetrics.totalServiceOrders },
      { label: "Concluído", value: displayMetrics.completedOrders },
      { label: "Cobrado", value: displayMetrics.chargesGenerated },
      { label: "Pago", value: paidCharges },
    ],
    [
      displayMetrics.chargesGenerated,
      displayMetrics.completedOrders,
      displayMetrics.totalServiceOrders,
      paidCharges,
      todayAppointments,
    ]
  );

  const bottlenecks = [
    {
      id: "no-billing",
      label: "Serviços sem faturamento",
      value: Math.max(displayMetrics.openServiceOrders, 0),
      severity: "high",
      action: "Cobrar agora",
      onClick: () => navigate("/finances"),
    },
    {
      id: "overdue",
      label: "Cobranças vencidas",
      value: overdueCharges,
      severity: "critical",
      action: "Ver vencidas",
      onClick: () => navigate("/finances"),
    },
    {
      id: "stalled",
      label: "O.S. travadas",
      value: Math.max(displayMetrics.delayedOrders, 0),
      severity: "critical",
      action: "Destravar O.S.",
      onClick: () => navigate("/service-orders"),
    },
  ].sort((a, b) => b.value - a.value);
  const criticalPending = executionPlan.decisions.filter(
    item => item.severity === "critical"
  ).length;
  const urgentActions = operationalActionFeed.filter(
    item => item.isCritical
  ).length;
  const safetyState = useMemo(() => evaluateSafetyLimits(logs), [logs]);
  const effectiveGlobalMode: OperationMode = safetyState.shouldFallbackToManual
    ? "manual"
    : (userOperationMode ?? orgOperationMode);
  const crossEntitySignals = useMemo(
    () =>
      buildCrossEntitySignals({
        overdueCharges,
        delayedOrders: displayMetrics.delayedOrders,
        todayAppointments,
        totalCustomers: displayMetrics.totalCustomers,
        pausedRevenueInCents: totalPausedRevenue,
        openServiceOrders: displayMetrics.openServiceOrders,
      }),
    [
      overdueCharges,
      displayMetrics.delayedOrders,
      displayMetrics.totalCustomers,
      displayMetrics.openServiceOrders,
      todayAppointments,
      totalPausedRevenue,
    ]
  );
  const decisionAuditLog = useMemo(
    () =>
      buildDecisionLog(
        operationalActionFeed.map(item => ({
          action: {
            actionId: item.id,
            actionType:
              item.group === "financeiro" ? "finance" : "service_order",
            label: item.nextAction,
            explainReason: item.reason,
            explainImpact: `${item.impactScore ?? 50}/100`,
            explainRisk: `${item.urgencyScore ?? 50}/100`,
            ruleApplied:
              item.group === "financeiro"
                ? "finance.overdue.recovery"
                : "service-order.done-without-charge",
          },
          mode: item.mode ?? effectiveGlobalMode,
          origin: item.origin ?? "user",
          status: "queued",
        }))
      ),
    [effectiveGlobalMode, operationalActionFeed]
  );

  const hasAnyCriticalError =
    metricsQuery.isError &&
    revenueQuery.isError &&
    serviceOrdersStatusQuery.isError &&
    chargesStatusQuery.isError;

  const isStillLoading =
    metricsQuery.isLoading ||
    revenueQuery.isLoading ||
    serviceOrdersStatusQuery.isLoading ||
    chargesStatusQuery.isLoading;

  useEffect(() => {
    const hasBackgroundRefresh =
      metricsQuery.isFetching ||
      revenueQuery.isFetching ||
      serviceOrdersStatusQuery.isFetching ||
      chargesStatusQuery.isFetching;

    if (hasBackgroundRefresh) {
      setOptimisticTick(true);
      const timer = window.setTimeout(() => setOptimisticTick(false), 800);
      return () => window.clearTimeout(timer);
    }

    setOptimisticTick(false);
  }, [
    metricsQuery.isFetching,
    revenueQuery.isFetching,
    serviceOrdersStatusQuery.isFetching,
    chargesStatusQuery.isFetching,
  ]);

  useEffect(() => {
    if (!isStillLoading) {
      setIsSlowLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setIsSlowLoading(true), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [isStillLoading]);

  if (isInitializing) {
    return (
      <div className="space-y-8 p-6">
        <section className="nexo-surface p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            Dashboard Executivo
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)] dark:text-[var(--text-muted)]">
            Preparando sessão e carregando contexto.
          </p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">
        Sua sessão não está ativa.
      </div>
    );
  }

  if (hasAnyCriticalError) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {getErrorMessage(metricsQuery.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <section className="nexo-surface-primary p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-300">
              <BarChart3 className="h-3.5 w-3.5" /> Centro executivo
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">
              Estado da operação: {heroState}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {overdueCharges} cobranças vencidas • {nonBilledServices} serviços sem faturamento • prioridade dominante {dominantProblem?.title ?? "Operação estável"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(dominantProblem?.ctaPath ?? "/service-orders")}
              className="nexo-cta-dominant min-h-11"
            >
              {dominantProblem?.ctaLabel ?? "Executar prioridades"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="nexo-cta-secondary min-h-11"
            >
              Abrir financeiro
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[var(--border-soft)] pt-4 md:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Receita em risco</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{formatCurrency(totalPausedRevenue + nonBilledServicesImpact)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Gargalos ativos</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{bottlenecks.filter(item => item.value > 0).length}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Ações urgentes</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{urgentActions}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Última atualização</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString("pt-BR") : "—"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Clientes criados"
          value={displayMetrics.createdCustomers}
          loading={metricsQuery.isLoading && metricsQuery.data === undefined}
          description="Base total de clientes cadastrados."
        />
        <MetricCard
          icon={Briefcase}
          label="Serviços concluídos"
          value={displayMetrics.completedServices}
          loading={metricsQuery.isLoading && metricsQuery.data === undefined}
          description="Total de O.S. finalizadas com sucesso."
        />
        <MetricCard
          icon={DollarSign}
          label="Cobranças geradas"
          value={displayMetrics.chargesGenerated}
          loading={metricsQuery.isLoading && metricsQuery.data === undefined}
          description={`${formatCurrency(displayMetrics.paidRevenueInCents)} recebido`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Pendente + atrasado"
          value={formatCurrency(totalPausedRevenue)}
          loading={metricsQuery.isLoading && metricsQuery.data === undefined}
          description={`${overdueCharges} cobranças vencidas`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-surface-primary xl:col-span-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Execução prioritária</h2>
            <button
              type="button"
              onClick={() => setFocusCriticalOnly(prev => !prev)}
              className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
            >
              {focusCriticalOnly ? "Foco crítico" : "Mostrar todas"}
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Linhas de ação, pipeline e decisão operacional sem empilhar blocos internos.</p>
          <div className="mt-4 space-y-4">
            <ActionFeed items={operationalActionFeed} focusCriticalOnly={focusCriticalOnly} />
            <PipelineStage
              stages={pipelineStages}
              selectedStage={selectedPipelineStage}
              onStageSelect={setSelectedPipelineStage}
            />
          </div>
        </article>

        <article className="nexo-surface-primary p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Top prioridades</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Impacto direto em caixa e velocidade de operação.</p>
          <div className="mt-4 space-y-3">
            {priorityProblems.map((problem, index) => (
              <div key={problem.id} className="nexo-surface-inner p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-300">#{index + 1} prioridade</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{problem.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{problem.count} itens • {formatCurrency(problem.impactCents)} de impacto</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-surface-primary xl:col-span-2 p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Receita ao longo do tempo</h2>
          {lineChartData.length === 0 ? (
            <div className="mt-3 text-sm text-[var(--text-muted)]">Sem série temporal disponível no momento.</div>
          ) : (
            <div className="mt-4 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={84} tickFormatter={value => formatCurrency(Number(value) * 100)} />
                  <Tooltip formatter={(value: number) => [formatCurrency(Number(value) * 100), "Receita"]} />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#f97316" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="nexo-surface-primary p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Distribuição de cobrança</h2>
          <div className="mt-4 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 6, right: 10, bottom: 12, left: 10 }}>
                <Pie data={displayChargesStatus} dataKey="value" nameKey="label" innerRadius={52} outerRadius={86} paddingAngle={3}>
                  {displayChargesStatus.map((entry, index) => (
                    <Cell key={entry.key} fill={["#f97316", "#22c55e", "#ef4444", "#3b82f6"][index % 4]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name) => [value, String(name)]} />
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 14, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-surface-primary xl:col-span-2 p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Automação e próximas ações</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Execução híbrida com trilha de decisão auditável.</p>
          <div className="mt-4">
            <OperationalActionFeed plan={executionPlan} riskOperationalState={riskOperationalState} />
          </div>
        </article>
        <article className="nexo-surface-primary p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Alertas</h2>
          <div className="mt-3 space-y-3 text-sm">
            <div className="nexo-surface-inner p-3">
              <p className="font-medium text-[var(--text-primary)]">Safety limits</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {safetyState.shouldFallbackToManual ? "Fallback manual ativado." : "Automação dentro do limite."}
              </p>
            </div>
            {quotaWarnings.length > 0 ? (
              <div className="nexo-surface-inner border-amber-400/30 p-3 text-amber-200">
                Limite do plano atingido em {quotaWarnings.join(", ")}.
              </div>
            ) : null}
            {actionFlowSuggestion ? (
              <button
                type="button"
                onClick={() => navigate(actionFlowSuggestion.ctaPath)}
                className="nexo-cta-dominant w-full"
              >
                {actionFlowSuggestion.ctaLabel}
              </button>
            ) : null}
          </div>
        </article>
      </section>

      {(metricsQuery.isError || revenueQuery.isError || serviceOrdersStatusQuery.isError || chargesStatusQuery.isError) && !hasAnyCriticalError ? (
        <section className="nexo-surface-inner border-amber-400/40 p-4 text-sm text-amber-200">
          Parte dos blocos não foi carregada. Os dados visíveis já são válidos.
        </section>
      ) : null}

      {isSlowLoading ? (
        <section className="nexo-surface-inner border-blue-400/40 p-4 text-sm text-blue-200">
          A atualização está mais lenta que o normal; continue navegando enquanto os blocos são carregados.
        </section>
      ) : null}
    </div>
  );
}