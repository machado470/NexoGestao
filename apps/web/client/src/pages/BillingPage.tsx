// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app/OperationalCommandLayer";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppFiltersBar,
  AppKpiRow,
  AppOperationalHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";

type PlanName = "FREE" | "STARTER" | "PRO" | "BUSINESS";
type AccountStatus =
  | "ACTIVE"
  | "TRIAL"
  | "PAST_DUE"
  | "CANCELED"
  | "NO_SUBSCRIPTION"
  | "SUSPENDED";

const PLAN_PRICE_ID: Record<PlanName, string | null> = {
  FREE: null,
  STARTER: "price_starter",
  PRO: "price_pro",
  BUSINESS: "price_business",
};

const PLAN_META: Record<
  PlanName,
  { title: string; priceCents: number; periodicity: string }
> = {
  FREE: { title: "Essencial", priceCents: 0, periodicity: "mensal" },
  STARTER: { title: "Starter", priceCents: 19900, periodicity: "mensal" },
  PRO: { title: "Pro", priceCents: 49900, periodicity: "mensal" },
  BUSINESS: { title: "Scale", priceCents: 99900, periodicity: "mensal" },
};

function brl(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueCents / 100);
}

function safePlanName(value: unknown): PlanName {
  const candidate = String(value ?? "FREE").toUpperCase();
  const normalized = candidate === "SCALE" ? "BUSINESS" : candidate;
  return ["FREE", "STARTER", "PRO", "BUSINESS"].includes(normalized)
    ? (normalized as PlanName)
    : "FREE";
}

