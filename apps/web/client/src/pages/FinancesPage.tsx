import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import {
  AppChartPanel,
  AppDataTable,
  AppKpiRow,
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { getChargeSeverity, getOperationalSeverityLabel } from "@/lib/operations/operational-intelligence";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { formatDelta, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { TrpcSectionErrorBoundary } from "@/components/TrpcSectionErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function FinancesPage() {
  setBootPhase("PAGE:Financeiro");
  useRenderWatchdog("FinancesPage");
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const utils = trpc.useUtils();

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const statsQuery = trpc.finance.charges.stats.useQuery(undefined, { retry: false });
  const revenueQuery = trpc.finance.charges.revenueByMonth.useQuery(undefined, { retry: false });
  const payCharge = trpc.finance.charges.pay.useMutation();

  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const stats = useMemo(() => normalizeObjectPayload<any>(statsQuery.data) ?? {}, [statsQuery.data]);
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
  const current30 = getWindow(30, 0);
  const previous30 = getWindow(30, 1);
  const receivedCurrent = charges
    .filter(item => String(item?.status ?? "").toUpperCase() === "PAID" && inRange(safeDate(item?.paidAt ?? item?.updatedAt), current30.start, current30.end))
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const receivedPrevious = charges
    .filter(item => String(item?.status ?? "").toUpperCase() === "PAID" && inRange(safeDate(item?.paidAt ?? item?.updatedAt), previous30.start, previous30.end))
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const overdueCurrent = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE" && inRange(safeDate(item?.dueDate), current30.start, current30.end)).length;
  const overduePrevious = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE" && inRange(safeDate(item?.dueDate), previous30.start, previous30.end)).length;
  const openTotal = charges.filter(item => ["PENDING", "OVERDUE"].includes(String(item?.status ?? "").toUpperCase())).reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const overdueTotal = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE").reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const receivedTotal = charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID").reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const dueSoon = charges.filter((item) => {
    const status = String(item?.status ?? "").toUpperCase();
    const due = safeDate(item?.dueDate);
    if (!due || status !== "PENDING") return false;
    const delta = due.getTime() - Date.now();
    return delta >= 0 && delta <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  usePageDiagnostics({
    page: "finances",
    isLoading: showChargesInitialLoading || (revenueQuery.isLoading && revenueSafe.data.length === 0),
    hasError: Boolean(showChargesErrorState || (revenueQuery.error && revenueSafe.data.length === 0)),
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

  useEffect(() => {
    if (!chargesQuery.error && !statsQuery.error && !revenueQuery.error) return;
    // eslint-disable-next-line no-console
    console.error("[TRPC ERROR] finances_query_error", {
      charges: chargesQuery.error?.message,
      stats: statsQuery.error?.message,
      revenue: revenueQuery.error?.message,
    });
  }, [chargesQuery.error, revenueQuery.error, statsQuery.error]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[CHART DATA] finances.revenue", {
      points: revenueSafe.data.length,
      isValid: revenueSafe.isValid,
      reason: revenueSafe.reason,
    });
  }, [revenueSafe.data.length, revenueSafe.isValid, revenueSafe.reason]);

  async function registerPayment(charge: any) {
    if (payCharge.isPending) return;
    if (String(charge?.status ?? "").toUpperCase() === "PAID") {
      toast.error("Esta cobrança já está paga.");
      return;
    }
    try {
      await payCharge.mutateAsync({
        chargeId: String(charge.id),
        method: "PIX",
        amountCents: Number(charge.amountCents ?? 0),
        idempotencyKey: buildIdempotencyKey("finance.pay_charge", String(charge.id)),
      });
      toast.success("Pagamento registrado com sucesso");
      await Promise.all([
        chargesQuery.refetch(),
        statsQuery.refetch(),
        utils.dashboard.kpis.invalidate(),
        invalidateOperationalGraph(utils, String(charge?.customerId ?? "")),
      ]);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao registrar pagamento");
    }
  }

  return (
    <PageWrapper title="Financeiro" subtitle="Cobranças com execução padronizada de ações e invalidação consistente.">
      <OperationalTopCard
        contextLabel="Direção de receita"
        title="Fluxo cobrança → pagamento"
        description="Cobranças e pagamentos reais com atualização automática do caixa."
        primaryAction={(
          <ActionFeedbackButton state="idle" idleLabel="Criar cobrança agora" onClick={() => setOpenCreate(true)} />
        )}
      />

      <KpiErrorBoundary context="finances:kpi">
        <AppKpiRow items={[
        {
          title: "Recebido no período",
          value: formatCurrency(receivedCurrent),
          delta: formatDelta(percentDelta(receivedCurrent, receivedPrevious)),
          trend: trendFromDelta(percentDelta(receivedCurrent, receivedPrevious)),
          hint: "30 dias vs período anterior",
          tone: "important",
        },
        { title: "Total em aberto", value: formatCurrency(openTotal), hint: "pendentes + vencidas" },
        {
          title: "Em atraso",
          value: String(stats.overdueCount ?? 0),
          delta: formatDelta(percentDelta(overdueCurrent, overduePrevious)),
          trend: trendFromDelta(percentDelta(overdueCurrent, overduePrevious)),
          hint: "cobranças vencidas",
          tone: Number(stats.overdueCount ?? 0) > 0 ? "critical" : "default",
        },
        { title: "Recebidas", value: formatCurrency(receivedTotal), hint: "somatório de cobranças pagas" },
        { title: "Próx. a vencer", value: String(dueSoon), hint: "vencimento em até 7 dias" },
      ]} />
      </KpiErrorBoundary>

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Receita por mês" description="Somente dados reais do backend.">
          {revenueQuery.isLoading && revenueSafe.data.length === 0 ? (
            <AppPageLoadingState description="Carregando evolução de receita..." />
          ) : revenueQuery.error && revenueSafe.data.length === 0 ? (
            <AppPageErrorState
              description={revenueQuery.error?.message ?? "Falha ao carregar evolução da receita."}
              actionLabel="Tentar novamente"
              onAction={() => void revenueQuery.refetch()}
            />
          ) : !revenueSafe.isValid ? (
            <AppPageEmptyState title="Erro ao renderizar gráfico" description={revenueSafe.reason ?? "Dados inválidos do gráfico."} />
          ) : revenueSafe.data.length === 0 ? (
            <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cobrança" />
          ) : (
            <ChartErrorBoundary context="finances:revenue-chart">
              <ChartContainer className="h-[240px] w-full" config={{ revenue: { label: "Receita" } }}>
                <AreaChart data={revenueSafe.data}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area dataKey="revenue" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.2} />
                </AreaChart>
              </ChartContainer>
            </ChartErrorBoundary>
          )}
        </AppChartPanel>
      </div>

      <TrpcSectionErrorBoundary context="finances:charges-table">
      <AppSectionBlock title="Cobranças e pagamentos" subtitle="Fluxo real: cobrança → pagamento → atualização automática">
        {showChargesInitialLoading ? (
          <AppPageLoadingState description="Carregando cobranças..." />
        ) : showChargesErrorState ? (
          <AppPageErrorState
            description={chargesQuery.error?.message ?? "Falha ao carregar cobranças."}
            actionLabel="Tentar novamente"
            onAction={() => void chargesQuery.refetch()}
          />
        ) : charges.length === 0 ? (
          <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cobrança" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Cliente</th><th>Valor</th><th>Status</th><th>Vencimento</th><th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => {
                  const status = String(charge?.status ?? "").toUpperCase();
                  const isOverdue = status === "OVERDUE";
                  const nextAction = isOverdue ? "Cobrar" : status === "PENDING" ? "Enviar lembrete" : "Marcar como paga";
                  return (
                  <tr key={String(charge?.id)} className={`border-t border-[var(--border-subtle)] ${isOverdue ? "bg-rose-500/10" : ""}`}>
                    <td className="p-3">{String(charge?.customer?.name ?? "—")}</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td><AppStatusBadge label={getOperationalSeverityLabel(getChargeSeverity(charge))} /></td>
                    <td>{charge?.dueDate ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <div className="space-y-2">
                        <AppNextActionCard
                          title="Próxima ação"
                          action={nextAction}
                          reason={isOverdue ? "Cobrança vencida impacta o caixa do dia." : "Ação recomendada para manter previsibilidade de receita."}
                          onExecute={() => {
                            if (nextAction === "Marcar como paga") {
                              void registerPayment(charge);
                              return;
                            }
                            navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`);
                          }}
                        />
                        <AppRowActions actions={[
                          { label: "Registrar pagamento", onClick: () => void registerPayment(charge) },
                          { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>
      </TrpcSectionErrorBoundary>

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
