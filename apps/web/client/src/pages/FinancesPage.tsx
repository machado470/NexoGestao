import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { trpc } from "@/lib/trpc";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { Button } from "@/components/design-system";
import {
  AppChartPanel,
  AppDataTable,
  AppKpiRow,
  AppListBlock,
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSecondaryTabs,
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
  const [activeTab, setActiveTab] = useState<"overview" | "pending" | "overdue" | "paid" | "reports">("overview");
  const utils = trpc.useUtils();

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const statsQuery = trpc.finance.charges.stats.useQuery(undefined, { retry: false });
  const revenueQuery = trpc.finance.charges.revenueByMonth.useQuery(undefined, { retry: false });
  const payCharge = trpc.finance.charges.pay.useMutation();

  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const filteredCharges = useMemo(() => {
    if (activeTab === "overview" || activeTab === "reports") return charges;
    if (activeTab === "pending") return charges.filter(item => String(item?.status ?? "").toUpperCase() === "PENDING");
    if (activeTab === "overdue") return charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE");
    return charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID");
  }, [activeTab, charges]);
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
  const statusDistribution = useMemo(
    () => ([
      { label: "Pendentes", value: charges.filter(item => String(item?.status ?? "").toUpperCase() === "PENDING").length },
      { label: "Vencidas", value: charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE").length },
      { label: "Pagas", value: charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID").length },
    ]),
    [charges]
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
  const dueToday = charges.filter((item) => {
    const status = String(item?.status ?? "").toUpperCase();
    const due = safeDate(item?.dueDate);
    if (status !== "PENDING" || !due) return false;
    const now = new Date();
    return due.toDateString() === now.toDateString();
  }).length;
  const clientesPossivelAtraso = new Set(
    charges
      .filter((item) => String(item?.status ?? "").toUpperCase() === "PENDING" && Number(item?.reminderCount ?? 0) >= 2)
      .map((item) => String(item?.customerId ?? ""))
      .filter(Boolean)
  ).size;
  const cobrancasRecentes = charges.filter((item) => {
    const createdAt = safeDate(item?.createdAt);
    if (!createdAt) return false;
    return Date.now() - createdAt.getTime() <= 1000 * 60 * 60 * 24 * 3;
  }).length;
  const recebivelHoje = charges
    .filter((item) => {
      const status = String(item?.status ?? "").toUpperCase();
      const due = safeDate(item?.dueDate);
      if (status !== "PENDING" || !due) return false;
      const now = new Date();
      return due <= now;
    })
    .reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
  const cobrancasAbertas = charges
    .filter((item) => String(item?.status ?? "").toUpperCase() === "PENDING")
    .slice(0, 3)
    .map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} · ${formatCurrency(Number(item?.amountCents ?? 0))}`,
      subtitle: `Aberta · vence ${item?.dueDate ? new Date(String(item?.dueDate)).toLocaleDateString("pt-BR") : "sem data"}`,
      action: <Button size="sm" variant="outline" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}&chargeId=${item?.id}`)}>Cobrar</Button>,
    }));
  const cobrancasVencidas = charges
    .filter((item) => String(item?.status ?? "").toUpperCase() === "OVERDUE")
    .slice(0, 3)
    .map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} · ${formatCurrency(Number(item?.amountCents ?? 0))}`,
      subtitle: `Vencida em ${item?.dueDate ? new Date(String(item?.dueDate)).toLocaleDateString("pt-BR") : "data não informada"}`,
      action: <Button size="sm" variant="outline" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}&chargeId=${item?.id}`)}>Resolver</Button>,
    }));
  const cobrancasProximas = charges
    .filter((item) => {
      const status = String(item?.status ?? "").toUpperCase();
      const due = safeDate(item?.dueDate);
      if (status !== "PENDING" || !due) return false;
      const delta = due.getTime() - Date.now();
      return delta > 0 && delta <= 1000 * 60 * 60 * 24 * 7;
    })
    .slice(0, 2)
    .map((item) => ({
      title: `${String(item?.customer?.name ?? "Cliente")} · ${formatCurrency(Number(item?.amountCents ?? 0))}`,
      subtitle: `Próxima · vence ${item?.dueDate ? new Date(String(item?.dueDate)).toLocaleDateString("pt-BR") : "sem data"}`,
      action: <Button size="sm" variant="outline" onClick={() => navigate(`/whatsapp?customerId=${item?.customerId}&chargeId=${item?.id}`)}>Lembrar</Button>,
    }));

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
    <PageWrapper title="Financeiro" subtitle="Dinheiro em movimento: cobrança, atraso, recebimento e decisão rápida.">
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
        { title: "Recebidas", value: String(charges.filter(item => String(item?.status ?? "").toUpperCase() === "PAID").length), hint: "quantidade de cobranças pagas" },
      ]} />
      </KpiErrorBoundary>

      <AppSecondaryTabs
        items={[
          { value: "overview", label: "Visão geral" },
          { value: "pending", label: "Pendentes" },
          { value: "overdue", label: "Vencidas" },
          { value: "paid", label: "Pagas" },
          { value: "reports", label: "Relatórios" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {(activeTab === "overview" || activeTab === "overdue" || activeTab === "pending") ? (
        <AppSectionBlock
        title="Dinheiro em risco"
        subtitle="Bloco principal: atraso e vencimento que ameaçam o caixa imediato"
        className="border-rose-500/20 bg-rose-500/5"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {String(stats.overdueCount ?? 0)} vencidas · {dueToday} vencendo hoje · {dueSoon} em até 7 dias · {clientesPossivelAtraso} clientes com sinal de atraso.
          </p>
          <ActionFeedbackButton state="idle" idleLabel="Cobrar agora" onClick={() => navigate("/whatsapp?context=overdue-charges")} />
        </div>
        <AppListBlock
          items={[...cobrancasVencidas, ...cobrancasAbertas, ...cobrancasProximas].slice(0, 6).length > 0
            ? [...cobrancasVencidas, ...cobrancasAbertas, ...cobrancasProximas].slice(0, 6)
            : [{ title: "Sem cobranças na fila", subtitle: "Crie cobrança para alimentar o fluxo de receita.", action: <Button size="sm" variant="outline" onClick={() => setOpenCreate(true)}>Criar cobrança</Button> }]}
        />
      </AppSectionBlock>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
        <AppChartPanel title="Receita por mês" description="Evolução mensal para confirmar tendência de entrada.">
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
            <AppPageEmptyState title="Ainda sem histórico mensal" description="Use os cards ao lado para gerar entradas hoje e alimentar a curva real." />
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
        <AppChartPanel title="Distribuição por status" description="Saúde da carteira entre pendências, atraso e recebimento.">
          <ChartContainer className="h-[240px] w-full" config={{ value: { label: "Cobranças" } }}>
            <BarChart data={statusDistribution}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </AppChartPanel>
        </div>
        <div className="xl:col-span-4">
        <AppNextActionCard
          title="Entradas rápidas"
          description={`${cobrancasRecentes} cobranças abertas nos últimos 3 dias · potencial de ${formatCurrency(recebivelHoje)} para receber ainda hoje.`}
          severity={recebivelHoje > 0 ? "high" : "medium"}
          metadata="oportunidade de recebimento"
          action={{ label: "Enviar cobrança", onClick: () => setOpenCreate(true) }}
        />
        </div>
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
        ) : filteredCharges.length === 0 ? (
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
                {filteredCharges.map((charge) => {
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
                          description={isOverdue ? "Cobrança vencida impacta o caixa do dia." : "Ação recomendada para manter previsibilidade de receita."}
                          severity={isOverdue ? "critical" : status === "PENDING" ? "high" : "medium"}
                          metadata="cobrança"
                          action={{
                            label: nextAction,
                            onClick: () => {
                              if (nextAction === "Marcar como paga") {
                                void registerPayment(charge);
                                return;
                              }
                              navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`);
                            },
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
