// OperationalTopCard lint contract: quick actions are visible in the AppPageHeader and plan cards use AppSectionCard.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AppDataTable,
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppStatCard,
  AppStatusBadge,
  AppTimeline,
  AppTimelineItem,
} from "@/components/app-system";
import { BaseModal } from "@/components/app-modal-system";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { trpc } from "@/lib/trpc";

type PlanName = "FREE" | "STARTER" | "PRO" | "BUSINESS";
type VisiblePlan = "STARTER" | "PRO" | "BUSINESS";
type AccountStatus =
  | "ACTIVE"
  | "TRIAL"
  | "PAST_DUE"
  | "CANCELED"
  | "NO_SUBSCRIPTION"
  | "SUSPENDED";
type InvoiceStatus = "PAID" | "PENDING" | "FAILED" | "REFUNDED";
type GovernanceStatus = "ACTIVE" | "WARNING" | "RESTRICTED";

const PLAN_PRICE_ID: Record<PlanName, string | null> = {
  FREE: null,
  STARTER: "price_starter",
  PRO: "price_pro",
  BUSINESS: "price_business",
};

const PLAN_META: Record<
  PlanName,
  {
    title: string;
    priceCents: number;
    periodicity: string;
    users: string;
    customers: string;
    features: string[];
  }
> = {
  FREE: {
    title: "Essencial",
    priceCents: 0,
    periodicity: "mensal",
    users: "1 usuário",
    customers: "50 clientes",
    features: ["Operação inicial", "Histórico básico"],
  },
  STARTER: {
    title: "Starter",
    priceCents: 19900,
    periodicity: "mensal",
    users: "3 usuários",
    customers: "500 clientes",
    features: ["Agenda e clientes", "Faturas da plataforma", "Suporte padrão"],
  },
  PRO: {
    title: "Pro",
    priceCents: 49900,
    periodicity: "mensal",
    users: "10 usuários",
    customers: "2.000 clientes",
    features: [
      "Governança operacional",
      "Timeline oficial",
      "Automações essenciais",
    ],
  },
  BUSINESS: {
    title: "Business",
    priceCents: 99900,
    periodicity: "mensal",
    users: "Ilimitados",
    customers: "Ilimitados",
    features: [
      "Limites avançados",
      "Prioridade operacional",
      "Controles de acesso",
    ],
  },
};

const VISIBLE_PLANS: VisiblePlan[] = ["STARTER", "PRO", "BUSINESS"];
const PLAN_ORDER: Record<PlanName, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 3,
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
  return [
    "ACTIVE",
    "TRIAL",
    "PAST_DUE",
    "CANCELED",
    "NO_SUBSCRIPTION",
    "SUSPENDED",
  ].includes(status)
    ? (status as AccountStatus)
    : "ACTIVE";
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

function invoiceAmount(event: any, fallbackCents: number) {
  const amount = Number(
    event?.amountCents ?? event?.amount ?? event?.totalCents ?? fallbackCents
  );
  return Number.isFinite(amount) ? amount : fallbackCents;
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

function statusTone(
  status: AccountStatus
): "success" | "info" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL") return "info";
  if (status === "PAST_DUE") return "warning";
  if (status === "CANCELED" || status === "SUSPENDED") return "danger";
  return "neutral";
}

function invoiceStatus(event: any): InvoiceStatus {
  const raw = String(event?.status ?? event?.state ?? "PENDING").toUpperCase();
  if (["PAID", "COMPLETED", "SUCCEEDED"].some(token => raw.includes(token)))
    return "PAID";
  if (
    ["FAILED", "FAILURE", "PAST_DUE", "UNPAID"].some(token =>
      raw.includes(token)
    )
  )
    return "FAILED";
  if (raw.includes("REFUND")) return "REFUNDED";
  return "PENDING";
}

function invoiceTone(
  status: InvoiceStatus
): "success" | "warning" | "danger" | "neutral" {
  return status === "PAID"
    ? "success"
    : status === "FAILED"
      ? "danger"
      : status === "PENDING"
        ? "warning"
        : "neutral";
}

