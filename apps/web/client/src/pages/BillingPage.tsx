// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { normalizeArrayPayload } from "@/lib/query-helpers";

type PlanName = "FREE" | "STARTER" | "PRO" | "BUSINESS";
type AccountStatus = "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELED";

const PLAN_PRICE_ID: Record<PlanName, string | null> = {
  FREE: null,
  STARTER: "price_starter",
  PRO: "price_pro",
  BUSINESS: "price_business",
};

const PLAN_META: Record<PlanName, { title: string; priceCents: number; periodicity: string }> = {
  FREE: { title: "Essencial", priceCents: 0, periodicity: "mensal" },
  STARTER: { title: "Starter", priceCents: 19900, periodicity: "mensal" },
  PRO: { title: "Pro", priceCents: 49900, periodicity: "mensal" },
  BUSINESS: { title: "Scale", priceCents: 99900, periodicity: "mensal" },
};

function brl(valueCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueCents / 100);
}

function safePlanName(value: unknown): PlanName {
  const candidate = String(value ?? "FREE").toUpperCase();
  const normalized = candidate === "SCALE" ? "BUSINESS" : candidate;
  return ["FREE", "STARTER", "PRO", "BUSINESS"].includes(normalized) ? (normalized as PlanName) : "FREE";
}

