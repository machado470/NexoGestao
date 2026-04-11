import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppEntityContextPanel,
  AppNextActionList,
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppStatCard,
  AppTimeline,
  AppTimelineItem,
  AppOperationalStateCard,
  AppOperationalStatePanel,
} from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { useActionHandler } from "@/hooks/useActionHandler";
import { AppLoadingState, AppNextActions } from "@/components/app";
import {
  buildBottleneckGroups,
  buildEntityContextBridge,
  buildNextActions,
  getOperationalStateSummary,
} from "@/lib/operations/operational-hub";

function toArray<T>(payload: unknown): T[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function toMetrics(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload ?? {};
  return {
    openServiceOrders: Number((raw as any)?.openServiceOrders ?? (raw as any)?.openOrders ?? 0),
    pendingPaymentsInCents: Number((raw as any)?.pendingPaymentsInCents ?? 0),
    totalRevenueInCents: Number((raw as any)?.totalRevenueInCents ?? 0),
    delayedOrders: Number((raw as any)?.delayedOrders ?? 0),
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function ExecutiveDashboardNew() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();
  const { executeAction } = useActionHandler();
  const [isExecutingNext, setIsExecutingNext] = useState(false);
  const canQuery = isAuthenticated && !isInitializing;

  const metricsQuery = trpc.dashboard.kpis.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const governanceSummaryQuery = trpc.governance.summary.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });

  const metrics = useMemo(() => toMetrics(metricsQuery.data), [metricsQuery.data]);
  const appointments = useMemo(() => toArray<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrders = useMemo(() => toArray<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const charges = useMemo(() => toArray<any>(chargesQuery.data), [chargesQuery.data]);
  const customers = useMemo(() => toArray<any>(customersQuery.data), [customersQuery.data]);

  const overdueCharges = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE").length;
  const doneWithoutCharge = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length;
  const overdueAppointments = appointments.filter(item => String(item?.status ?? "").toUpperCase() === "NO_SHOW").length;

  const operationalState = useMemo(
    () =>
      getOperationalStateSummary({
        overdueCharges,
        doneWithoutCharge,
        overdueAppointments,
        failedWhatsAppMessages: 0,
        governanceState: (governanceSummaryQuery.data as any)?.data?.operationalState,
      }),
    [doneWithoutCharge, governanceSummaryQuery.data, overdueAppointments, overdueCharges]
  );

  const nextActions = useMemo(
    () =>
      buildNextActions({
        customers,
        appointments,
        serviceOrders,
        charges,
      }).slice(0, 6),
    [appointments, charges, customers, serviceOrders]
  );

  const bottlenecks = useMemo(() => buildBottleneckGroups({ appointments, serviceOrders, charges }), [appointments, charges, serviceOrders]);

  const feed = [
    `${doneWithoutCharge} O.S. concluídas sem cobrança`,
    `${overdueCharges} cobranças vencidas aguardando follow-up`,
    `${metrics.delayedOrders} ordens com atraso operacional`,
  ];

  const executeNextAction = async () => {
    const nextAction = nextActions[0];
    if (!nextAction?.executionAction) {
      toast.message("Sem próxima ação executável no momento.");
      return;
    }

    setIsExecutingNext(true);
    const result = await executeAction(nextAction.executionAction);
    await Promise.all([
      metricsQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      customersQuery.refetch(),
      governanceSummaryQuery.refetch(),
    ]);

    if (result.ok) {
      toast.success("Próxima ação executada. Estado operacional recalculado.");
    }
    setIsExecutingNext(false);
  };

  if (metricsQuery.isLoading || governanceSummaryQuery.isLoading) {
    return (
      <AppPageShell>
        <AppLoadingState rows={6} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppPageHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="nexo-page-header-title">Centro de decisão operacional</h1>
            <p className="nexo-page-header-description">Entenda em segundos o que precisa ser feito agora no ciclo Cliente → Agendamento → O.S. → Cobrança → Pagamento.</p>
          </div>
          <Button onClick={() => void executeNextAction()} disabled={isExecutingNext || nextActions.length === 0}>
            {isExecutingNext ? "Resolvendo próxima pendência..." : "Resolver próxima pendência agora"}
          </Button>
        </div>
      </AppPageHeader>

      <AppNextActions
        title="Engine prioritária de execução"
        engineInput={{
          customers: customers.map(item => ({ id: item.id, name: item.name, phone: item.phone ?? null, lastContactAt: item.lastContactAt ?? null })),
          appointments: appointments.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            startsAt: item.startsAt,
          })),
          serviceOrders: serviceOrders.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            delayedMinutes: item.delayedMinutes ?? 0,
            updatedAt: item.updatedAt,
          })),
          charges: charges.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            amountCents: item.amountCents,
            dueDate: item.dueDate,
          })),
        }}
      />

      <AppOperationalStatePanel>
        <AppOperationalStateCard
          state={operationalState.level}
          summary={operationalState.summary}
          impact={operationalState.impact}
          recommendation={operationalState.recommendedAction}
          className="lg:col-span-2"
        />
        <AppSectionCard>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ações contextuais</p>
          <p className="text-xs text-[var(--text-muted)]">Atalhos para agir sem sair do foco operacional.</p>
          <div className="mt-3 grid gap-2">
            <button className="nexo-cta-secondary" onClick={() => navigate("/service-orders")}>Concluir serviço em atraso</button>
            <button className="nexo-cta-secondary" onClick={() => navigate("/finances")}>Cobrar cliente com pagamento pendente</button>
            <button className="nexo-cta-secondary" onClick={() => navigate("/appointments")}>Confirmar agendamento de hoje</button>
          </div>
        </AppSectionCard>
      </AppOperationalStatePanel>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard label="Agendamentos pendentes" value={appointments.filter(item => String(item?.status ?? "").toUpperCase() === "SCHEDULED").length} helper="Precisam de confirmação" />
        <AppStatCard label="O.S. em andamento" value={serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS").length} helper="Execução ativa" />
        <AppStatCard label="Cobranças vencidas" value={overdueCharges} helper="Impacto direto em caixa" />
        <AppStatCard label="Receita pendente" value={formatCurrency(metrics.pendingPaymentsInCents)} helper={`Faturamento total ${formatCurrency(metrics.totalRevenueInCents)}`} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Você precisa fazer isso agora</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Cada item mostra o problema, o impacto e a ação recomendada.</p>
          <AppNextActionList
            actions={nextActions.map(action => ({
              id: action.id,
              title: action.title,
              description: action.description,
              severity: action.severity,
              action: action.executionAction,
            }))}
          />
        </AppSectionCard>

        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Gargalos operacionais</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Pontos que travam a operação e exigem ação rápida.</p>
          <div className="space-y-2">
            {bottlenecks.map(item => (
              <button
                key={item.id}
                className="nexo-card-informative flex w-full items-center justify-between p-3 text-left"
                onClick={() => navigate(item.href)}
              >
                <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
              </button>
            ))}
          </div>
        </AppSectionCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Operação recente</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Resumo curto do que acabou de acontecer na operação.</p>
          <AppTimeline>
            {feed.map(item => (
              <AppTimelineItem key={item}>{item}</AppTimelineItem>
            ))}
          </AppTimeline>
        </AppSectionCard>
        <AppEntityContextPanel links={buildEntityContextBridge({})} />
      </section>
    </AppPageShell>
  );
}
