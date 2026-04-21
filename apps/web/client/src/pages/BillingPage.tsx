import { useMemo } from "react";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/design-system";
import { getQueryUiState, normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppDataTable,
  AppKpiRow,
  AppListBlock,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type PlanName = "STARTER" | "PRO" | "SCALE" | "FREE";

const PLAN_PRICE_ID: Record<PlanName, string | null> = {
  FREE: null,
  STARTER: "price_starter",
  PRO: "price_pro",
  SCALE: "price_scale",
};

const PLAN_BASE_PRICE_CENTS: Record<PlanName, number> = {
  FREE: 0,
  STARTER: 19900,
  PRO: 49900,
  SCALE: 99900,
};

const PLAN_GAIN: Record<PlanName, string> = {
  FREE: "Para começar a testar o fluxo.",
  STARTER: "Estrutura inicial para operar sem perder cobranças.",
  PRO: "Escala comercial com mais capacidade e previsibilidade.",
  SCALE: "Máxima escala para operação com múltiplos times.",
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

export default function BillingPage() {
  const [, navigate] = useLocation();
  const { track } = useProductAnalytics();
  const plansQuery = trpc.billing.plans.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const statusQuery = trpc.billing.status.useQuery(undefined, {
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  const limitsQuery = trpc.billing.limits.useQuery(undefined, {
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, {
    retry: 1,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: (payload) => {
      const checkoutUrl = payload?.url ?? payload?.checkoutUrl;
      track("checkout_completed", {
        screen: "billing",
        hasRedirect: Boolean(checkoutUrl),
      });
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      toast.success("Plano atualizado com sucesso.");
      void Promise.all([
        utils.billing.status.invalidate(),
        utils.billing.limits.invalidate(),
      ]);
    },
    onError: (error) => {
      const message = (error.message || "").toLowerCase();
      if (
        message.includes("integração stripe não configurada") ||
        message.includes("integration_not_configured")
      ) {
        toast.error(
          "Checkout indisponível: integração Stripe ainda não foi configurada neste ambiente."
        );
        return;
      }
      toast.error(error.message || "Falha ao iniciar checkout.");
    },
  });

  const cancelMutation = trpc.billing.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Assinatura cancelada. Acesso permanece até o fim do ciclo.");
      await Promise.all([
        utils.billing.status.invalidate(),
        utils.billing.limits.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível cancelar agora.");
    },
  });

  const status = statusQuery.data;
  const limits = limitsQuery.data;
  const plans = useMemo(
    () => normalizeArrayPayload<any>(plansQuery.data),
    [plansQuery.data]
  );

  const hasAnyData = plans.length > 0 || Boolean(status) || Boolean(limits);
  const queryState = getQueryUiState(
    [plansQuery, statusQuery, limitsQuery],
    hasAnyData
  );

  const usageItems = [
    { label: "Clientes", usage: limits?.usage?.customers },
    { label: "Agendamentos", usage: limits?.usage?.appointments },
    { label: "Mensagens", usage: limits?.usage?.messages },
    { label: "Ordens de serviço", usage: limits?.usage?.serviceOrders },
    { label: "Usuários", usage: limits?.usage?.users },
  ];

  const currentPlan = String(status?.plan ?? limits?.plan ?? "FREE").toUpperCase();
  const subscriptionStatus = String(status?.status ?? "ACTIVE").toUpperCase();
  const subscriptionStatusLabel =
    subscriptionStatus === "ACTIVE"
      ? "Ativo"
      : subscriptionStatus === "TRIALING"
        ? "Trial"
        : subscriptionStatus === "PAST_DUE"
          ? "Em atraso"
          : subscriptionStatus === "CANCELED"
            ? "Cancelado"
            : subscriptionStatus;
  const stripeConfigured = readinessQuery.data?.integrations?.stripe === "configured";
  const isTrial = Boolean(limits?.trial?.isTrial);
  const blockedItems = usageItems.filter((item) => {
    const used = Number(item.usage?.used ?? 0);
    const limit = Number(item.usage?.limit ?? 0);
    if (item.usage?.unlimited) return false;
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return false;
    return used >= limit;
  });

  const handleUpgrade = async (planName: PlanName) => {
    const priceId = PLAN_PRICE_ID[planName];
    if (!priceId) return;
    if (!stripeConfigured) {
      toast.error("Stripe indisponível neste ambiente. Use cobrança manual em Finanças.");
      return;
    }
    track("checkout_started", {
      screen: "billing",
      entryPoint: "plan_card",
      targetPlan: planName,
    });
    await checkoutMutation.mutateAsync({
      priceId,
      successUrl: `${window.location.origin}/billing`,
      cancelUrl: `${window.location.origin}/billing`,
    });
  };

  return (
    <PageWrapper
      title="Planos"
      subtitle="Como sua empresa paga para usar o Nexo, com visão simples e previsível."
    >
      <OperationalTopCard
        contextLabel="Direção de assinatura"
        title="Planos e cobrança do Nexo"
        description="Esta área controla a assinatura da sua empresa no Nexo (não confundir com o Financeiro dos seus clientes)."
        chips={(
          <>
            <AppStatusBadge label={`Plano ${currentPlan}`} />
            <AppStatusBadge label={`Assinatura ${subscriptionStatusLabel}`} />
            <AppStatusBadge label={`Integrações prontas ${stripeConfigured ? "1/1" : "0/1"}`} />
          </>
        )}
        primaryAction={
          <Button
            type="button"
            disabled={checkoutMutation.isPending || !stripeConfigured}
            onClick={() => void handleUpgrade(blockedItems.length > 0 ? "PRO" : "STARTER")}
          >
            {checkoutMutation.isPending ? "Processando..." : "Alterar plano"}
          </Button>
        }
      />

      <AppKpiRow
        items={[
          { title: "Plano atual", value: currentPlan, hint: "uso do Nexo" },
          {
            title: "Valor",
            value: `${formatCurrency(PLAN_BASE_PRICE_CENTS[currentPlan as PlanName] ?? 0)}/mês`,
            hint: "referência do plano",
          },
          { title: "Status", value: subscriptionStatusLabel, hint: "estado da assinatura" },
          {
            title: "Próxima cobrança",
            value: limits?.trial?.endsAt
              ? new Date(limits.trial.endsAt).toLocaleDateString("pt-BR")
              : "Não informada",
            hint: "próximo marco de assinatura",
          },
        ]}
        gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
      />

      {!stripeConfigured ? (
        <AppSectionBlock title="Atenção" subtitle="Checkout online indisponível no ambiente" compact>
          <p className="text-sm text-[var(--text-secondary)]">
            Stripe não configurado. Alternativa segura: registrar cobranças e pagamentos no Financeiro.
          </p>
        </AppSectionBlock>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <AppSectionBlock title="Plano atual e limites" subtitle="Capacidade operacional disponível" className="xl:col-span-2">
          <AppDataTable>
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-3 py-2">Recurso</th>
                  <th className="px-3 py-2">Uso</th>
                  <th className="px-3 py-2">Limite</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {usageItems.map((item) => {
                  const used = Number(item.usage?.used ?? 0);
                  const limit = Number(item.usage?.limit ?? 0);
                  const unlimited = Boolean(item.usage?.unlimited);
                  const atLimit = !unlimited && Number.isFinite(limit) && limit > 0 && used >= limit;
                  return (
                    <tr key={item.label} className="border-b border-[var(--border-subtle)]/60">
                      <td className="px-3 py-2 text-[var(--text-primary)]">{item.label}</td>
                      <td className="px-3 py-2">{item.usage?.used ?? "—"}</td>
                      <td className="px-3 py-2">{unlimited ? "∞" : item.usage?.limit ?? "—"}</td>
                      <td className="px-3 py-2"><AppStatusBadge label={atLimit ? "No limite" : "Disponível"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock title="Forma de pagamento e ações" subtitle="Gestão direta da assinatura" compact>
          <AppListBlock
            compact
            minItems={4}
            items={[
              {
                title: "Forma de pagamento",
                subtitle: stripeConfigured ? "Cartão via Stripe conectado." : "Checkout indisponível neste ambiente.",
              },
              {
                title: "Trocar plano",
                subtitle: "Ajuste capacidade sem interromper a operação.",
                action: <Button type="button" variant="outline" onClick={() => void handleUpgrade("PRO")}>Trocar</Button>,
              },
              {
                title: "Atualizar pagamento",
                subtitle: stripeConfigured ? "Método ativo no Stripe." : "Checkout indisponível sem Stripe.",
                action: (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!stripeConfigured}
                    onClick={() => navigate("/settings?section=integracoes")}
                  >
                    Atualizar
                  </Button>
                ),
              },
              {
                title: "Ver histórico",
                subtitle: "Consulte faturas e rastreie status de cobrança.",
                action: (
                  <Button type="button" variant="outline" onClick={() => navigate("/finances?view=history")}>
                    Histórico
                  </Button>
                ),
              },
              {
                title: "Cancelar assinatura",
                subtitle: "Acesso mantém até o fim do ciclo atual.",
                action: (
                  <Button type="button" variant="outline" disabled={currentPlan === "FREE" || cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar"}
                  </Button>
                ),
              },
            ]}
          />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Histórico de cobranças e faturas" subtitle="Registro para conferência rápida" compact>
        <AppDataTable>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(status?.events) ? status.events : []).slice(0, 6).map((event: any, index: number) => (
                <tr key={`${event?.id ?? event?.createdAt ?? index}`} className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-2">{event?.createdAt ? new Date(event.createdAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)]">{String(event?.description ?? event?.type ?? "Cobrança de assinatura")}</td>
                  <td className="px-3 py-2">{event?.amountCents ? formatCurrency(Number(event.amountCents)) : "—"}</td>
                  <td className="px-3 py-2"><AppStatusBadge label={String(event?.status ?? "Registrado")} /></td>
                </tr>
              ))}
              {!Array.isArray(status?.events) || status.events.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-[var(--text-muted)]" colSpan={4}>Ainda não há histórico disponível neste ambiente.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>

      <AppSectionBlock title="Planos disponíveis" subtitle="Comparação para evolução da assinatura" compact>
        {queryState.shouldBlockForError ? (
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Falha ao carregar billing"
            description="Não foi possível carregar planos e status agora."
            action={{
              label: "Tentar novamente",
              onClick: () => {
                void Promise.all([
                  plansQuery.refetch(),
                  statusQuery.refetch(),
                  limitsQuery.refetch(),
                ]);
              },
            }}
          />
        ) : queryState.isInitialLoading ? (
          <div className="p-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando status de assinatura...
          </div>
        ) : (
          <AppDataTable>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-3 py-2">Plano</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Ganho operacional</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan: any) => {
                  const name = String(plan.name ?? "FREE").toUpperCase() as PlanName;
                  const isCurrent = name === currentPlan;
                  return (
                    <tr key={name} className="border-b border-[var(--border-subtle)]/60">
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{name}</td>
                      <td className="px-3 py-2">{formatCurrency(PLAN_BASE_PRICE_CENTS[name] ?? 0)}/mês</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{PLAN_GAIN[name]}</td>
                      <td className="px-3 py-2"><AppStatusBadge label={isCurrent ? "Em uso" : "Disponível"} /></td>
                      <td className="px-3 py-2">
                        {isCurrent ? (
                          <span className="text-xs text-[var(--text-muted)]">Plano atual</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1"
                            disabled={checkoutMutation.isPending || !stripeConfigured || name === "FREE"}
                            onClick={() => void handleUpgrade(name)}
                          >
                            <CreditCard className="h-3.5 w-3.5" /> Escolher
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AppDataTable>
        )}
      </AppSectionBlock>

      {(isTrial || blockedItems.length > 0) ? (
        <AppSectionBlock title="Risco comercial" subtitle="Pontos que podem bloquear expansão" compact>
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            {isTrial ? (
              <p className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4" />
                Trial ativo até {new Date(limits?.trial?.endsAt).toLocaleDateString("pt-BR")}.
              </p>
            ) : null}
            {blockedItems.length > 0 ? (
              <p>Limites atingidos em: {blockedItems.map((item) => item.label).join(", ")}.</p>
            ) : null}
          </div>
        </AppSectionBlock>
      ) : null}
    </PageWrapper>
  );
}
