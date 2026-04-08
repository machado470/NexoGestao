import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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
    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/60";
}

const PLAN_GAIN: Record<PlanName, string> = {
  FREE: "Para começar a testar o fluxo.",
  STARTER: "Estrutura inicial para operar sem perder cobranças.",
  PRO: "Escala comercial com mais capacidade e previsibilidade.",
  SCALE: "Máxima escala para operação com múltiplos times.",
};

export default function BillingPage() {
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
  const utils = trpc.useUtils();

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: (payload) => {
      const checkoutUrl = payload?.url ?? payload?.checkoutUrl;
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
  const plans = useMemo(() => {
    if (Array.isArray(plansQuery.data)) return plansQuery.data;
    return [];
  }, [plansQuery.data]);

  const hasAnyData = plans.length > 0 || Boolean(status) || Boolean(limits);
  const isLoading =
    (plansQuery.isLoading || statusQuery.isLoading || limitsQuery.isLoading) &&
    !hasAnyData;
  const isError = plansQuery.isError || statusQuery.isError || limitsQuery.isError;
  const usageItems = [
    {
      label: "Clientes",
      usage: limits?.usage?.customers,
    },
    {
      label: "Agendamentos",
      usage: limits?.usage?.appointments,
    },
    {
      label: "Ordens de serviço",
      usage: limits?.usage?.serviceOrders,
    },
    {
      label: "Usuários",
      usage: limits?.usage?.users,
    },
  ];

  const hasExceededUsage = usageItems.some((item) => {
    const used = Number(item.usage?.used ?? 0);
    const limit = Number(item.usage?.limit ?? 0);
    if (item.usage?.unlimited) return false;
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return false;
    return used >= limit;
  });

  const currentPlan = String(status?.plan ?? limits?.plan ?? "FREE").toUpperCase();
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
    await checkoutMutation.mutateAsync({
      priceId,
      successUrl: `${window.location.origin}/billing`,
      cancelUrl: `${window.location.origin}/billing`,
    });
  };

  return (
    <div className="space-y-4">
      <section className="nexo-app-panel-strong p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Plano e faturamento</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Controle trial, limites e upgrade sem sair do fluxo operacional.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            Plano atual: <strong>{currentPlan}</strong>
          </div>
        </div>
        {isTrial ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Trial ativo até {new Date(limits?.trial?.endsAt).toLocaleDateString("pt-BR")}.
          </p>
        ) : null}
        {blockedItems.length > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-900 dark:bg-red-900/30 dark:text-red-200">
            <AlertTriangle className="h-4 w-4" />
            Você atingiu o limite de {blockedItems.map((item) => item.label).join(", ")}.
            Continue crescendo com upgrade.
          </p>
        ) : null}
      </section>

      {isError ? (
        <section className="nexo-app-panel space-y-3 p-4 text-sm">
          <p>Falha ao carregar billing. Tente novamente em alguns segundos.</p>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            onClick={() => {
              void Promise.all([
                plansQuery.refetch(),
                statusQuery.refetch(),
                limitsQuery.refetch(),
              ]);
            }}
          >
            Tentar novamente
          </button>
        </section>
      ) : null}

      {isLoading ? (
        <section className="nexo-app-panel p-8 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Carregando status de assinatura...
        </section>
      ) : null}

      {!isLoading ? (
        <section className="grid gap-3 md:grid-cols-3">
          {plans.map((plan: any) => {
            const name = String(plan.name ?? "FREE").toUpperCase();
            const isCurrent = name === currentPlan;
            const canUpgrade = !isCurrent && name !== "FREE";

            return (
              <article
                key={name}
                className={`nexo-app-panel p-4 ${planTone(currentPlan, name)}`}
              >
                <h2 className="text-base font-semibold">{name}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {formatCurrency(PLAN_BASE_PRICE_CENTS[name as PlanName] ?? 0)} / mês
                </p>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{PLAN_GAIN[name as PlanName]}</p>
                <div className="mt-4 space-y-2 text-xs">
                  <p>Clientes: {limits?.limits?.customers ?? "—"}</p>
                  <p>Agendamentos: {limits?.limits?.appointments ?? "—"}</p>
                  <p>Ordens de serviço: {limits?.limits?.serviceOrders ?? "—"}</p>
                </div>
                <div className="mt-4">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Plano em uso
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
                      disabled={!canUpgrade || checkoutMutation.isPending}
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

      <section className="nexo-app-panel p-4">
        <h3 className="text-sm font-semibold">Uso atual da organização</h3>
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

        <div className="mt-4 flex flex-wrap gap-2">
          {hasExceededUsage ? (
            <button
              type="button"
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-60"
              disabled={checkoutMutation.isPending}
              onClick={() => void handleUpgrade("PRO")}
            >
              {checkoutMutation.isPending ? "Processando..." : "Continuar crescendo"}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900 disabled:opacity-60"
            disabled={cancelMutation.isPending}
            onClick={() => void cancelMutation.mutateAsync()}
          >
            {cancelMutation.isPending ? "Cancelando..." : "Cancelar assinatura"}
          </button>
        </div>
      </section>
    </div>
  );
}
