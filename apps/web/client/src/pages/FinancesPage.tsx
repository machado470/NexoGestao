import { useMemo, useState } from "react";
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
  AppEmptyState,
  AppKpiRow,
  AppLoadingState,
  AppRowActions,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { invalidateOperationalGraph } from "@/lib/operationalConsistency";
import { getChargeSeverity, getOperationalSeverityLabel } from "@/lib/operations/operational-intelligence";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function FinancesPage() {
  const [, navigate] = useLocation();
  const [openCreate, setOpenCreate] = useState(false);
  const utils = trpc.useUtils();

  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false });
  const statsQuery = trpc.finance.charges.stats.useQuery(undefined, { retry: false });
  const revenueQuery = trpc.finance.charges.revenueByMonth.useQuery(undefined, { retry: false });
  const payCharge = trpc.finance.charges.pay.useMutation();

  const charges = useMemo(() => normalizeArrayPayload<any>(chargesQuery.data), [chargesQuery.data]);
  const stats = useMemo(() => normalizeObjectPayload<any>(statsQuery.data) ?? {}, [statsQuery.data]);

  const revenueData = useMemo(() => {
    return normalizeArrayPayload<any>(revenueQuery.data).map((item) => ({
      label: String(item?.month ?? item?.label ?? "Mês"),
      revenue: Number(item?.totalRevenueCents ?? item?.revenueCents ?? item?.amountCents ?? 0) / 100,
    }));
  }, [revenueQuery.data]);

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

      <AppKpiRow items={[
        { label: "Cobranças", value: String(charges.length), trend: 0, context: "carteira total" },
        { label: "Pendentes", value: String(stats.pendingCount ?? 0), trend: 0, context: "aguardando pagamento" },
        { label: "Vencidas", value: String(stats.overdueCount ?? 0), trend: 0, context: "prioridade de cobrança" },
        { label: "Recebido", value: formatCurrency(Number(stats.paidAmountCents ?? 0)), trend: 0, context: "valor liquidado" },
      ]} />

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Receita por mês" description="Somente dados reais do backend.">
          {revenueQuery.isLoading ? (
            <AppLoadingState rows={2} />
          ) : revenueData.length === 0 ? (
            <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cobrança" />
          ) : (
            <ChartContainer className="h-[240px] w-full" config={{ revenue: { label: "Receita" } }}>
              <AreaChart data={revenueData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="revenue" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.2} />
              </AreaChart>
            </ChartContainer>
          )}
        </AppChartPanel>
      </div>

      <AppSectionBlock title="Cobranças e pagamentos" subtitle="Fluxo real: cobrança → pagamento → atualização automática">
        {chargesQuery.isLoading ? (
          <AppLoadingState rows={4} />
        ) : charges.length === 0 ? (
          <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: criar cobrança" />
        ) : (
          <AppDataTable>
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Cliente</th><th>Valor</th><th>Status</th><th>Vencimento</th><th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={String(charge?.id)} className="border-t border-[var(--border-subtle)]">
                    <td className="p-3">{String(charge?.customer?.name ?? "—")}</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td><AppStatusBadge label={getOperationalSeverityLabel(getChargeSeverity(charge))} /></td>
                    <td>{charge?.dueDate ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <AppRowActions actions={[
                        { label: "Registrar pagamento", onClick: () => void registerPayment(charge) },
                        { label: "Enviar WhatsApp", onClick: () => navigate(`/whatsapp?customerId=${charge.customerId}&chargeId=${charge.id}`) },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

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