function accountStatus(value: unknown): AccountStatus {
  const status = String(value ?? "ACTIVE").toUpperCase();
  if (status === "TRIALING") return "TRIAL";
  if (["ACTIVE", "TRIAL", "PAST_DUE", "CANCELED"].includes(status)) return status as AccountStatus;
  return "ACTIVE";
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function invoiceAmount(event: any, fallbackCents: number) {
  const amount = Number(event?.amountCents ?? event?.amount ?? event?.totalCents ?? fallbackCents);
  return Number.isFinite(amount) ? amount : fallbackCents;
}

export default function BillingPage() {
  const plansQuery = trpc.billing.plans.useQuery(undefined, { retry: false });
  const statusQuery = trpc.billing.status.useQuery(undefined, { retry: false });
  const limitsQuery = trpc.billing.limits.useQuery(undefined, { retry: false });
  const readinessQuery = trpc.integrations.readiness.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();

  const plans = useMemo(() => normalizeArrayPayload<any>(plansQuery.data), [plansQuery.data]);
  const currentPlan = safePlanName(statusQuery.data?.plan ?? limitsQuery.data?.plan);
  const meta = PLAN_META[currentPlan];
  const status = accountStatus(statusQuery.data?.status ?? limitsQuery.data?.status);
  const stripeConfigured = readinessQuery.data?.integrations?.stripe === "configured" || readinessQuery.data?.stripe?.configured === true;
  const nextChargeAt = statusQuery.data?.nextBillingAt ?? statusQuery.data?.currentPeriodEnd ?? limitsQuery.data?.trial?.endsAt;
  const nextChargeValue = Number(statusQuery.data?.nextAmountCents ?? statusQuery.data?.amountCents ?? meta.priceCents);
  const paymentMethod = String(statusQuery.data?.paymentMethodBrand ?? statusQuery.data?.paymentMethod ?? "Não informado");
  const invoices = Array.isArray(statusQuery.data?.events) ? statusQuery.data.events : [];

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

  const startCheckout = (plan: PlanName) => {
    if (!stripeConfigured) {
      toast.error("Checkout indisponível sem Stripe configurado.");
      return;
    }
    const priceId = PLAN_PRICE_ID[plan];
    if (!priceId) return;
    checkoutMutation.mutate({ priceId, successUrl: `${window.location.origin}/billing`, cancelUrl: `${window.location.origin}/billing` });
  };

  return (
    <PageWrapper title="Billing" subtitle="Assinatura SaaS, cobrança, pagamento e status da conta.">
      <AppPageShell>
        <AppOperationalHeader
          title="Billing SaaS"
          description="Controle de assinatura separado do financeiro operacional: plano atual, renovação, cobrança e ações de conta."
          primaryAction={<Button onClick={() => startCheckout(currentPlan === "PRO" ? "BUSINESS" : "PRO")} disabled={checkoutMutation.isPending || !stripeConfigured}>Trocar plano</Button>}
          secondaryActions={<Button variant="outline" onClick={() => void Promise.all([plansQuery.refetch(), statusQuery.refetch(), limitsQuery.refetch(), readinessQuery.refetch()])}>Atualizar billing</Button>}
          contextChips={<><AppStatusBadge label={currentPlan} /><AppStatusBadge label={status} /><AppStatusBadge label={`Renovação ${formatDate(nextChargeAt)}`} /></>}
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
            <span><strong>ACTIVE:</strong> assinatura regular.</span>
            <span><strong>TRIAL:</strong> avaliação em andamento.</span>
            <span><strong>PAST_DUE:</strong> cobrança pendente.</span>
            <span><strong>CANCELED:</strong> assinatura cancelada.</span>
          </div>
        </AppFiltersBar>

        <AppKpiRow items={[{ title: "Plano atual", value: meta.title, hint: "Plano contratado para a organização." }, { title: "Status", value: status, hint: "Estado SaaS da conta." }, { title: "Renovação", value: formatDate(nextChargeAt), hint: "Próximo ciclo informado pelo billing." }, { title: "Próxima cobrança", value: brl(nextChargeValue), hint: "Valor previsto do próximo ciclo." }]} />

        <div className="grid gap-4 xl:grid-cols-2">
          <AppSectionBlock title="Assinatura" subtitle="Plano, valor e periodicidade contratados.">
            <AppDataTable><tbody><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-muted)]">Plano</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{meta.title}</td></tr><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-muted)]">Valor</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{brl(meta.priceCents)}</td></tr><tr><td className="px-3 py-3 text-[var(--text-muted)]">Periodicidade</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{meta.periodicity}</td></tr></tbody></AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock title="Próxima cobrança" subtitle="Data, valor e status da próxima cobrança SaaS.">
            <AppDataTable><tbody><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-muted)]">Data</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{formatDate(nextChargeAt)}</td></tr><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-muted)]">Valor</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{brl(nextChargeValue)}</td></tr><tr><td className="px-3 py-3 text-[var(--text-muted)]">Status</td><td className="px-3 py-3"><AppStatusBadge label={status === "PAST_DUE" ? "Falha/Pendente" : "Agendada"} /></td></tr></tbody></AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock title="Forma de pagamento" subtitle="Método atual e ação para atualização via checkout.">
            <AppDataTable><tbody><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 text-[var(--text-muted)]">Método atual</td><td className="px-3 py-3 font-semibold text-[var(--text-primary)]">{paymentMethod}</td></tr><tr><td className="px-3 py-3 text-[var(--text-muted)]">Editar</td><td className="px-3 py-3"><Button size="sm" variant="outline" onClick={() => startCheckout(currentPlan)} disabled={currentPlan === "FREE"}>Atualizar pagamento</Button></td></tr></tbody></AppDataTable>
          </AppSectionBlock>

          <AppSectionBlock title="Status da conta" subtitle="Estado comercial que controla acesso e risco de bloqueio.">
            <AppKpiRow items={[{ title: "ACTIVE", value: status === "ACTIVE" ? "Atual" : "—", hint: "Conta regular." }, { title: "TRIAL", value: status === "TRIAL" ? "Atual" : "—", hint: "Período de avaliação." }, { title: "PAST_DUE", value: status === "PAST_DUE" ? "Atual" : "—", hint: "Pagamento em atraso." }, { title: "CANCELED", value: status === "CANCELED" ? "Atual" : "—", hint: "Conta cancelada." }]} />
          </AppSectionBlock>
        </div>

        <AppSectionBlock title="Histórico" subtitle="Faturas, pagamentos e falhas registradas pelo billing.">
          <AppDataTable className="min-w-[820px]"><thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]"><th className="px-3 py-2">Data</th><th className="px-3 py-2">Fatura/evento</th><th className="px-3 py-2">Valor</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{invoices.length ? invoices.slice(0, 10).map((event: any, index: number) => <tr key={String(event?.id ?? index)} className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3">{formatDate(event?.createdAt ?? event?.date)}</td><td className="px-3 py-3 text-[var(--text-primary)]">{String(event?.description ?? event?.type ?? "Fatura da plataforma")}</td><td className="px-3 py-3">{brl(invoiceAmount(event, meta.priceCents))}</td><td className="px-3 py-3"><AppStatusBadge label={String(event?.status ?? "Registrado")} /></td></tr>) : <tr><td colSpan={4} className="px-3 py-4 text-[var(--text-muted)]">Sem faturas ou falhas retornadas pela fonte de billing.</td></tr>}</tbody></AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock title="Ações" subtitle="Trocar plano, atualizar pagamento ou cancelar assinatura.">
          <AppDataTable className="min-w-[760px]"><tbody><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 font-medium text-[var(--text-primary)]">Trocar plano</td><td className="px-3 py-3 text-[var(--text-secondary)]">Abre checkout para alterar a assinatura.</td><td className="px-3 py-3 text-right"><Button size="sm" onClick={() => startCheckout(currentPlan === "STARTER" ? "PRO" : "STARTER")} disabled={!stripeConfigured}>Trocar plano</Button></td></tr><tr className="border-b border-[var(--border-subtle)]/60"><td className="px-3 py-3 font-medium text-[var(--text-primary)]">Atualizar pagamento</td><td className="px-3 py-3 text-[var(--text-secondary)]">Corrige cartão/método para evitar PAST_DUE.</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => startCheckout(currentPlan)} disabled={currentPlan === "FREE"}>Atualizar pagamento</Button></td></tr><tr><td className="px-3 py-3 font-medium text-[var(--text-primary)]">Cancelar assinatura</td><td className="px-3 py-3 text-[var(--text-secondary)]">Solicita cancelamento para o próximo ciclo.</td><td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || currentPlan === "FREE"}>{cancelMutation.isPending ? "Cancelando..." : "Cancelar"}</Button></td></tr></tbody></AppDataTable>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
