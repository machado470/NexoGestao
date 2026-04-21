import { useMemo } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import { AppToolbar } from "@/components/app-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";

type PlanName = "FREE" | "STARTER" | "PRO" | "SCALE";

const PLAN_PRICE_ID: Record<PlanName, string | null> = {
  FREE: null,
  STARTER: "price_starter",
  PRO: "price_pro",
  SCALE: "price_scale",
};

const PRICE_CENTS: Record<PlanName, number> = {
  FREE: 0,
  STARTER: 19900,
  PRO: 49900,
  SCALE: 99900,
};

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function statusText(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "TRIALING") return "Trial";
  if (status === "PAST_DUE") return "Em atraso";
  if (status === "CANCELED") return "Cancelado";
  return status;
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const plansQuery = trpc.billing.plans.useQuery(undefined, { retry: false });
  const statusQuery = trpc.billing.status.useQuery(undefined, { retry: false });
  const limitsQuery = trpc.billing.limits.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const plans = useMemo(() => normalizeArrayPayload<any>(plansQuery.data), [plansQuery.data]);
  const currentPlan = String(statusQuery.data?.plan ?? limitsQuery.data?.plan ?? "FREE").toUpperCase() as PlanName;
  const currentStatus = String(statusQuery.data?.status ?? "ACTIVE").toUpperCase();
  const stripeConfigured = readinessQuery.data?.integrations?.stripe === "configured";

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: payload => {
      const checkoutUrl = payload?.url ?? payload?.checkoutUrl;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      toast.success("Plano atualizado.");
      void Promise.all([utils.billing.status.invalidate(), utils.billing.limits.invalidate()]);
    },
    onError: error => toast.error(error.message || "Falha ao iniciar checkout."),
  });

  const cancelMutation = trpc.billing.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Assinatura cancelada para o próximo ciclo.");
      await Promise.all([utils.billing.status.invalidate(), utils.billing.limits.invalidate()]);
    },
    onError: error => toast.error(error.message || "Não foi possível cancelar."),
  });

  const invoices = Array.isArray(statusQuery.data?.events) ? statusQuery.data?.events : [];
  const isLoading = [plansQuery, statusQuery, limitsQuery, readinessQuery].some(query => query.isLoading);
  const hasError = [plansQuery, statusQuery, limitsQuery, readinessQuery].some(query => query.isError);

  const refetchAll = () => {
    void Promise.all([plansQuery.refetch(), statusQuery.refetch(), limitsQuery.refetch(), readinessQuery.refetch()]);
  };

  const upgrade = (plan: PlanName) => {
    if (!stripeConfigured) {
      toast.error("Checkout indisponível sem Stripe configurado.");
      return;
    }
    const priceId = PLAN_PRICE_ID[plan];
    if (!priceId) return;
    checkoutMutation.mutate({
      priceId,
      successUrl: `${window.location.origin}/billing`,
      cancelUrl: `${window.location.origin}/billing`,
    });
  };

  return (
    <PageWrapper title="Billing" subtitle="Assinatura da sua empresa no Nexo: plano, recorrência, cobrança e acesso.">
      <AppPageShell>
      <AppPageHeader title="Billing" description="Assinatura da sua empresa no Nexo: plano, recorrência, cobrança e acesso." />
      <OperationalTopCard
        contextLabel="Gestão da assinatura"
        title="Cobrança da plataforma Nexo"
        description="Esta área é exclusiva para plano, recorrência e acesso da sua empresa ao Nexo."
        chips={
          <>
            <AppStatusBadge label={`Plano ${currentPlan}`} />
            <AppStatusBadge label={`Assinatura ${statusText(currentStatus)}`} />
          </>
        }
        primaryAction={
          <Button onClick={() => upgrade(currentPlan === "STARTER" ? "PRO" : "STARTER")} disabled={checkoutMutation.isPending || !stripeConfigured}>
            <CreditCard className="mr-1.5 h-4 w-4" /> Trocar plano
          </Button>
        }
      />

      <AppToolbar>
        <div className="flex flex-wrap items-center gap-2">
          <AppStatusBadge label={`Plano ${currentPlan}`} />
          <AppStatusBadge label={`Assinatura ${statusText(currentStatus)}`} />
          <AppStatusBadge label={stripeConfigured ? "Pagamento automático ativo" : "Pagamento automático pendente"} />
        </div>
        <Button onClick={() => upgrade(currentPlan === "STARTER" ? "PRO" : "STARTER")} disabled={checkoutMutation.isPending || !stripeConfigured}>
          <CreditCard className="mr-1.5 h-4 w-4" /> Trocar plano
        </Button>
      </AppToolbar>

      {isLoading ? <AppPageLoadingState description="Montando visão de assinatura e recorrência..." /> : null}
      {hasError ? <AppPageErrorState description="Não foi possível carregar billing neste momento." onAction={refetchAll} /> : null}

      {!isLoading && !hasError ? (
        <>
          {plans.length === 0 ? <AppPageEmptyState title="Sem catálogo de planos" description="Nenhum plano disponível para este ambiente. Verifique configuração de billing." /> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <AppSectionBlock title="1) Plano atual" subtitle="Quanto está pagando, por que e quais limites principais estão incluídos.">
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>Plano atual: <strong className="text-[var(--text-primary)]">{currentPlan}</strong></p>
                <p>Valor base: <strong className="text-[var(--text-primary)]">{brl(PRICE_CENTS[currentPlan])}/mês</strong></p>
                <p>Benefício-chave: previsibilidade de capacidade e acesso do time.</p>
              </div>
              <div className="mt-3"><Button size="sm" variant="outline" onClick={() => upgrade("PRO")}>Trocar plano</Button></div>
            </AppSectionBlock>

            <AppSectionBlock title="2) Assinatura" subtitle="Estado atual, renovação e consequência de status.">
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>Status: <AppStatusBadge label={statusText(currentStatus)} /></p>
                <p>Renovação: <strong className="text-[var(--text-primary)]">{limitsQuery.data?.trial?.endsAt ? new Date(limitsQuery.data.trial.endsAt).toLocaleDateString("pt-BR") : "Ciclo não informado"}</strong></p>
                <p>Se houver falha de pagamento, o acesso pode entrar em restrição até regularização.</p>
              </div>
            </AppSectionBlock>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <AppSectionBlock title="3) Cobrança recorrente / histórico" subtitle="Faturas por período com status claro." className="xl:col-span-2">
              <AppDataTable>
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      <th className="px-3 py-2">Período/Data</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 8).map((event: any, index: number) => (
                      <tr key={`${String(event?.id ?? "invoice")}-${index}`} className="border-b border-[var(--border-subtle)]/60">
                        <td className="px-3 py-2">{event?.createdAt ? new Date(event.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="px-3 py-2 text-[var(--text-primary)]">{String(event?.description ?? event?.type ?? "Cobrança da plataforma")}</td>
                        <td className="px-3 py-2">{event?.amountCents ? brl(Number(event.amountCents)) : "—"}</td>
                        <td className="px-3 py-2"><AppStatusBadge label={String(event?.status ?? "Registrado")} /></td>
                      </tr>
                    ))}
                    {invoices.length === 0 ? (
                      <tr><td className="px-3 py-3 text-[var(--text-muted)]" colSpan={4}>Sem histórico de faturas para este ambiente.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </AppDataTable>
            </AppSectionBlock>

            <AppSectionBlock title="4) Método de pagamento e ações" subtitle="Tudo que precisa para manter a conta ativa e sem surpresa.">
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>Método atual: <strong className="text-[var(--text-primary)]">{stripeConfigured ? "Cartão via Stripe" : "Não configurado"}</strong></p>
                <p>Estado da conta: <AppStatusBadge label={statusText(currentStatus)} /></p>
              </div>
              <div className="mt-3 space-y-2">
                <Button size="sm" className="w-full" onClick={() => upgrade("PRO")} disabled={!stripeConfigured || checkoutMutation.isPending}>Trocar plano</Button>
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/settings?section=integracoes")}>Atualizar pagamento</Button>
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/billing")}>Ver histórico</Button>
                <Button size="sm" variant="outline" className="w-full" disabled={cancelMutation.isPending || currentPlan === "FREE"} onClick={() => cancelMutation.mutate()}>{cancelMutation.isPending ? "Cancelando..." : "Cancelar assinatura"}</Button>
              </div>
            </AppSectionBlock>
          </div>

          <AppSectionBlock title="5) Planos disponíveis" subtitle="Upgrade/downgrade com clareza de valor e impacto.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan: any) => {
                const name = String(plan?.name ?? "FREE").toUpperCase() as PlanName;
                const isCurrent = name === currentPlan;
                return (
                  <div key={name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{brl(PRICE_CENTS[name])}/mês</p>
                    <p className="mt-2"><AppStatusBadge label={isCurrent ? "Plano atual" : "Disponível"} /></p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline" disabled={isCurrent || name === "FREE"} onClick={() => upgrade(name)}>Escolher</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </AppSectionBlock>
        </>
      ) : null}
      </AppPageShell>
    </PageWrapper>
  );
}