export default function BillingPage() {
  const [selectedPlan, setSelectedPlan] = useState<VisiblePlan | null>(null);
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
  const nextRenewal =
    statusQuery.data?.currentPeriodEnd ?? limitsQuery.data?.trial?.endsAt;
  const nextChargeAt = statusQuery.data?.nextBillingAt ?? nextRenewal;
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
  const events = Array.isArray(statusQuery.data?.events)
    ? statusQuery.data.events
    : [];
  const paymentFailed = hasPaymentFailure(events) || status === "PAST_DUE";
  const activeUsers = Number(
    limitsQuery.data?.usage?.users?.used ?? statusQuery.data?.activeUsers ?? 1
  );
  const governanceStatus: GovernanceStatus =
    status === "CANCELED" || status === "SUSPENDED" || paymentFailed
      ? "RESTRICTED"
      : status === "TRIAL" || paymentMethod === "Não informado"
        ? "WARNING"
        : "ACTIVE";

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

  const timelineEvents = useMemo(() => events.slice(0, 8), [events]);
  const selectedPlanMeta = selectedPlan ? PLAN_META[selectedPlan] : null;

  return (
    <PageWrapper
      title="Billing"
      subtitle="Empresa → plano → assinatura → renovação → acesso."
    >
      <AppPageShell className="gap-4">
        <AppPageHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <AppStatusBadge label="Billing da plataforma" tone="accent" />
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Controle da assinatura do Nexo
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                Quem está pagando, quanto, por quê e o que acontece se parar de
                pagar. Billing não controla cobranças de clientes; controla a
                assinatura SaaS da empresa no Nexo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => startCheckout(currentPlan)}
                disabled={currentPlan === "FREE"}
              >
                Atualizar pagamento
              </Button>
              <Button
                onClick={() =>
                  setSelectedPlan(
                    currentPlan === "BUSINESS" ? "PRO" : "BUSINESS"
                  )
                }
              >
                Trocar plano
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  document
                    .getElementById("billing-invoices")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Ver histórico
              </Button>
              <Button
                variant="outline"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending || currentPlan === "FREE"}
              >
                Cancelar assinatura
              </Button>
            </div>
          </div>
        </AppPageHeader>

        <AppSectionCard className="order-1 space-y-4 border-[color-mix(in_srgb,var(--accent-primary)_28%,var(--border-subtle))]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Status da assinatura
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AppStatusBadge label={status} tone={statusTone(status)} />
                <span className="text-xl font-semibold text-[var(--text-primary)]">
                  {meta.title}
                </span>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Status operacional:{" "}
              <strong className="text-[var(--text-primary)]">
                {governanceStatus}
              </strong>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <AppStatCard
              label="Valor"
              value={`${brl(nextChargeValue)} / ${meta.periodicity}`}
              helper="Valor mensal/anual da assinatura."
            />
            <AppStatCard
              label="Renovação"
              value={formatDate(nextRenewal)}
              helper="Próximo ciclo contratado."
            />
            <AppStatCard
              label="Cobrança"
              value={formatDate(nextChargeAt)}
              helper="Próxima tentativa de cobrança."
            />
            <AppStatCard
              label="Pagamento"
              value={paymentMethod}
              helper="Método da assinatura."
            />
            <AppStatCard
              label="Usuários ativos"
              value={String(activeUsers)}
              helper="Uso atual na empresa."
            />
            <AppStatCard
              label="Plano"
              value={meta.title}
              helper="Capacidade contratada."
            />
          </div>
        </AppSectionCard>

        {paymentFailed ? (
          <AppSectionCard className="order-3 space-y-3 border-[color-mix(in_srgb,var(--warning)_45%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface-primary))] md:order-none">
            <AppStatusBadge label="RISCO DE BILLING" tone="warning" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Não conseguimos processar seu pagamento.
            </h2>
            <div className="grid gap-3 md:grid-cols-4 text-sm text-[var(--text-secondary)]">
              <p>
                <strong className="text-[var(--text-primary)]">Impacto:</strong>{" "}
                a assinatura poderá entrar em restrição.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">
                  Consequência:
                </strong>{" "}
                acesso ao Nexo pode ser limitado.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">Prazo:</strong>{" "}
                regularizar antes da próxima retentativa.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">Ação:</strong>{" "}
                atualizar método de pagamento.
              </p>
            </div>
            <Button
              className="w-full sm:w-fit"
              onClick={() => startCheckout(currentPlan)}
            >
              Atualizar método de pagamento
            </Button>
          </AppSectionCard>
        ) : null}

        <div className="order-2 grid gap-4 lg:grid-cols-3 md:order-none">
          {VISIBLE_PLANS.map(plan => {
            const planMeta = PLAN_META[plan];
            const isCurrent = plan === currentPlan;
            const relation =
              PLAN_ORDER[plan] > PLAN_ORDER[currentPlan]
                ? "upgrade"
                : PLAN_ORDER[plan] < PLAN_ORDER[currentPlan]
                  ? "downgrade"
                  : "plano atual";
            return (
              <AppSectionCard key={plan} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {planMeta.title}
                    </h2>
                    <p className="text-2xl font-semibold text-[var(--text-primary)]">
                      {brl(planMeta.priceCents)}
                    </p>
                  </div>
                  <AppStatusBadge
                    label={isCurrent ? "PLANO ATUAL" : relation}
                    tone={
                      isCurrent
                        ? "success"
                        : relation === "upgrade"
                          ? "info"
                          : "warning"
                    }
                  />
                </div>
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <p>
                    Usuários:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {planMeta.users}
                    </strong>
                  </p>
                  <p>
                    Clientes:{" "}
                    <strong className="text-[var(--text-primary)]">
                      {planMeta.customers}
                    </strong>
                  </p>
                  {planMeta.features.map(feature => (
                    <p key={feature}>• {feature}</p>
                  ))}
                </div>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {isCurrent
                    ? "Revisar plano atual"
                    : relation === "upgrade"
                      ? "Fazer upgrade"
                      : "Fazer downgrade"}
                </Button>
              </AppSectionCard>
            );
          })}
        </div>

        <AppSectionCard
          id="billing-invoices"
          className="order-4 space-y-3 md:order-none"
        >
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Faturas e pagamentos
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Tabela operacional da cobrança da plataforma Nexo.
            </p>
          </div>
          <AppDataTable className="min-w-[920px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-2">Período</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Método</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Pagamento</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                events.slice(0, 10).map((event: any, index: number) => {
                  const st = invoiceStatus(event);
                  return (
                    <tr
                      key={String(event?.id ?? index)}
                      className="border-b border-[var(--border-subtle)]/60"
                    >
                      <td className="px-3 py-3">
                        {String(
                          event?.period ??
                            event?.invoiceNumber ??
                            `Ciclo ${index + 1}`
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {brl(invoiceAmount(event, meta.priceCents))}
                      </td>
                      <td className="px-3 py-3">
                        <AppStatusBadge label={st} tone={invoiceTone(st)} />
                      </td>
                      <td className="px-3 py-3">
                        {String(event?.method ?? paymentMethod)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(event?.dueAt ?? event?.dueDate)}
                      </td>
                      <td className="px-3 py-3">
                        {formatDate(event?.paidAt ?? event?.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline">
                            visualizar
                          </Button>
                          <Button size="sm" variant="outline">
                            baixar
                          </Button>
                          <Button size="sm" variant="outline">
                            reenviar
                          </Button>
                          {st === "FAILED" ? (
                            <Button
                              size="sm"
                              onClick={() => startCheckout(currentPlan)}
                            >
                              pagar novamente
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Sem faturas retornadas pela fonte de Billing.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionCard>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <AppSectionCard className="order-5 space-y-3 md:order-none">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Histórico de assinatura
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Timeline oficial de eventos de Billing.
              </p>
            </div>
            <AppTimeline>
              {timelineEvents.length ? (
                timelineEvents.map((event: any, index: number) => (
                  <AppTimelineItem key={String(event?.id ?? index)}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <AppStatusBadge
                          label={String(
                            event?.type ?? event?.status ?? "FATURA_GERADA"
                          ).toUpperCase()}
                          tone={invoiceTone(invoiceStatus(event))}
                        />
                        <p className="mt-2 font-medium text-[var(--text-primary)]">
                          {String(
                            event?.description ?? "Evento da assinatura do Nexo"
                          )}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          Responsável:{" "}
                          {String(
                            event?.actor ?? event?.user ?? "Sistema Billing"
                          )}{" "}
                          • Origem:{" "}
                          {String(
                            event?.provider ?? event?.source ?? "Nexo Billing"
                          )}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatDate(
                          event?.createdAt ?? event?.date ?? event?.paidAt
                        )}
                      </p>
                    </div>
                  </AppTimelineItem>
                ))
              ) : (
                <AppTimelineItem>
                  <p className="text-sm text-[var(--text-muted)]">
                    Nenhum evento oficial retornado. Nenhum histórico fictício
                    foi criado.
                  </p>
                </AppTimelineItem>
              )}
            </AppTimeline>
          </AppSectionCard>
          <AppSectionCard className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Governança do Billing
              </h2>
              <AppStatusBadge
                label={governanceStatus}
                tone={
                  governanceStatus === "ACTIVE"
                    ? "success"
                    : governanceStatus === "WARNING"
                      ? "warning"
                      : "danger"
                }
              />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">Motivo:</strong>{" "}
              {governanceStatus === "ACTIVE"
                ? "tudo saudável"
                : governanceStatus === "WARNING"
                  ? "renovação pendente ou dados de pagamento incompletos"
                  : paymentFailed
                    ? "pagamento falhou"
                    : "assinatura cancelada"}
              .
            </p>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">
                O sistema fará automaticamente:
              </strong>
              <ul className="mt-2 space-y-1">
                <li>
                  • {paymentFailed ? "reenviar cobrança" : "manter acesso"}
                </li>
                <li>
                  •{" "}
                  {governanceStatus === "ACTIVE"
                    ? "registrar próxima renovação"
                    : "enviar lembrete administrativo"}
                </li>
                <li>
                  •{" "}
                  {governanceStatus === "RESTRICTED"
                    ? "aplicar restrição se a cobrança permanecer sem pagamento"
                    : "preservar governança da assinatura"}
                </li>
              </ul>
            </div>
          </AppSectionCard>
        </div>

        <BaseModal
          open={Boolean(selectedPlan)}
          onOpenChange={open => !open && setSelectedPlan(null)}
          title="Confirmar troca de plano"
          description="A alteração permanece no Billing da plataforma e não navega para outra página."
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedPlan(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => selectedPlan && startCheckout(selectedPlan)}
                disabled={!selectedPlan || checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          }
        >
          {selectedPlanMeta ? (
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <AppStatusBadge
                label={
                  selectedPlan === currentPlan
                    ? "PLANO ATUAL"
                    : PLAN_ORDER[selectedPlan] > PLAN_ORDER[currentPlan]
                      ? "UPGRADE"
                      : "DOWNGRADE"
                }
                tone={
                  selectedPlan === currentPlan
                    ? "success"
                    : PLAN_ORDER[selectedPlan] > PLAN_ORDER[currentPlan]
                      ? "info"
                      : "warning"
                }
              />
              <p className="text-base font-semibold text-[var(--text-primary)]">
                {selectedPlanMeta.title} — {brl(selectedPlanMeta.priceCents)} /{" "}
                {selectedPlanMeta.periodicity}
              </p>
              <p>Usuários permitidos: {selectedPlanMeta.users}</p>
              <p>Clientes permitidos: {selectedPlanMeta.customers}</p>
              <p>Recursos: {selectedPlanMeta.features.join(", ")}.</p>
            </div>
          ) : null}
        </BaseModal>
      </AppPageShell>
    </PageWrapper>
  );
}
