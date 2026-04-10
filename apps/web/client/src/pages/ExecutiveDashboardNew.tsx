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
          <p className="nexo-text-wrap text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
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
            <p className="nexo-text-wrap mt-2 min-h-4 text-xs text-zinc-500 dark:text-zinc-400">
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
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Preparando sessão e carregando contexto.
          </p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6 text-sm text-zinc-500">
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
    <div className="nexo-page-shell">
      {dominantProblem ? (
        <section className="nexo-hero-operational">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/25" />
          <div className="relative grid gap-5 lg:grid-cols-[1.2fr_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                Zona de comando
              </p>
              <h2 className="nexo-text-wrap mt-3 text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
                Estado da operação: {heroState}
              </h2>
              <p
                className={`nexo-text-wrap mt-3 text-base font-semibold ${heroStateTone}`}
              >
                {overdueCharges} cobranças vencidas • {nonBilledServices}{" "}
                serviços sem faturamento.
              </p>
              <p className="nexo-text-wrap mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                Próxima ação dominante: <strong>{dominantProblem.title}</strong>
                . {dominantProblem.helperText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(dominantProblem.ctaPath)}
              className="nexo-cta-dominant min-h-14 min-w-[240px] max-w-full !rounded-xl !text-base"
            >
              {dominantProblem.ctaLabel}
            </button>
          </div>
        </section>
      ) : null}

      <section className="nexo-page-header nexo-card-operational transition-all duration-300 sm:px-6 sm:py-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Visão executiva
            </div>
            <h1 className="nexo-page-header-title nexo-text-wrap md:text-4xl">
              Dashboard Executivo
            </h1>
            <p className="nexo-page-header-description nexo-text-wrap max-w-xl">
              Organize sua operação, evite erros e mantenha controle financeiro
              no funil Cliente → Agendamento → O.S. → Pagamento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/service-orders")}
              className="nexo-cta-dominant min-h-12 flex-1 sm:flex-none"
            >
              Atacar gargalos
            </button>
            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="nexo-cta-secondary min-h-12 flex-1 sm:flex-none"
            >
              Abrir financeiro
            </button>
          </div>
        </div>
        <OperationalHealthView
          criticalPending={criticalPending}
          overdueItems={overdueCharges}
          bottlenecks={bottlenecks.filter(item => item.value > 0).length}
          urgentActions={urgentActions}
        />
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <div className="nexo-card-informative p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Operation mode control
            </p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Organização em <strong>{orgOperationMode}</strong> • efetivo em{" "}
              <strong>{effectiveGlobalMode}</strong>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                ["manual", "assisted", "semi_automatic", "automatic"] as const
              ).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setUserOperationMode(mode)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    userOperationMode === mode
                      ? "border-orange-400 bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                      : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                Financeiro:
              </span>
              {(["manual", "semi_automatic", "automatic"] as const).map(
                mode => (
                  <button
                    key={`finance-${mode}`}
                    type="button"
                    onClick={() =>
                      setActionTypeOverrides(prev => ({
                        ...prev,
                        finance: mode,
                      }))
                    }
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      actionTypeOverrides.finance === mode
                        ? "border-blue-400 bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                        : "border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {mode}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="nexo-card-informative p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Safety limits
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs">
              {safetyState.shouldFallbackToManual ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Fallback
                  manual ativado
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />{" "}
                  Automação dentro do limite
                </>
              )}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Financeiro {safetyState.remainingByActionType.finance} • O.S.{" "}
              {safetyState.remainingByActionType.service_order} • Comunicação{" "}
              {safetyState.remainingByActionType.communication}
            </p>
          </div>
          <div className="nexo-card-informative p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Cross-entity context
            </p>
            <p className="mt-1 text-xs font-medium">
              {crossEntitySignals.label}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Risco {crossEntitySignals.riskScore}/100 • Carga{" "}
              {crossEntitySignals.loadScore}/100 • Prioridade{" "}
              {crossEntitySignals.priorityScore}/100
            </p>
          </div>
        </div>
        {quotaWarnings.length > 0 ? (
          <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Limite do plano atingido em {quotaWarnings.join(", ")}. Faça upgrade
            para continuar crescendo sem bloqueios.
          </div>
        ) : null}
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">Visão geral</p>
        <div className="grid gap-5 xl:grid-cols-2">
          <AlertStrip
            severity={overdueCharges > 0 ? "critical" : "normal"}
            title="Atenção operacional imediata"
            description={
              overdueCharges > 0
                ? `${overdueCharges} cobranças vencidas impactando caixa agora.`
                : "Sem bloqueio crítico de cobrança no momento."
            }
            action={
              <PrimaryActionButton
                label={
                  overdueCharges > 0 ? "Atacar vencidas" : "Abrir financeiro"
                }
                onClick={() => navigate("/finances")}
              />
            }
          />
          <AlertStrip
            severity={displayMetrics.delayedOrders > 0 ? "warning" : "success"}
            title="Pendências da execução"
            description={`${displayMetrics.delayedOrders} O.S. com risco de travamento operacional.`}
            action={
              <PrimaryActionButton
                label="Abrir Service Orders"
                onClick={() => navigate("/service-orders")}
              />
            }
          />
        </div>
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">Execução</p>
        <div className="grid gap-5 xl:grid-cols-2">
          <ActionFeed
            items={operationalActionFeed}
            focusCriticalOnly={focusCriticalOnly}
          />
          <div className="space-y-2">
            <PipelineStage
              stages={pipelineStages}
              selectedStage={selectedPipelineStage}
              onStageSelect={setSelectedPipelineStage}
            />
            {selectedPipelineStage ? (
              <p className="text-xs text-zinc-500">
                Filtro ativo no pipeline:{" "}
                <strong>{selectedPipelineStage}</strong>.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">Decisões e controle</p>
        <div className="grid gap-5 xl:grid-cols-2">
          <article className="nexo-card-operational">
            <h3 className="text-sm font-semibold">Executive summary</h3>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              Gargalos, risco financeiro e volume travado para decisão rápida.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                Gargalos ativos:{" "}
                <strong>
                  {bottlenecks.filter(item => item.value > 0).length}
                </strong>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                Risco financeiro:{" "}
                <strong>{formatCurrency(totalPausedRevenue)}</strong>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                Volume travado:{" "}
                <strong>{displayMetrics.openServiceOrders}</strong>
              </div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs">
                Ação nº1:{" "}
                <strong>{dominantProblem?.title ?? "Operação estável"}</strong>
              </div>
            </div>
          </article>
          <article className="nexo-card-operational">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Decision log (auditoria)
              </h3>
              <button
                type="button"
                onClick={() => setFocusCriticalOnly(prev => !prev)}
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              >
                {focusCriticalOnly ? "Mostrar mais" : "Foco crítico"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {decisionAuditLog.slice(0, 5).map(log => (
                <div
                  key={log.id}
                  className="rounded-md border border-white/10 bg-white/5 p-2"
                >
                  <p className="text-xs font-semibold">
                    {log.actionLabel}{" "}
                    <span className="text-zinc-500">• {log.actionType}</span>
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    {log.reason}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                    regra {log.ruleApplied} • origem {log.origin} • modo{" "}
                    {log.mode}
                  </p>
                </div>
              ))}
              {decisionAuditLog.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Sem decisões no momento.
                </p>
              ) : null}
            </div>
          </article>
        </div>
      </section>

      <section className="nexo-card-operational">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4" /> Background automation prep
        </p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          Execução fora da UI pronta para eventos (cobrança vencida, O.S.
          concluída, risco elevado) com notificações inteligentes e trilha de
          auditoria.
        </p>
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">KPIs de comando</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
            description={`${formatCurrency(displayMetrics.paidRevenueInCents)} já recebido`}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Pendente + atrasado"
            value={formatCurrency(totalPausedRevenue)}
            loading={metricsQuery.isLoading && metricsQuery.data === undefined}
            description={`${overdueCharges} cobranças vencidas em foco`}
          />
        </div>
      </section>

      {displayMetrics.totalCustomers === 0 ? (
        <section className="rounded-xl border border-orange-200 bg-orange-50/80 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
          <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
            Seu dashboard não precisa ficar vazio.
          </p>
          <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">
            Comece agora com ações simples: crie seu primeiro cliente e agende
            seu primeiro serviço.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/customers")}
              className="nexo-cta-primary min-h-10"
            >
              Crie seu primeiro cliente
            </button>
            <button
              type="button"
              onClick={() => navigate("/appointments")}
              className="nexo-cta-secondary min-h-10"
            >
              Agende seu primeiro serviço
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-card-operational nexo-fade-in xl:col-span-2">
          <h2 className="nexo-section-title">Receita ao longo do tempo</h2>
          <p className="mt-1 nexo-section-description">
            Linha temporal de evolução de receita.
          </p>
          {revenueQuery.isLoading &&
          revenueQuery.data === undefined &&
          displayRevenue.length === 0 ? (
            <DashboardCardSkeleton className="mt-4 min-h-[260px]" />
          ) : lineChartData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="Ainda não há série temporal de receita"
              description="Assim que houver cobranças registradas, você verá a evolução no tempo para decidir com mais precisão."
              action={{
                label: "Ir para financeiro",
                onClick: () => navigate("/finances"),
              }}
            />
          ) : (
            <div className="mt-4 h-[260px] nexo-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={84}
                    tickFormatter={value => formatCurrency(Number(value) * 100)}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(251,146,60,.25)",
                      background: "rgba(9,9,11,.94)",
                      color: "#fff",
                    }}
                    formatter={(value: number) => [
                      formatCurrency(Number(value) * 100),
                      "Receita",
                    ]}
                    labelFormatter={label => `Período: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#f97316"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, fill: "#f97316" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="nexo-card-informative nexo-fade-in">
          <h2 className="nexo-section-title">Funil operacional</h2>
          <p className="mt-1 nexo-section-description">
            Cliente → Agendamento → O.S. → Pagamento.
          </p>
          {funnelData.every(item => item.value <= 0) ? (
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="Funil operacional sem dados"
              description="Cadastre clientes e agendamentos para abrir o fluxo customer → appointment → service order → charge."
              action={{
                label: "Crie seu primeiro cliente",
                onClick: () => navigate("/customers"),
              }}
              secondaryAction={{
                label: "Agende seu primeiro serviço",
                onClick: () => navigate("/appointments"),
              }}
            />
          ) : (
            <div className="mt-4 h-[260px] nexo-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(251,146,60,.3)",
                      background: "rgba(9,9,11,.94)",
                      color: "#fff",
                    }}
                    formatter={(value: number) => [value, "Volume"]}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList
                      position="right"
                      fill="#a1a1aa"
                      stroke="none"
                      dataKey="name"
                    />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">Alertas e gargalos</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="nexo-card-informative nexo-fade-in">
            <h2 className="nexo-section-title">Distribuição de status</h2>
            <p className="mt-1 nexo-section-description">
              Volume atual por status de cobrança.
            </p>
            {chargesStatusQuery.isLoading &&
            chargesStatusQuery.data === undefined &&
            displayChargesStatus.length === 0 ? (
              <DashboardCardSkeleton className="mt-4 min-h-[260px]" />
            ) : (
              <div className="mt-4 h-[260px] nexo-fade-in">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 6, right: 10, bottom: 12, left: 10 }}
                  >
                    <Pie
                      data={displayChargesStatus}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={3}
                    >
                      {displayChargesStatus.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={
                            ["#f97316", "#22c55e", "#ef4444", "#3b82f6"][
                              index % 4
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid rgba(251,146,60,.25)",
                        background: "rgba(9,9,11,.94)",
                        color: "#fff",
                      }}
                      formatter={(value: number, name) => [value, String(name)]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 14, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </article>

          <article
            className={`nexo-card-operational nexo-fade-in transition-all duration-300 ${optimisticTick ? "ring-2 ring-orange-300/40 dark:ring-orange-500/30" : ""}`}
          >
            <h2 className="nexo-section-title">Gargalos agora</h2>
            <p className="mt-1 nexo-section-description">
              Pendências com ação direta para destravar receita.
            </p>
            <div className="mt-4 space-y-3">
              {bottlenecks.map(item => (
                <div
                  key={item.id}
                  className={`nexo-list-row ${item.severity === "critical" ? "nexo-list-row-critical" : "nexo-list-row-high"}`}
                >
                  <div className="min-w-0">
                    <p className="nexo-text-wrap font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.label}
                    </p>
                    <p className="nexo-text-wrap text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="mr-1.5 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">
                        {item.severity === "critical" ? "Crítico" : "Alto"}
                      </span>
                      {item.value} itens
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="nexo-cta-secondary !h-10 !rounded-lg !px-4 !text-xs md:!h-8 md:!px-3"
                  >
                    {item.action}
                  </button>
                </div>
              ))}
            </div>
            {(metricsQuery.isFetching ||
              revenueQuery.isFetching ||
              serviceOrdersStatusQuery.isFetching ||
              chargesStatusQuery.isFetching) && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Atualizando blocos sem interromper sua leitura...
              </div>
            )}
            {lastUpdatedAt ? (
              <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                Última atualização: {lastUpdatedAt.toLocaleTimeString("pt-BR")}
              </p>
            ) : null}
          </article>
        </div>
      </section>

      <section className="nexo-cockpit-zone">
        <p className="nexo-zone-title">Automação e próximas ações</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              O motor operacional suporta execução híbrida: ações manuais
              continuam disponíveis e ações automáticas podem rodar sozinhas
              quando policy + modo permitirem. Modo atual do tenant:{" "}
              {executionMode}.
            </div>
            <OperationalActionFeed
              plan={executionPlan}
              riskOperationalState={riskOperationalState}
            />
          </div>
          <article className="nexo-card-informative nexo-fade-in">
            <h2 className="nexo-section-title">
              Top 3 prioridades automáticas
            </h2>
            <p className="mt-1 nexo-section-description">
              Sem lista genérica: apenas o que gera caixa mais rápido.
            </p>
            <div className="mt-4 space-y-3">
              {priorityProblems.map((problem, index) => (
                <div key={problem.id} className="nexo-card-informative p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-300">
                    #{index + 1} prioridade
                  </p>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="nexo-text-wrap font-semibold text-zinc-900 dark:text-zinc-100">
                        {problem.title}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        {problem.count} itens •{" "}
                        {formatCurrency(problem.impactCents)} de impacto
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(problem.ctaPath)}
                      className="nexo-cta-secondary !h-9 !rounded-lg !px-3 !text-xs"
                    >
                      {problem.ctaLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {actionFlowSuggestion ? (
            <article className="nexo-card-alert border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-700/50 dark:bg-emerald-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                Fluxo automático de ação
              </p>
              <h3 className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                {actionFlowSuggestion.title}
              </h3>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                {actionFlowSuggestion.description}
              </p>
              <button
                type="button"
                onClick={() => navigate(actionFlowSuggestion.ctaPath)}
                className="nexo-cta-dominant mt-4 !h-11 !rounded-xl !px-5"
              >
                {actionFlowSuggestion.ctaLabel}
              </button>
            </article>
          ) : (
            <article className="nexo-card-informative">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Fluxo automático de ação
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Assim que você criar Cliente, O.S. ou Cobrança, a próxima ação
                aparece aqui sem precisar interpretar.
              </p>
            </article>
          )}
        </div>
      </section>

      {(metricsQuery.isError ||
        revenueQuery.isError ||
        serviceOrdersStatusQuery.isError ||
        chargesStatusQuery.isError) &&
      !hasAnyCriticalError ? (
        <section className="rounded-2xl border border-amber-300/50 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
          Parte dos blocos não foi carregada. Os dados visíveis já são válidos;
          atualize a página para tentar completar o painel.
        </section>
      ) : null}

      {isSlowLoading ? (
        <section className="rounded-2xl border border-blue-300/50 bg-blue-50/70 p-4 text-sm text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-200">
          A atualização está mais lenta que o normal. Você pode continuar
          navegando enquanto os blocos terminam de carregar.
        </section>
      ) : null}
    </div>
  );
}
