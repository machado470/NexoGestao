import { useMemo } from "react";
import { CheckCircle2, CreditCard } from "lucide-react";
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

const PLAN_META: Record<PlanName, { title: string; priceCents: number; description: string; benefits: string[] }> = {
  FREE: {
    title: "Essencial",
    priceCents: 0,
    description: "Base para iniciar operação auditável sem perder rastreabilidade.",
    benefits: ["1 usuário", "Clientes e agenda", "Timeline básica", "Suporte padrão"],
  },
  STARTER: {
    title: "Starter",
    priceCents: 19900,
    description: "Para times em estruturação com foco em execução previsível.",
    benefits: ["Até 5 usuários", "Fluxo Cliente → O.S.", "Financeiro operacional", "WhatsApp contextual"],
  },
  PRO: {
    title: "Pro",
    priceCents: 49900,
    description: "Escala com governança e leitura por exceção no dia a dia.",
    benefits: ["Até 20 usuários", "Risco e governança", "Automação de cobrança", "Relatórios executivos", "Suporte prioritário"],
  },
  SCALE: {
    title: "Scale",
    priceCents: 99900,
    description: "Operação multi-equipe com controle fino, contexto e performance.",
    benefits: ["Usuários ilimitados", "SLA avançado", "Integrações ampliadas", "Playbooks operacionais", "Acompanhamento dedicado"],
  },
};

function brl(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueCents / 100);
}

function statusText(status: string) {
  if (status === "ACTIVE") return "Ativo";
  if (status === "TRIALING") return "Trial";
  if (status === "PAST_DUE") return "Em atraso";
  if (status === "CANCELED") return "Cancelado";
  return status;
}

function safePlanName(value: unknown): PlanName {
  const candidate = String(value ?? "FREE").toUpperCase();
  return ["FREE", "STARTER", "PRO", "SCALE"].includes(candidate) ? (candidate as PlanName) : "FREE";
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const plansQuery = trpc.billing.plans.useQuery(undefined, { retry: false });
  const statusQuery = trpc.billing.status.useQuery(undefined, { retry: false });
  const limitsQuery = trpc.billing.limits.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const plans = useMemo(() => normalizeArrayPayload<any>(plansQuery.data), [plansQuery.data]);
  const currentPlan = safePlanName(statusQuery.data?.plan ?? limitsQuery.data?.plan);
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
    <PageWrapper title="Planos" subtitle="Assinatura da sua empresa no Nexo: plano, recorrência, cobrança e acesso.">
      <AppPageShell>
        <AppPageHeader title="Planos" description="Gerencie assinatura, limites e acesso da plataforma sem misturar com o financeiro operacional." />
        <OperationalTopCard
          contextLabel="Gestão de assinatura"
          title="Planos da plataforma Nexo"
          description="Aqui você decide capacidade, limites e evolução da sua operação no produto."
          chips={
            <>
              <AppStatusBadge label={`Plano ${PLAN_META[currentPlan].title}`} />
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
            <AppStatusBadge label={`Plano atual: ${PLAN_META[currentPlan].title}`} />
            <AppStatusBadge label={`Status: ${statusText(currentStatus)}`} />
            <AppStatusBadge label={stripeConfigured ? "Pagamento automático ativo" : "Pagamento automático pendente"} />
          </div>
          <Button variant="outline" onClick={() => navigate("/settings?section=integracoes")}>Gerenciar pagamento</Button>
        </AppToolbar>

        {isLoading ? <AppPageLoadingState description="Montando visão de planos, assinatura e recorrência..." /> : null}
        {hasError ? <AppPageErrorState description="Não foi possível carregar Planos neste momento." onAction={refetchAll} /> : null}

        {!isLoading && !hasError ? (
          <>
            {plans.length === 0 ? <AppPageEmptyState title="Sem catálogo de planos" description="Nenhum plano disponível para este ambiente. Verifique a configuração de cobrança." /> : null}

            <div className="grid gap-4 xl:grid-cols-3">
              <AppSectionBlock title="Plano atual" subtitle="Valor, status e impacto imediato no acesso da operação." className="xl:col-span-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-sm text-[var(--text-secondary)]">
                    <p>
                      Plano ativo: <strong className="text-[var(--text-primary)]">{PLAN_META[currentPlan].title}</strong>
                    </p>
                    <p className="mt-1">
                      Valor base: <strong className="text-[var(--text-primary)]">{brl(PLAN_META[currentPlan].priceCents)}/mês</strong>
                    </p>
                    <p className="mt-1">Descrição: {PLAN_META[currentPlan].description}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-sm text-[var(--text-secondary)]">
                    <p>
                      Status da assinatura: <AppStatusBadge label={statusText(currentStatus)} />
                    </p>
                    <p className="mt-1">
                      Renovação: <strong className="text-[var(--text-primary)]">{limitsQuery.data?.trial?.endsAt ? new Date(limitsQuery.data.trial.endsAt).toLocaleDateString("pt-BR") : "Ciclo não informado"}</strong>
                    </p>
                    <p className="mt-1">Impacto: atrasos de pagamento podem restringir acesso operacional.</p>
                  </div>
                </div>
              </AppSectionBlock>

              <AppSectionBlock title="Ações da assinatura" subtitle="Operações críticas para manter acesso e previsibilidade.">
                <div className="space-y-2">
                  <Button size="sm" className="w-full" onClick={() => upgrade("PRO")} disabled={!stripeConfigured || checkoutMutation.isPending}>Trocar para Pro</Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/settings?section=integracoes")}>Atualizar método de pagamento</Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/billing")}>Ver histórico</Button>
                  <Button size="sm" variant="outline" className="w-full" disabled={cancelMutation.isPending || currentPlan === "FREE"} onClick={() => cancelMutation.mutate()}>
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar assinatura"}
                  </Button>
                </div>
              </AppSectionBlock>
            </div>

            <AppSectionBlock title="Planos disponíveis" subtitle="Comparativo claro para upgrade/downgrade com posicionamento premium.">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(plans.length > 0 ? plans : Object.keys(PLAN_META).map(name => ({ name }))).map((plan: any) => {
                  const name = safePlanName(plan?.name);
                  const meta = PLAN_META[name];
                  const isCurrent = name === currentPlan;
                  const badge = isCurrent ? "Plano atual" : name === "PRO" ? "Mais escolhido" : name === "SCALE" ? "Recomendado" : "Disponível";
                  return (
                    <article key={name} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-[var(--text-primary)]">{meta.title}</p>
                          <p className="text-xs text-[var(--text-muted)]">{meta.description}</p>
                        </div>
                        <AppStatusBadge label={badge} />
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{brl(meta.priceCents)}</p>
                      <p className="text-xs text-[var(--text-muted)]">por mês</p>

                      <ul className="mt-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
                        {meta.benefits.slice(0, 6).map(item => (
                          <li key={item} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        size="sm"
                        className="mt-4 w-full"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || name === "FREE"}
                        onClick={() => upgrade(name)}
                      >
                        {isCurrent ? "Plano ativo" : "Escolher plano"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </AppSectionBlock>

            <AppSectionBlock title="Histórico de cobrança da plataforma" subtitle="Faturas e eventos da assinatura com status rastreável.">
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
          </>
        ) : null}
      </AppPageShell>
    </PageWrapper>
  );
}
