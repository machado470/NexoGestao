import React, { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  RefreshCcw,
  AlertTriangle,
  Activity,
  Lock,
  PauseCircle,
  TimerReset,
  ArrowRight,
  Sparkles,
  Wallet,
  Wrench,
  Users,
  ShieldCheck,
  BarChart3,
  Clock3,
} from "lucide-react";
import {
  buildFinanceChargeUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";

function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRiskLevel(score?: number | null) {
  const value = Number(score ?? 0);

  if (value >= 80) return "Crítico";
  if (value >= 60) return "Alto";
  if (value >= 40) return "Moderado";
  if (value > 0) return "Baixo";
  return "Sem score";
}

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
}

function formatOperationalState(value?: string | null) {
  switch (String(value ?? "").toUpperCase()) {
    case "NORMAL":
      return "Normal";
    case "WARNING":
      return "Atenção";
    case "RESTRICTED":
      return "Restrito";
    case "SUSPENDED":
      return "Suspenso";
    default:
      return value || "Indefinido";
  }
}

function getOperationalStateTone(value?: string | null) {
  switch (String(value ?? "").toUpperCase()) {
    case "NORMAL":
      return {
        wrapper:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
        badge:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        icon: ShieldCheck,
      };
    case "WARNING":
      return {
        wrapper:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
        badge:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        icon: AlertTriangle,
      };
    case "RESTRICTED":
      return {
        wrapper:
          "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
        badge:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
        icon: Lock,
      };
    case "SUSPENDED":
      return {
        wrapper:
          "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
        badge:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        icon: PauseCircle,
      };
    default:
      return {
        wrapper:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
        badge:
          "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
        icon: ShieldAlert,
      };
  }
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4 text-orange-500" />
        {title}
      </div>
      <p
        className={`mt-2 text-2xl font-bold text-gray-900 dark:text-white ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  toneClassName,
  children,
}: {
  title: string;
  description: string;
  toneClassName: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{description}</p>
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export default function GovernancePage() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadGovernance = isAuthenticated && !isInitializing;

  const summaryQuery = trpc.governance.summary.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const runsQuery = trpc.governance.runs.useQuery(
    { limit: 20 },
    {
      enabled: canLoadGovernance,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const autoScoreQuery = trpc.governance.autoScore.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const summary = useMemo(() => {
    const payload: any = summaryQuery.data;
    return payload?.data ?? payload ?? null;
  }, [summaryQuery.data]);

  const runs = useMemo(() => {
    const payload: any = runsQuery.data;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload)) return payload;
    return [];
  }, [runsQuery.data]);

  const autoScore = useMemo(() => {
    const payload: any = autoScoreQuery.data;
    return payload?.data ?? payload ?? null;
  }, [autoScoreQuery.data]);

  const alerts = useMemo(() => {
    const payload: any = alertsQuery.data;
    return payload?.data ?? payload ?? {};
  }, [alertsQuery.data]);

  const overdueCharges = Array.isArray(alerts?.overdueCharges?.items)
    ? alerts.overdueCharges.items
    : [];

  const overdueOrders = Array.isArray(alerts?.overdueOrders?.items)
    ? alerts.overdueOrders.items
    : [];

  const doneOrdersWithoutCharge = Array.isArray(
    alerts?.doneOrdersWithoutCharge?.items
  )
    ? alerts.doneOrdersWithoutCharge.items
    : [];

  const customersWithPending = Array.isArray(alerts?.customersWithPending?.items)
    ? alerts.customersWithPending.items
    : [];

  const currentState =
    summary?.operationalState ??
    autoScore?.level ??
    (Number(summary?.institutionalRiskScore ?? 0) >= 80
      ? "SUSPENDED"
      : Number(summary?.institutionalRiskScore ?? 0) >= 60
        ? "RESTRICTED"
        : Number(summary?.institutionalRiskScore ?? 0) >= 40
          ? "WARNING"
          : "NORMAL");

  const stateTone = getOperationalStateTone(currentState);
  const StateIcon = stateTone.icon;

  const isLoading =
    summaryQuery.isLoading ||
    runsQuery.isLoading ||
    autoScoreQuery.isLoading ||
    alertsQuery.isLoading;

  const hasError =
    summaryQuery.isError ||
    runsQuery.isError ||
    autoScoreQuery.isError ||
    alertsQuery.isError;

  const errorMessage =
    getErrorMessage(summaryQuery.error, "") ||
    getErrorMessage(runsQuery.error, "") ||
    getErrorMessage(autoScoreQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Não foi possível carregar a governança agora.";

  const criticalActions = [
    overdueCharges.length > 0
      ? {
          key: "overdueCharges",
          title: "Cobranças vencidas pressionando a operação",
          description:
            "O financeiro já virou problema operacional. Regularizar isso reduz atrito e score de risco.",
          tone:
            "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
          cta: overdueCharges[0]?.id
            ? () => navigate(buildFinanceChargeUrl(overdueCharges[0].id))
            : null,
          ctaLabel: "Abrir cobrança crítica",
        }
      : null,
    doneOrdersWithoutCharge.length > 0
      ? {
          key: "doneWithoutCharge",
          title: "Execução concluída sem cobrança",
          description:
            "Serviço fechado sem captura financeira. Isso quebra o ciclo do produto e distorce a leitura da operação.",
          tone:
            "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
          cta: doneOrdersWithoutCharge[0]?.id
            ? () => navigate(buildServiceOrdersDeepLink(doneOrdersWithoutCharge[0].id))
            : null,
          ctaLabel: "Abrir O.S. crítica",
        }
      : null,
    overdueOrders.length > 0
      ? {
          key: "overdueOrders",
          title: "Ordens atrasadas acumulando risco",
          description:
            "A execução está escapando do prazo. Aqui a governança precisa puxar o operacional pelo colarinho.",
          tone:
            "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
          cta: overdueOrders[0]?.id
            ? () => navigate(buildServiceOrdersDeepLink(overdueOrders[0].id))
            : null,
          ctaLabel: "Abrir ordem atrasada",
        }
      : null,
    customersWithPending.length > 0
      ? {
          key: "customersPending",
          title: "Clientes exigindo follow-up",
          description:
            "Existem clientes acumulando pendências. O problema já não é só dado; é relacionamento operacional frouxo.",
          tone:
            "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
          cta: customersWithPending[0]?.id
            ? () => navigate(`/customers?customerId=${customersWithPending[0].id}`)
            : null,
          ctaLabel: "Abrir cliente",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    title: string;
    description: string;
    tone: string;
    cta: (() => void) | null;
    ctaLabel: string;
  }>;

  if (isInitializing) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          Faça login para visualizar a governança.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          Carregando...
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
            <Sparkles className="h-3.5 w-3.5" />
            Supervisão ativa da operação
          </div>

          <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ShieldAlert className="h-6 w-6 text-orange-500" />
            Governança
          </h1>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Aqui o sistema deixa de só mostrar dados e passa a dizer se a operação
            está saudável, pressionada, restrita ou quebrando de vez.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              Promise.all([
                summaryQuery.refetch(),
                runsQuery.refetch(),
                autoScoreQuery.refetch(),
                alertsQuery.refetch(),
              ])
            }
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${stateTone.wrapper}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${stateTone.badge}`}>
                <StateIcon className="h-3.5 w-3.5" />
                Estado operacional atual
              </span>

              <span className="inline-flex items-center rounded-full border border-current/15 px-3 py-1 text-xs font-medium">
                {formatOperationalState(currentState)}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold">
              {formatOperationalState(currentState)}
            </h2>

            <p className="mt-2 text-sm opacity-90">
              Score institucional atual:{" "}
              <span className="font-semibold">
                {Number(summary?.institutionalRiskScore ?? 0)}
              </span>{" "}
              · Nível{" "}
              <span className="font-semibold">
                {formatRiskLevel(summary?.institutionalRiskScore)}
              </span>
            </p>

            <p className="mt-2 text-sm opacity-90">
              Última execução em {formatDate(summary?.lastRunAt)}. A governança
              precisa traduzir esse número em decisão operacional, não em enfeite
              de dashboard.
            </p>
          </div>

          <div className="grid min-w-[260px] gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-current/15 bg-white/40 p-4 backdrop-blur dark:bg-black/10">
              <p className="text-xs uppercase tracking-wide opacity-75">
                Itens avaliados
              </p>
              <p className="mt-1 text-2xl font-bold">
                {Number(summary?.evaluated ?? 0)}
              </p>
              <p className="mt-1 text-xs opacity-75">
                Warnings: {Number(summary?.warnings ?? 0)}
              </p>
            </div>

            <div className="rounded-xl border border-current/15 bg-white/40 p-4 backdrop-blur dark:bg-black/10">
              <p className="text-xs uppercase tracking-wide opacity-75">
                Corretivas
              </p>
              <p className="mt-1 text-2xl font-bold">
                {Number(summary?.correctives ?? 0)}
              </p>
              <p className="mt-1 text-xs opacity-75">
                Abertas: {Number(summary?.openCorrectivesCount ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Restritos"
          value={Number(summary?.restrictedCount ?? 0)}
          subtitle="Operação limitada por política"
          icon={Lock}
          valueClassName="text-orange-600 dark:text-orange-400"
        />
        <SummaryCard
          title="Suspensos"
          value={Number(summary?.suspendedCount ?? 0)}
          subtitle="Estado crítico detectado"
          icon={PauseCircle}
          valueClassName="text-red-600 dark:text-red-400"
        />
        <SummaryCard
          title="Duração do último ciclo"
          value={`${Number(summary?.durationMs ?? 0)} ms`}
          subtitle="Tempo da leitura de governança"
          icon={TimerReset}
        />
        <SummaryCard
          title="Auto score"
          value={Number(autoScore?.score ?? 0)}
          subtitle={`${autoScore?.level ?? "Sem nível"} · ${formatDate(autoScore?.lastUpdated)}`}
          icon={BarChart3}
        />
      </div>

      {criticalActions.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Ações críticas visíveis
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              O que está pressionando a operação agora e por onde a governança
              deve puxar o fio.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {criticalActions.map((action) => (
              <ActionCard
                key={action.key}
                title={action.title}
                description={action.description}
                toneClassName={action.tone}
              >
                {action.cta ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={action.cta}
                    className="gap-2 border-current/20 bg-white/60 text-current hover:bg-white/80 dark:bg-black/10 dark:hover:bg-black/20"
                  >
                    <ArrowRight className="h-4 w-4" />
                    {action.ctaLabel}
                  </Button>
                ) : null}
              </ActionCard>
            ))}
          </div>
        </div>
      ) : (
        <ActionCard
          title="Sem pressão crítica imediata"
          description="Nenhum gargalo grave apareceu nos alertas atuais. Milagre estatístico ou um raro dia bom."
          toneClassName="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Alertas operacionais vivos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            O que explica o estado atual da operação em linguagem de negócio.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Cobranças vencidas"
            value={Number(alerts?.overdueCharges?.count ?? 0)}
            subtitle={formatCurrency(alerts?.overdueCharges?.totalAmountCents ?? 0)}
            icon={Wallet}
            valueClassName="text-red-600 dark:text-red-400"
          />
          <SummaryCard
            title="Serviços atrasados"
            value={Number(alerts?.overdueOrders?.count ?? 0)}
            subtitle="Ordens fora do prazo"
            icon={Wrench}
            valueClassName="text-yellow-600 dark:text-yellow-400"
          />
          <SummaryCard
            title="Concluídas sem cobrança"
            value={Number(alerts?.doneOrdersWithoutCharge?.count ?? 0)}
            subtitle="Gargalo entre execução e financeiro"
            icon={Activity}
            valueClassName="text-orange-600 dark:text-orange-400"
          />
          <SummaryCard
            title="Clientes com pendência"
            value={Number(alerts?.customersWithPending?.count ?? 0)}
            subtitle="Precisam de follow-up"
            icon={Users}
            valueClassName="text-blue-600 dark:text-blue-400"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Cobranças vencidas
            </h3>

            {overdueCharges.length > 0 ? (
              overdueCharges.slice(0, 5).map((charge: any) => (
                <div
                  key={charge.id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {charge.customer?.name || "Cliente"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(charge.amountCents)} · Venc.{" "}
                        {formatDate(charge.dueDate)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(buildFinanceChargeUrl(charge.id))}
                      className="gap-2"
                    >
                      <Wallet className="h-4 w-4" />
                      Abrir cobrança
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma cobrança vencida no momento.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Serviços atrasados
            </h3>

            {overdueOrders.length > 0 ? (
              overdueOrders.slice(0, 5).map((order: any) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {order.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {order.customer?.name || "Sem cliente"} · Prazo{" "}
                        {formatDate(order.dueDate)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(buildServiceOrdersDeepLink(order.id))}
                      className="gap-2"
                    >
                      <Wrench className="h-4 w-4" />
                      Abrir ordem
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum serviço atrasado no momento.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              O.S. concluídas sem cobrança
            </h3>

            {doneOrdersWithoutCharge.length > 0 ? (
              doneOrdersWithoutCharge.slice(0, 5).map((order: any) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {order.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {order.customer?.name || "Sem cliente"} · Finalizada em{" "}
                        {formatDate(order.finishedAt || order.createdAt)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(buildServiceOrdersDeepLink(order.id))}
                      className="gap-2"
                    >
                      <Activity className="h-4 w-4" />
                      Revisar ordem
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma O.S. concluída sem cobrança aparente.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Clientes com pendência
            </h3>

            {customersWithPending.length > 0 ? (
              customersWithPending.slice(0, 5).map((customer: any) => (
                <div
                  key={customer.id}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {Number(customer.pendingCharges ?? 0)} pendência(s) ·{" "}
                        {formatCurrency(customer.totalPendingCents ?? 0)}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/customers?customerId=${customer.id}`)}
                      className="gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Abrir cliente
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum cliente com pendência no momento.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Auto score por fator
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Decomposição da leitura automática do risco.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard
              title="Score"
              value={Number(autoScore?.score ?? 0)}
              subtitle="Valor consolidado"
              icon={BarChart3}
            />
            <SummaryCard
              title="Nível"
              value={autoScore?.level ?? "—"}
              subtitle="Classificação atual"
              icon={ShieldAlert}
            />
            <SummaryCard
              title="Última atualização"
              value={formatDate(autoScore?.lastUpdated)}
              subtitle="Momento do cálculo"
              icon={Clock3}
            />
          </div>

          <div className="mt-4 space-y-3">
            {Array.isArray(autoScore?.factors) && autoScore.factors.length > 0 ? (
              autoScore.factors.map((factor: any, index: number) => (
                <div
                  key={`${factor?.name ?? "factor"}-${index}`}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {factor?.name ?? "Fator"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Participação direta na leitura do score.
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {Number(factor?.score ?? 0)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        score
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum fator de auto score disponível.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tendência recente
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Últimos pontos retornados no resumo de governança.
            </p>
          </div>

          {Array.isArray(summary?.trend) && summary.trend.length > 0 ? (
            <div className="space-y-3">
              {summary.trend.map((item: any, index: number) => (
                <div
                  key={`${item?.createdAt ?? "trend"}-${index}`}
                  className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(item?.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Score {Number(item?.institutionalRiskScore ?? 0)} ·{" "}
                        {formatRiskLevel(item?.institutionalRiskScore)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 md:min-w-[220px]">
                      <div className="rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
                        Avaliados: {Number(item?.evaluated ?? 0)}
                      </div>
                      <div className="rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
                        Warnings: {Number(item?.warnings ?? 0)}
                      </div>
                      <div className="rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
                        Corretivas: {Number(item?.correctives ?? 0)}
                      </div>
                      <div className="rounded-lg border border-gray-200 px-2 py-1 dark:border-gray-700">
                        Abertas: {Number(item?.openCorrectivesCount ?? 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Sem dados de tendência no momento.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Histórico de execuções
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Últimos ciclos registrados de governança.
          </p>
        </div>

        {runs.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Nenhuma execução encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run: any) => (
              <div
                key={run.id ?? `${run.createdAt}-${run.orgId}`}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Execução em {formatDate(run.createdAt)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Score institucional:{" "}
                      {Number(run.institutionalRiskScore ?? 0)} ·{" "}
                      {formatRiskLevel(run.institutionalRiskScore)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Avaliados: {Number(run.evaluated ?? 0)} · Warnings:{" "}
                      {Number(run.warnings ?? 0)} · Corretivas:{" "}
                      {Number(run.correctives ?? 0)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm lg:min-w-[300px]">
                    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      Restritos: {Number(run.restrictedCount ?? 0)}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      Suspensos: {Number(run.suspendedCount ?? 0)}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      Corretivas abertas: {Number(run.openCorrectivesCount ?? 0)}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                      Duração: {Number(run.durationMs ?? 0)} ms
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
