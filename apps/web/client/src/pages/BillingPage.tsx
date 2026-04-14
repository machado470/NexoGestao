import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { SmartPage, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/design-system";
import { getQueryUiState, normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";

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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents ?? 0) / 100);
}

function planTone(currentPlan: string, plan: string) {
  return currentPlan === plan
    ? "border-orange-400 bg-orange-50/70 dark:border-orange-500/60 dark:bg-orange-900/20"
    : "border-white/10 bg-[var(--nexo-surface-2)]";
}

const PLAN_GAIN: Record<PlanName, string> = {
  FREE: "Para começar a testar o fluxo.",
  STARTER: "Estrutura inicial para operar sem perder cobranças.",
  PRO: "Escala comercial com mais capacidade e previsibilidade.",
  SCALE: "Máxima escala para operação com múltiplos times.",
};

export default function BillingPage() {
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

  const hasExceededUsage = usageItems.some((item) => {
    const used = Number(item.usage?.used ?? 0);
    const limit = Number(item.usage?.limit ?? 0);
    if (item.usage?.unlimited) return false;
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return false;
    return used >= limit;
  });

  const currentPlan = String(status?.plan ?? limits?.plan ?? "FREE").toUpperCase();
  const subscriptionStatus = String(status?.status ?? "ACTIVE").toUpperCase();
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
    track("upgrade_click", {
      screen: "billing",
      targetPlan: planName,
      currentPlan,
      blockedByLimit: blockedItems.map((item) => item.label),
    });
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

  const heroPrimaryAction: PlanName = blockedItems.length > 0 ? "PRO" : "STARTER";

  return (
    <PageWrapper
      title="Assinatura e plano"
      subtitle="Controle plano, limites e upgrade com fluxo orientado a receita sem sair da operação."
    >
      <OperationalTopCard
        contextLabel="Direção comercial"
        title="Plano e faturamento"
        description="Controle trial, limites e upgrade com fluxo orientado a receita e sem sair da operação."
        chips={
          <>
            <span className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">
              Plano: {currentPlan}
            </span>
            <span className="rounded-full border px-3 py-1 text-xs text-[var(--text-secondary)]">
              Limites em risco: {blockedItems.length}
            </span>
          </>
        }
        primaryAction={
          <Button
            type="button"
            disabled={checkoutMutation.isPending || !stripeConfigured}
            onClick={() => void handleUpgrade(heroPrimaryAction)}
          >
            {checkoutMutation.isPending ? "Processando..." : "Fazer upgrade agora"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="nexo-card-kpi p-4"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Plano atual</p><p className="relative mt-2 text-2xl font-bold tracking-tight">{currentPlan}</p></div>
        <div className="nexo-card-kpi p-4"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Limites em risco</p><p className="relative mt-2 text-2xl font-bold tracking-tight">{blockedItems.length}</p></div>
        <div className="nexo-card-kpi p-4"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Modo</p><p className="relative mt-2 text-2xl font-bold tracking-tight">{isTrial ? "Trial" : "Ativo"}</p></div>
        <div className="nexo-card-kpi p-4"><p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Próxima ação</p><p className="relative mt-2 text-xl font-bold tracking-tight">{blockedItems.length > 0 ? "Upgrade urgente" : "Revisar limites"}</p></div>
      </div>
      {!stripeConfigured ? (
        <SurfaceSection className="border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-600/50 dark:bg-amber-900/20 dark:text-amber-200">
          Checkout online indisponível: Stripe não configurado. Alternativa segura: registre cobranças e pagamentos manualmente na tela de Finanças.
        </SurfaceSection>
      ) : null}
      {["PAST_DUE", "SUSPENDED", "CANCELED"].includes(subscriptionStatus) ? (
        <SurfaceSection className="border-red-300/60 bg-red-50 text-red-900 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-200">
          Política comercial ativa para este tenant ({subscriptionStatus}). Alguns recursos premium podem ser bloqueados até regularizar a assinatura.
        </SurfaceSection>
      ) : null}

      <SmartPage
        pageContext="finances"
        headline="Centro de monetização"
        dominantProblem={blockedItems.length > 0 ? "Limite atingido bloqueando vendas" : "Plano pode limitar escala"}
        dominantImpact={blockedItems.length > 0 ? `Bloqueio em ${blockedItems.map((item) => item.label).join(", ")}` : "Fluxo operacional disponível"}
        dominantCta={{
          label: blockedItems.length > 0 ? "Desbloquear com upgrade" : "Atualizar plano",
          path: "/billing",
          onClick: () => void handleUpgrade(heroPrimaryAction),
        }}
        priorities={[
          {
            id: "billing-upgrade",
            type: "idle_cash",
            title: blockedItems.length > 0 ? "Upgrade imediato" : "Revisar plano atual",
            helperText:
              blockedItems.length > 0
                ? "Evita bloqueio de criação em recursos críticos."
                : "Garante escala sem fricção comercial.",
            count: blockedItems.length > 0 ? blockedItems.length : 1,
            impactCents: blockedItems.length > 0 ? 100000 : 50000,
            ctaLabel: "Atualizar plano",
            ctaPath: "/billing",
          },
          {
            id: "billing-usage",
            type: "overdue_charges",
            title: "Monitorar limites",
            helperText: "Acompanhe consumo para não travar o funil.",
            count: hasExceededUsage ? blockedItems.length : 1,
            impactCents: hasExceededUsage ? 80000 : 10000,
            ctaLabel: "Ver limites",
            ctaPath: "/billing",
          },
          {
            id: "billing-trial",
            type: "operational_risk",
            title: isTrial ? "Converter trial em assinatura" : "Plano recorrente validado",
            helperText: isTrial ? "Defina plano antes do fim do período de avaliação." : "Operação monetizada sem risco imediato.",
            count: 1,
            impactCents: isTrial ? 65000 : 1000,
            ctaLabel: "Revisar cobrança",
            ctaPath: "/billing",
          },
        ]}
      />

      {queryState.shouldBlockForError ? (
        <SurfaceSection>
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7" />}
            title="Falha ao carregar billing"
            description="Não foi possível carregar planos e status agora. Tente novamente para restaurar a leitura."
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
        </SurfaceSection>
      ) : null}

      {queryState.isInitialLoading ? (
        <SurfaceSection className="p-8 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Carregando status de assinatura...
        </SurfaceSection>
      ) : null}

      {!queryState.isInitialLoading ? (
        <section className="grid gap-3 md:grid-cols-3">
          {plans.map((plan: any) => {
            const name = String(plan.name ?? "FREE").toUpperCase();
            const isCurrent = name === currentPlan;
            const canUpgrade = !isCurrent && name !== "FREE";

            return (
              <article key={name} className={`nexo-card-operational ${planTone(currentPlan, name)}`}>
                <h2 className="text-base font-semibold">{name}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
                  {formatCurrency(PLAN_BASE_PRICE_CENTS[name as PlanName] ?? 0)} / mês
                </p>
                <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">{PLAN_GAIN[name as PlanName]}</p>
                <div className="mt-4 space-y-2 text-xs">
                  <p>Clientes: {limits?.limits?.customers ?? "—"}</p>
                  <p>Agendamentos: {limits?.limits?.appointments ?? "—"}</p>
                  <p>Mensagens: {limits?.limits?.messages ?? "—"}</p>
                  <p>Ordens de serviço: {limits?.limits?.serviceOrders ?? "—"}</p>
                  <p>Usuários: {limits?.limits?.users ?? "—"}</p>
                </div>
                <div className="mt-4">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Plano em uso
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="nexo-cta-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium disabled:opacity-60"
                      disabled={!canUpgrade || checkoutMutation.isPending || !stripeConfigured}
                      onClick={() => void handleUpgrade(name as PlanName)}
                    >
                      <CreditCard className="h-4 w-4" />
                      {checkoutMutation.isPending ? "Processando..." : "Continuar crescendo"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      <SurfaceSection className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mt-1 text-xs text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
              Seu upgrade libera mais execução, mais cobranças e mais receita confirmada sem bloqueio.
            </p>
          </div>
          <div className="nexo-card-informative rounded-xl px-3 py-2 text-sm">
            Plano atual: <strong>{currentPlan}</strong>
          </div>
        </div>
        {isTrial ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Trial ativo até {new Date(limits?.trial?.endsAt).toLocaleDateString("pt-BR")}.
          </p>
        ) : null}
        {hasExceededUsage ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Limite do plano atingido em pelo menos um recurso. Motivo do bloqueio: {blockedItems.map((item) => item.label).join(", ")}.
          </p>
        ) : null}
        <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
          {usageItems.map((item) => {
            const used = item.usage?.used ?? "—";
            const limit = item.usage?.unlimited ? "∞" : item.usage?.limit ?? "—";
            const limitNumber = Number(item.usage?.limit ?? 0);
            const usedNumber = Number(item.usage?.used ?? 0);
            const atLimit =
              !item.usage?.unlimited &&
              Number.isFinite(limitNumber) &&
              limitNumber > 0 &&
              Number.isFinite(usedNumber) &&
              usedNumber >= limitNumber;

            return (
              <p key={item.label} className={atLimit ? "font-medium text-amber-600 dark:text-amber-300" : ""}>
                {item.label}: {used} / {limit}
              </p>
            );
          })}
        </div>
        {blockedItems.length > 0 ? (
          <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-200">
            <p className="font-semibold">Motivo do bloqueio atual</p>
            <p>
              Você atingiu: {blockedItems.map((item) => item.label).join(", ")}.
              Upgrade libera novas criações e evita travas no fluxo cliente → O.S. → cobrança → pagamento.
            </p>
          </div>
        ) : null}
        {currentPlan !== "FREE" ? (
          <Button
            type="button"
            variant="outline"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? "Cancelando..." : "Cancelar assinatura"}
          </Button>
        ) : null}
      </SurfaceSection>
    </PageWrapper>
  );
}
