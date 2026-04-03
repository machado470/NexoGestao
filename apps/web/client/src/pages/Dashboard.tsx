import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeAlertsPayload } from "@/lib/query-helpers";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  Loader2,
  Receipt,
  Shield,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react";

function formatCurrency(cents?: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
}

type AlertItem = {
  id: string;
  title?: string;
  serviceOrderId?: string;
  amountCents?: number;
  customer?: {
    name?: string | null;
  } | null;
};

type AlertsPayload = {
  overdueOrders?: {
    count?: number;
    items?: AlertItem[];
  };
  overdueCharges?: {
    count?: number;
    totalAmountCents?: number;
    items?: AlertItem[];
  };
  doneOrdersWithoutCharge?: {
    count?: number;
    items?: AlertItem[];
  };
};

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  description: string;
};

function KpiCard({ icon: Icon, label, value, description }: KpiCardProps) {
  return (
    <div className="nexo-kpi-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {value}
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

type ActionListCardProps = {
  title: string;
  description: string;
  emptyText: string;
  tone?: "default" | "danger" | "success";
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    value?: string;
    onClick?: () => void;
  }>;
};

function ActionListCard({
  title,
  description,
  emptyText,
  tone = "default",
  items,
}: ActionListCardProps) {
  const toneStyles =
    tone === "danger"
      ? {
          badge:
            "border-red-200/80 bg-red-100/80 text-red-700 dark:border-red-500/20 dark:bg-red-500/12 dark:text-red-300",
          row: "border-red-200/60 bg-red-50/70 dark:border-red-500/10 dark:bg-red-500/[0.06]",
        }
      : tone === "success"
      ? {
          badge:
            "border-emerald-200/80 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-300",
          row: "border-emerald-200/60 bg-emerald-50/70 dark:border-emerald-500/10 dark:bg-emerald-500/[0.06]",
        }
      : {
          badge:
            "border-slate-200/80 bg-white/80 text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200",
          row: "border-slate-200/70 bg-white/70 dark:border-white/8 dark:bg-white/[0.03]",
        };

  return (
    <section className="nexo-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="nexo-section-title">{title}</h2>
          <p className="mt-1 nexo-section-description">{description}</p>
        </div>

        <div
          className={`inline-flex h-9 min-w-9 items-center justify-center rounded-2xl border px-3 text-xs font-semibold ${toneStyles.badge}`}
        >
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-zinc-500 dark:border-white/8 dark:text-zinc-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors hover:border-orange-300/80 hover:bg-orange-50/80 dark:hover:border-orange-500/20 dark:hover:bg-orange-500/[0.08] ${toneStyles.row}`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-950 dark:text-white">
                  {item.title}
                </p>
                {item.subtitle ? (
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {item.subtitle}
                  </p>
                ) : null}
              </div>

              <div className="ml-3 flex shrink-0 items-center gap-3">
                {item.value ? (
                  <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                    {item.value}
                  </span>
                ) : null}

                <ArrowRight className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: isAuthenticated && !isInitializing,
    retry: false,
  });

  const alerts = useMemo<AlertsPayload>(() => {
    return normalizeAlertsPayload<AlertsPayload>(alertsQuery.data) ?? {};
  }, [alertsQuery.data]);

  const overdueOrders = alerts.overdueOrders?.items ?? [];
  const overdueCharges = alerts.overdueCharges?.items ?? [];
  const doneWithoutCharge = alerts.doneOrdersWithoutCharge?.items ?? [];

  const overdueOrdersCount = Number(alerts.overdueOrders?.count ?? 0);
  const overdueChargesCount = Number(alerts.overdueCharges?.count ?? 0);
  const overdueChargesAmount = Number(
    alerts.overdueCharges?.totalAmountCents ?? 0
  );
  const doneWithoutChargeCount = Number(
    alerts.doneOrdersWithoutCharge?.count ?? 0
  );

  const financialWeight = overdueChargesAmount > 0 ? 2 : 0;

  const priorityScore =
    overdueChargesCount * (3 + financialWeight) +
    overdueOrdersCount * 2 +
    doneWithoutChargeCount;

  const operationTone =
    priorityScore === 0
      ? "normal"
      : priorityScore <= 6
      ? "attention"
      : "critical";

  const executiveStatus =
    operationTone === "normal"
      ? "Operação sob controle."
      : operationTone === "attention"
      ? "Existem pendências relevantes pedindo ação."
      : "Risco operacional e financeiro aberto agora.";

  const cycleReading =
    operationTone === "normal"
      ? "Estável"
      : operationTone === "attention"
      ? "Pressão"
      : "Crítico";

  const impactMessage =
    overdueChargesAmount > 0
      ? `${formatCurrency(overdueChargesAmount)} travados em cobranças vencidas.`
      : "Sem receita vencida travando o caixa agora.";

  if (isInitializing) {
    return <div className="p-6">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <div className="p-6">Login</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%)]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              Central de decisão
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
              O que precisa andar agora
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Um hub curto, acionável e sem teatro: execução atrasada,
              cobrança esquecida e ciclo aberto aparecem aqui primeiro.
            </p>

            <div className="mt-4 inline-flex max-w-xl items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200">
              <Wallet className="h-4 w-4 shrink-0 text-orange-500" />
              <span>{impactMessage}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Prioridade total
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {priorityScore}
              </p>
            </div>

            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Dinheiro travado
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {formatCurrency(overdueChargesAmount)}
              </p>
            </div>

            <div className="nexo-subtle-surface col-span-2 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Status executivo
              </p>
              <p className="mt-2 text-sm font-semibold leading-5 text-zinc-950 dark:text-white">
                {executiveStatus}
              </p>
            </div>
          </div>
        </div>
      </section>

      {alertsQuery.isLoading ? (
        <div className="nexo-surface flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Clock3}
          label="Ordens atrasadas"
          value={overdueOrdersCount}
          description="Execuções fora do tempo esperado."
        />

        <KpiCard
          icon={Receipt}
          label="Cobranças vencidas"
          value={`${overdueChargesCount} · ${formatCurrency(overdueChargesAmount)}`}
          description="Receita parada esperando ação."
        />

        <KpiCard
          icon={Workflow}
          label="Execução sem cobrança"
          value={doneWithoutChargeCount}
          description="Serviço concluído sem fechamento financeiro."
        />

        <KpiCard
          icon={Shield}
          label="Leitura do ciclo"
          value={cycleReading}
          description="Resumo rápido da saúde operacional."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ActionListCard
          title="Ordens atrasadas"
          description="O que está segurando a execução agora."
          emptyText="Nenhuma ordem atrasada neste momento."
          tone="danger"
          items={overdueOrders.slice(0, 5).map((order) => ({
            id: order.id,
            title: order.title ?? "Ordem sem título",
            subtitle: order.customer?.name ?? "Cliente não identificado",
            onClick: () => navigate(`/service-orders?id=${order.id}`),
          }))}
        />

        <ActionListCard
          title="Cobranças vencidas"
          description="Valores que já deveriam ter fechado o ciclo."
          emptyText="Nenhuma cobrança vencida neste momento."
          tone="default"
          items={overdueCharges.slice(0, 5).map((charge) => ({
            id: charge.id,
            title: charge.customer?.name ?? "Cliente sem nome",
            subtitle: "Cobrança vinculada à operação",
            value: formatCurrency(charge.amountCents),
            onClick: () =>
              navigate(`/service-orders?id=${charge.serviceOrderId}`),
          }))}
        />

        <ActionListCard
          title="Execução sem cobrança"
          description="Serviços finalizados que ainda não viraram receita."
          emptyText="Nenhuma execução concluída sem cobrança."
          tone="success"
          items={doneWithoutCharge.slice(0, 5).map((order) => ({
            id: order.id,
            title: order.title ?? "Ordem sem título",
            subtitle: order.customer?.name ?? "Cliente não identificado",
            onClick: () => navigate(`/service-orders?id=${order.id}`),
          }))}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="nexo-surface p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="nexo-section-title">Próximas decisões</h2>
              <p className="mt-1 nexo-section-description">
                Atalhos para sair do painel e resolver sem rodeio.
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-orange-400">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard/operations")}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-left transition-colors hover:border-orange-300/80 hover:bg-orange-50/80 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-orange-500/20 dark:hover:bg-orange-500/[0.08]"
            >
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Dashboard Operacional
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Ler fila, gargalos e pendências do dia.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/operations")}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-left transition-colors hover:border-orange-300/80 hover:bg-orange-50/80 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-orange-500/20 dark:hover:bg-orange-500/[0.08]"
            >
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Workflow Operacional
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Avançar o ciclo sem tela perdida.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-left transition-colors hover:border-orange-300/80 hover:bg-orange-50/80 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-orange-500/20 dark:hover:bg-orange-500/[0.08]"
            >
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                Financeiro
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Fechar cobrança, pagamento e receita.
              </p>
            </button>
          </div>
        </div>

        <div className="nexo-surface p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="nexo-section-title">Resumo rápido</h2>
              <p className="mt-1 nexo-section-description">
                A leitura em uma tela só, do jeito que produto sério gosta.
              </p>
            </div>

            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>

          <div className="space-y-3">
            <div className="nexo-list-row">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Ordens atrasadas
              </span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {overdueOrdersCount}
              </span>
            </div>

            <div className="nexo-list-row">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Cobranças vencidas
              </span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {overdueChargesCount}
              </span>
            </div>

            <div className="nexo-list-row">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Valor vencido
              </span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {formatCurrency(overdueChargesAmount)}
              </span>
            </div>

            <div className="nexo-list-row">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Execução sem cobrança
              </span>
              <span className="font-semibold text-zinc-950 dark:text-white">
                {doneWithoutChargeCount}
              </span>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-4 text-sm text-zinc-500 dark:border-white/8 dark:text-zinc-400">
              {priorityScore === 0
                ? "Painel limpo. Agora sim parece sistema no controle."
                : "Existe impacto operacional e financeiro aberto. O painel já mostrou onde apertar primeiro."}
            </div>
          </div>
        </div>
      </section>

      {!alertsQuery.isLoading && priorityScore === 0 ? (
        <section className="nexo-surface p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-emerald-100/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
                Sem urgência crítica agora
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Operação e caixa estão respirando bem. Agora o sistema começa a
                parecer controle de verdade.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!alertsQuery.isLoading && priorityScore > 0 ? (
        <section className="overflow-hidden rounded-[1.25rem] border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-base font-semibold tracking-tight text-red-900 dark:text-red-200">
                  Prioridades abertas na operação
                </h3>
                <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                  {priorityScore} ponto(s) de pressão pedindo ação entre
                  execução e financeiro.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/operations")}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              Resolver agora ({priorityScore})
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