function accountStatus(value: unknown): AccountStatus {
  const status = String(value ?? "ACTIVE").toUpperCase();
  if (status === "TRIALING") return "TRIAL";
  if (status === "UNPAID") return "PAST_DUE";
  if (
    [
      "ACTIVE",
      "TRIAL",
      "PAST_DUE",
      "CANCELED",
      "NO_SUBSCRIPTION",
      "SUSPENDED",
    ].includes(status)
  )
    return status as AccountStatus;
  return "ACTIVE";
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value: unknown) {
  const date = parseDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function scrollToBillingActions() {
  document
    .getElementById("billing-actions")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function refreshBilling(refetchers: Array<() => Promise<unknown>>) {
  void Promise.all(refetchers.map(refetch => refetch()));
}

function hasPaymentFailure(events: any[]) {
  return events.some(event => {
    const status = String(event?.status ?? event?.state ?? "").toUpperCase();
    const type = String(event?.type ?? event?.description ?? "").toUpperCase();
    return ["FAILED", "FAILURE", "PAST_DUE", "UNPAID"].some(
      token => status.includes(token) || type.includes(token)
    );
  });
}

function hasOpenOverdueInvoice(events: any[]) {
  return events.some(event => {
    const status = String(event?.status ?? event?.state ?? "").toUpperCase();
    const dueAt = event?.dueAt ?? event?.dueDate ?? event?.expiresAt;
    const dueDate = parseDate(dueAt);
    return Boolean(
      dueDate &&
      dueDate.getTime() < Date.now() &&
      !["PAID", "COMPLETED", "SUCCEEDED"].some(token => status.includes(token))
    );
  });
}

function statusLabel(status: AccountStatus) {
  const labels: Record<AccountStatus, string> = {
    ACTIVE: "Ativa",
    TRIAL: "Trial",
    PAST_DUE: "Em atraso",
    CANCELED: "Cancelada",
    NO_SUBSCRIPTION: "Sem assinatura",
    SUSPENDED: "Suspensa",
  };
  return labels[status];
}

function paymentMethodMissing(paymentMethod: string, currentPlan: PlanName) {
  return (
    currentPlan !== "FREE" &&
    ["", "NÃO INFORMADO", "NAO INFORMADO", "NULL", "UNDEFINED"].includes(
      paymentMethod.trim().toUpperCase()
    )
  );
}

function highestUsageSignal(usage: any) {
  const entries = Object.entries(usage ?? {})
    .map(([key, value]: [string, any]) => ({
      key,
      used: Number(value?.used ?? 0),
      limit: Number(value?.limit ?? 0),
      percentage: Number(value?.percentage ?? 0),
      unlimited: Boolean(value?.unlimited),
    }))
    .filter(item => !item.unlimited && Number.isFinite(item.percentage));

  return entries.sort((a, b) => b.percentage - a.percentage)[0] ?? null;
}

function usageLabel(key: string) {
  const labels: Record<string, string> = {
    customers: "clientes",
    appointments: "agendamentos",
    messages: "mensagens",
    serviceOrders: "ordens de serviço",
    users: "usuários",
  };
  return labels[key] ?? key;
}

function invoiceAmount(event: any, fallbackCents: number) {
  const amount = Number(
    event?.amountCents ?? event?.amount ?? event?.totalCents ?? fallbackCents
  );
  return Number.isFinite(amount) ? amount : fallbackCents;
}

export default function BillingPage() {
  const plansQuery = trpc.billing.plans.useQuery(undefined, { retry: false });
  const statusQuery = trpc.billing.status.useQuery(undefined, { retry: false });
  const limitsQuery = trpc.billing.limits.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, {
    retry: false,
  });
  const utils = trpc.useUtils();

  const currentPlan = safePlanName(
    statusQuery.data?.plan ?? limitsQuery.data?.plan
  );
  const meta = PLAN_META[currentPlan];
  const status = accountStatus(
    statusQuery.data?.status ?? limitsQuery.data?.status
  );
  const stripeConfigured =
    readinessQuery.data?.integrations?.stripe === "configured" ||
    readinessQuery.data?.stripe?.configured === true;
  const nextChargeAt =
    statusQuery.data?.nextBillingAt ??
    statusQuery.data?.currentPeriodEnd ??
    limitsQuery.data?.trial?.endsAt;
  const nextChargeValue = Number(
    statusQuery.data?.nextAmountCents ??
      statusQuery.data?.amountCents ??
      meta.priceCents
  );
  const paymentMethod = String(
    statusQuery.data?.paymentMethodBrand ??
      statusQuery.data?.paymentMethod ??
      "Não informado"
  );
  const invoices = Array.isArray(statusQuery.data?.events)
    ? statusQuery.data.events
    : [];
  const paymentFailed = hasPaymentFailure(invoices);
  const overdueInvoice = hasOpenOverdueInvoice(invoices);
  const trialDaysLeft = status === "TRIAL" ? daysUntil(nextChargeAt) : null;
  const nextChargeDays = daysUntil(nextChargeAt);
  const isTrialEndingSoon =
    status === "TRIAL" && trialDaysLeft !== null && trialDaysLeft <= 7;
  const isNextChargeSoon =
    status === "ACTIVE" &&
    nextChargeDays !== null &&
    nextChargeDays >= 0 &&
    nextChargeDays <= 7;
  const isPaymentMethodMissing = paymentMethodMissing(
    paymentMethod,
    currentPlan
  );
  const highestUsage = highestUsageSignal(limitsQuery.data?.usage);
  const usageNearLimit = Boolean(highestUsage && highestUsage.percentage >= 80);
  const hasBillingDate = Boolean(parseDate(nextChargeAt));

  const operationalState = useMemo<{
    level: OperationalStateLevel;
    reason: string;
    impact: string;
  }>(() => {
    if (status === "CANCELED" || status === "SUSPENDED") {
      return {
        level: "SUSPENDED",
        reason: `Status real da assinatura retornou ${statusLabel(status)}.`,
        impact:
          "O acesso pode estar bloqueado ou em encerramento conforme a política comercial já existente.",
      };
    }

    if (status === "PAST_DUE" || paymentFailed || overdueInvoice) {
      return {
        level: "RESTRICTED",
        reason:
          status === "PAST_DUE"
            ? "A assinatura está marcada como PAST_DUE."
            : "Há falha ou vencimento em fatura retornada pelo billing.",
        impact:
          "A organização precisa regularizar a cobrança para reduzir risco de restrição de acesso ao Nexo.",
      };
    }

    if (status === "TRIAL" && isTrialEndingSoon) {
      return {
        level: "WARNING",
        reason: `Trial perto do fim${trialDaysLeft !== null ? ` (${trialDaysLeft} dia(s) restante(s))` : ""}.`,
        impact:
          "A empresa deve escolher ou revisar o plano antes do encerramento do período de avaliação.",
      };
    }

    if (
      isPaymentMethodMissing ||
      !hasBillingDate ||
      isNextChargeSoon ||
      usageNearLimit
    ) {
      return {
        level: "WARNING",
        reason: isPaymentMethodMissing
          ? "Método de pagamento não foi retornado para um plano pago."
          : !hasBillingDate
            ? "A próxima cobrança não foi retornada pela fonte de billing."
            : isNextChargeSoon
              ? "A próxima cobrança está próxima."
              : `Uso de ${usageLabel(highestUsage?.key ?? "limite")} está próximo do limite do plano.`,
        impact:
          "A administração deve revisar a assinatura para evitar surpresa de cobrança, falha de pagamento ou limite operacional.",
      };
    }

    return {
      level: "NORMAL",
      reason:
        "Assinatura ativa, pagamento sem falha retornada e dados essenciais presentes.",
      impact:
        "A empresa pode continuar usando o Nexo sem sinal atual de restrição de acesso por Billing.",
    };
  }, [
    hasBillingDate,
    highestUsage?.key,
    isNextChargeSoon,
    isPaymentMethodMissing,
    isTrialEndingSoon,
    overdueInvoice,
    paymentFailed,
    status,
    trialDaysLeft,
    usageNearLimit,
  ]);

  const riskReading = useMemo(() => {
    if (paymentFailed) {
      return {
        title: "Falha de pagamento",
        reason:
          "O histórico retornado pelo billing contém evento de falha, PAST_DUE ou não pagamento.",
        impact:
          "A conta pode perder acesso se a forma de pagamento não for corrigida nos fluxos administrativos existentes.",
        ctaLabel: "Atualizar pagamento",
      };
    }
    if (status === "PAST_DUE" || overdueInvoice) {
      return {
        title: "Assinatura em atraso",
        reason:
          status === "PAST_DUE"
            ? "O status comercial da assinatura é PAST_DUE."
            : "Existe fatura vencida sem status de pagamento concluído.",
        impact:
          "A empresa deve regularizar a assinatura para evitar bloqueio ou restrição de uso da plataforma.",
        ctaLabel: "Regularizar assinatura",
      };
    }
    if (isTrialEndingSoon) {
      return {
        title: "Trial perto do fim",
        reason: `O período de avaliação termina em ${trialDaysLeft} dia(s).`,
        impact:
          "Sem escolha de plano, a continuidade de acesso pode depender da regularização da assinatura.",
        ctaLabel: "Escolher plano",
      };
    }
    if (isPaymentMethodMissing) {
      return {
        title: "Método de pagamento ausente",
        reason:
          "A fonte de billing não retornou cartão, marca ou método para o plano atual.",
        impact:
          "A próxima cobrança pode exigir atualização manual antes de manter a assinatura saudável.",
        ctaLabel: "Adicionar método",
      };
    }
    if (usageNearLimit) {
      return {
        title: "Uso próximo do limite",
        reason: `${usageLabel(highestUsage?.key ?? "limite")} atingiu ${Math.round(highestUsage?.percentage ?? 0)}% do limite do plano.`,
        impact:
          "A operação pode precisar revisar plano antes que novos registros sejam impedidos por limite contratual.",
        ctaLabel: "Revisar plano",
      };
    }
    return {
      title: "Sem risco crítico de Billing",
      reason:
        "Não há falha de pagamento, atraso, trial expirando, limite próximo ou suspensão retornada nesta leitura.",
      impact:
        "A administração pode revisar assinatura, plano e histórico como rotina de governança financeira da plataforma.",
      ctaLabel: "Revisar assinatura",
    };
  }, [
    highestUsage?.key,
    highestUsage?.percentage,
    isPaymentMethodMissing,
    isTrialEndingSoon,
    overdueInvoice,
    paymentFailed,
    status,
    trialDaysLeft,
    usageNearLimit,
  ]);

  const nextBestAction = useMemo(() => {
    if (paymentFailed)
      return {
        title: "Atualizar pagamento",
        reason: "Pagamento falhou no histórico de Billing.",
        impact: "Corrige o método antes que a restrição de acesso avance.",
      };
    if (status === "PAST_DUE" || overdueInvoice)
      return {
        title: "Regularizar assinatura",
        reason: "Assinatura ou fatura está em atraso.",
        impact:
          "Reduz risco de bloqueio e restaura a previsibilidade da cobrança.",
      };
    if (isTrialEndingSoon)
      return {
        title: "Escolher plano",
        reason: "Trial está perto do fim.",
        impact:
          "Define continuidade de acesso antes do encerramento da avaliação.",
      };
    if (isPaymentMethodMissing)
      return {
        title: "Adicionar método de pagamento",
        reason: "Método de pagamento não foi retornado.",
        impact: "Prepara a próxima cobrança da assinatura.",
      };
    if (usageNearLimit)
      return {
        title: "Revisar plano",
        reason: "Uso está próximo do limite contratado.",
        impact: "Evita restrição operacional por limite do plano.",
      };
    return {
      title: "Revisar assinatura",
      reason: "Billing está saudável nesta leitura.",
      impact:
        "Mantém governança sobre plano, cobrança e histórico da plataforma.",
    };
  }, [
    isPaymentMethodMissing,
    isTrialEndingSoon,
    overdueInvoice,
    paymentFailed,
    status,
    usageNearLimit,
  ]);

  const flowStages = useMemo<
    Array<{
      id: string;
      label: string;
      summary: string;
      state: OperationalFlowStageState;
      countOrValue?: string;
      hrefLabel?: string;
      onClick?: () => void;
    }>
  >(
    () => [
      {
        id: "plan",
        label: "Plano",
        summary: `Plano atual ${meta.title}, ${brl(meta.priceCents)} ${meta.periodicity}.`,
        state: currentPlan === "FREE" ? "active" : "done",
        countOrValue: meta.title,
        hrefLabel: "Revisar ações",
        onClick: scrollToBillingActions,
      },
      {
        id: "subscription",
        label: "Assinatura",
        summary: `Status comercial ${statusLabel(status)} retornado pelo Billing.`,
        state:
          status === "CANCELED" || status === "SUSPENDED"
            ? "blocked"
            : status === "PAST_DUE"
              ? "warning"
              : "active",
        countOrValue: statusLabel(status),
      },
      {
        id: "invoice",
        label: "Fatura",
        summary: hasBillingDate
          ? `Próxima cobrança em ${formatDate(nextChargeAt)}.`
          : "Sem próxima cobrança retornada.",
        state: overdueInvoice
          ? "blocked"
          : hasBillingDate
            ? isNextChargeSoon || isTrialEndingSoon
              ? "warning"
              : "active"
            : "idle",
        countOrValue: brl(nextChargeValue),
      },
      {
        id: "payment",
        label: "Pagamento",
        summary: paymentFailed
          ? "Falha retornada pelo billing."
          : `Método atual: ${paymentMethod}.`,
        state:
          paymentFailed || status === "PAST_DUE"
            ? "blocked"
            : isPaymentMethodMissing
              ? "warning"
              : currentPlan === "FREE"
                ? "done"
                : "active",
        hrefLabel: "Atualizar método",
        onClick: scrollToBillingActions,
      },
      {
        id: "access",
        label: "Acesso",
        summary:
          operationalState.level === "NORMAL"
            ? "Sem sinal atual de restrição."
            : operationalState.impact,
        state:
          operationalState.level === "SUSPENDED"
            ? "blocked"
            : operationalState.level === "RESTRICTED"
              ? "warning"
              : operationalState.level === "WARNING"
                ? "warning"
                : "active",
      },
      {
        id: "governance",
        label: "Governança/Billing",
        summary:
          "Billing registra plano, cobrança e prova administrativa da assinatura.",
        state: operationalState.level === "NORMAL" ? "done" : "active",
      },
    ],
    [
      currentPlan,
      hasBillingDate,
      isNextChargeSoon,
      isPaymentMethodMissing,
      isTrialEndingSoon,
      meta.periodicity,
      meta.priceCents,
      meta.title,
      nextChargeAt,
      nextChargeValue,
      operationalState.impact,
      operationalState.level,
      overdueInvoice,
      paymentFailed,
      paymentMethod,
      status,
    ]
  );

  const timelineEvents = useMemo(
    () =>
      invoices.slice(0, 6).map((event: any, index: number) => ({
        id: String(event?.id ?? `billing-event-${index}`),
        type: String(event?.type ?? event?.status ?? "Billing"),
        occurredAt: formatDate(
          event?.createdAt ?? event?.date ?? event?.paidAt ?? event?.dueAt
        ),
        entity: String(
          event?.description ?? event?.invoiceNumber ?? "Fatura da plataforma"
        ),
        actor: String(event?.provider ?? event?.source ?? "Billing"),
        summary: `Status ${String(event?.status ?? "registrado")} • valor ${brl(invoiceAmount(event, meta.priceCents))}.`,
      })),
    [invoices, meta.priceCents]
  );

  const checkoutMutation = trpc.billing.checkout.useMutation({
    onSuccess: payload => {
      const checkoutUrl = payload?.url ?? payload?.checkoutUrl;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      toast.success("Plano atualizado.");
      void Promise.all([
        utils.billing.status.invalidate(),
        utils.billing.limits.invalidate(),
      ]);
    },
    onError: error =>
      toast.error(error.message || "Falha ao iniciar checkout."),
  });

  const cancelMutation = trpc.billing.cancel.useMutation({
    onSuccess: async () => {
      toast.success("Assinatura cancelada para o próximo ciclo.");
      await Promise.all([
        utils.billing.status.invalidate(),
        utils.billing.limits.invalidate(),
      ]);
    },
    onError: error =>
      toast.error(error.message || "Não foi possível cancelar."),
  });

  const startCheckout = (plan: PlanName) => {
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
    <PageWrapper
      title="Billing"
      subtitle="Assinatura SaaS, cobrança, pagamento e status da conta."
    >
      <AppPageShell>
        <AppOperationalHeader
          title="Billing SaaS"
          description="Controle de assinatura separado do financeiro operacional: plano atual, renovação, cobrança e ações de conta."
          primaryAction={
            <Button
              onClick={() =>
                startCheckout(currentPlan === "PRO" ? "BUSINESS" : "PRO")
              }
              disabled={checkoutMutation.isPending || !stripeConfigured}
            >
              Trocar plano
            </Button>
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() =>
                void Promise.all([
                  plansQuery.refetch(),
                  statusQuery.refetch(),
                  limitsQuery.refetch(),
                  readinessQuery.refetch(),
                ])
              }
            >
              Atualizar billing
            </Button>
          }
          contextChips={
            <>
              <AppStatusBadge label={currentPlan} />
              <AppStatusBadge label={statusLabel(status)} />
              <AppStatusBadge label={`Renovação ${formatDate(nextChargeAt)}`} />
            </>
          }
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
            <span>
              <strong>ACTIVE:</strong> assinatura regular.
            </span>
            <span>
              <strong>TRIAL:</strong> avaliação em andamento.
            </span>
            <span>
              <strong>PAST_DUE:</strong> cobrança pendente.
            </span>
            <span>
              <strong>CANCELED:</strong> assinatura cancelada.
            </span>
          </div>
        </AppFiltersBar>

        <section className="grid gap-4 xl:grid-cols-3">
          <OperationalStateCard
            title="Estado da assinatura"
            level={operationalState.level}
            reason={operationalState.reason}
            impact={operationalState.impact}
            detailsLabel="Revisar cobrança"
            onDetails={scrollToBillingActions}
          />
          <OperationalRiskCard
            title={riskReading.title}
            reason={riskReading.reason}
            impact={riskReading.impact}
            ctaLabel={riskReading.ctaLabel}
            onClick={scrollToBillingActions}
          />
          <NextBestActionCard
            title={nextBestAction.title}
            entity={`Billing SaaS • ${meta.title} • ${statusLabel(status)}`}
            reason={nextBestAction.reason}
            impact={nextBestAction.impact}
            safetyNote="Esta ação apenas orienta e leva para ações administrativas já existentes. Nenhum pagamento, cancelamento, cobrança ou comunicação é executado automaticamente."
            primaryActionLabel={nextBestAction.title}
            onPrimaryAction={scrollToBillingActions}
            secondaryActionLabel="Atualizar leitura"
            onSecondaryAction={() =>
              refreshBilling([
                plansQuery.refetch,
                statusQuery.refetch,
                limitsQuery.refetch,
                readinessQuery.refetch,
              ])
            }
          />
        </section>

        <OperationalFlowCard
          title="Fluxo Plano → Assinatura → Fatura → Pagamento → Acesso"
          subtitle="Billing controla a assinatura da empresa no Nexo, separado do Financeiro de clientes."
          stages={flowStages}
        />

        <EntityTimelineCard
          title="Histórico oficial de Billing"
          subtitle="Prova operacional da assinatura baseada apenas em faturas, pagamentos e eventos reais retornados pelo Billing. Se não houver eventos, nenhum histórico fictício é criado."
          events={timelineEvents}
          fullTimelineLabel="Revisar histórico na tabela"
          onFullTimeline={() =>
            document
              .getElementById("billing-history")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />

        <AppKpiRow
          items={[
            {
              title: "Plano atual",
              value: meta.title,
              hint: "Plano contratado para a organização.",
            },
            {
              title: "Status",
              value: statusLabel(status),
              hint: "Estado SaaS da conta.",
            },
            {
              title: "Renovação",
              value: formatDate(nextChargeAt),
              hint: "Próximo ciclo informado pelo billing.",
            },
            {
              title: "Próxima cobrança",
              value: brl(nextChargeValue),
              hint: "Valor previsto do próximo ciclo.",
            },
          ]}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <AppSectionBlock
            title="Assinatura"
            subtitle="Plano, valor e periodicidade contratados."
          >
            <AppDataTable>
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-3 text-[var(--text-muted)]">Plano</td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {meta.title}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-3 text-[var(--text-muted)]">Valor</td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {brl(meta.priceCents)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 text-[var(--text-muted)]">
                    Periodicidade
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {meta.periodicity}
                  </td>
                </tr>
              </tbody>
            </AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima cobrança"
            subtitle="Data, valor e status da próxima cobrança SaaS."
          >
            <AppDataTable>
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-3 text-[var(--text-muted)]">Data</td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {formatDate(nextChargeAt)}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-3 text-[var(--text-muted)]">Valor</td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {brl(nextChargeValue)}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 text-[var(--text-muted)]">Status</td>
                  <td className="px-3 py-3">
                    <AppStatusBadge
                      label={
                        status === "PAST_DUE" ? "Falha/Pendente" : "Agendada"
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock
            title="Forma de pagamento"
            subtitle="Método atual e ação para atualização via checkout."
          >
            <AppDataTable>
              <tbody>
                <tr className="border-b border-[var(--border-subtle)]/60">
                  <td className="px-3 py-3 text-[var(--text-muted)]">
                    Método atual
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--text-primary)]">
                    {paymentMethod}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-3 text-[var(--text-muted)]">Editar</td>
                  <td className="px-3 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startCheckout(currentPlan)}
                      disabled={currentPlan === "FREE"}
                    >
                      Atualizar pagamento
                    </Button>
                  </td>
                </tr>
              </tbody>
            </AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock
            title="Status da conta"
            subtitle="Estado comercial que controla acesso e risco de bloqueio."
          >
            <AppKpiRow
              items={[
                {
                  title: "ACTIVE",
                  value: status === "ACTIVE" ? "Atual" : "—",
                  hint: "Conta regular.",
                },
                {
                  title: "TRIAL",
                  value: status === "TRIAL" ? "Atual" : "—",
                  hint: "Período de avaliação.",
                },
                {
                  title: "PAST_DUE",
                  value: status === "PAST_DUE" ? "Atual" : "—",
                  hint: "Pagamento em atraso.",
                },
                {
                  title: "CANCELED",
                  value: status === "CANCELED" ? "Atual" : "—",
                  hint: "Conta cancelada.",
                },
              ]}
            />
          </AppSectionBlock>
        </div>

        <AppSectionBlock
          title="Histórico"
          subtitle="Faturas, pagamentos e falhas registradas pelo billing."
        >
          <div id="billing-history" />
          <AppDataTable className="min-w-[820px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Fatura/evento</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length ? (
                invoices.slice(0, 10).map((event: any, index: number) => (
                  <tr
                    key={String(event?.id ?? index)}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3">
                      {formatDate(event?.createdAt ?? event?.date)}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-primary)]">
                      {String(
                        event?.description ??
                          event?.type ??
                          "Fatura da plataforma"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {brl(invoiceAmount(event, meta.priceCents))}
                    </td>
                    <td className="px-3 py-3">
                      <AppStatusBadge
                        label={String(event?.status ?? "Registrado")}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Sem faturas ou falhas retornadas pela fonte de billing.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock
          title="Ações"
          subtitle="Trocar plano, atualizar pagamento ou cancelar assinatura."
        >
          <div id="billing-actions" />
          <AppDataTable className="min-w-[760px]">
            <tbody>
              <tr className="border-b border-[var(--border-subtle)]/60">
                <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                  Trocar plano
                </td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">
                  Abre checkout para alterar a assinatura.
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    onClick={() =>
                      startCheckout(
                        currentPlan === "STARTER" ? "PRO" : "STARTER"
                      )
                    }
                    disabled={!stripeConfigured}
                  >
                    Trocar plano
                  </Button>
                </td>
              </tr>
              <tr className="border-b border-[var(--border-subtle)]/60">
                <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                  Atualizar pagamento
                </td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">
                  Corrige cartão/método para evitar PAST_DUE.
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startCheckout(currentPlan)}
                    disabled={currentPlan === "FREE"}
                  >
                    Atualizar pagamento
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                  Cancelar assinatura
                </td>
                <td className="px-3 py-3 text-[var(--text-secondary)]">
                  Solicita cancelamento para o próximo ciclo.
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cancelMutation.mutate()}
                    disabled={
                      cancelMutation.isPending || currentPlan === "FREE"
                    }
                  >
                    {cancelMutation.isPending ? "Cancelando..." : "Cancelar"}
                  </Button>
                </td>
              </tr>
            </tbody>
          </AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
