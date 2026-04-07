import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/query-helpers";
import { normalizeStatus } from "@/lib/operations/operations.utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FinanceOverviewAreaChart from "@/components/finance/FinanceOverviewAreaChart";
import { Loader2, Receipt } from "lucide-react";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";
import { useChargeActions } from "@/hooks/useChargeActions";

type FinanceCharge = {
  id: string;
  customerId?: string | null;
  serviceOrderId?: string | null;
  customer?: { name?: string | null } | null;
  amountCents: number;
  status: string;
  payments?: Array<{ id?: string | null }>;
};

type FinancePayment = {
  id: string;
  chargeId?: string | null;
  amountCents?: number;
  method?: string;
};

type FinanceStats = {
  paid?: { amountCents?: number };
  pending?: { amountCents?: number };
  overdue?: { amountCents?: number };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeExtractCharges(payload: unknown): FinanceCharge[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as FinanceCharge[];
  if (!isObject(payload)) return [];

  const data = payload.data;
  if (Array.isArray(data)) return data as FinanceCharge[];
  if (isObject(data) && Array.isArray(data.items)) return data.items as FinanceCharge[];
  if (Array.isArray(payload.items)) return payload.items as FinanceCharge[];

  return [];
}

function safeExtractStats(payload: unknown): FinanceStats | null {
  if (!payload) return null;
  if (!isObject(payload)) return null;
  if (isObject(payload.data)) return payload.data as FinanceStats;
  return payload as FinanceStats;
}

function formatCurrencyFromCents(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

export default function FinancesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadFinance = isAuthenticated;

  const [location, navigate] = useLocation();

  const searchParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const serviceOrderIdFromUrl = searchParams.get("serviceOrderId") || "";
  const customerIdFromUrl = searchParams.get("customerId") || "";
  const chargeIdFromUrl = searchParams.get("chargeId") || "";
  const paymentIdFromUrl = searchParams.get("paymentId") || "";
  const isServiceOrderScoped = Boolean(serviceOrderIdFromUrl);
  const isPaymentScoped = Boolean(paymentIdFromUrl);

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 100,
      serviceOrderId: serviceOrderIdFromUrl || undefined,
    },
    { enabled: canLoadFinance, retry: false }
  );

  const statsQuery = trpc.finance.charges.stats.useQuery(
    {},
    {
      enabled: canLoadFinance && !isServiceOrderScoped,
      retry: false,
    }
  );

  const paymentByIdQuery = trpc.finance.payments.getById.useQuery(
    { id: paymentIdFromUrl },
    {
      enabled: canLoadFinance && Boolean(paymentIdFromUrl),
      retry: false,
    }
  );

  const paymentById = useMemo(() => {
    const payload = paymentByIdQuery.data as
      | FinancePayment
      | { data?: FinancePayment }
      | null
      | undefined;
    if (!payload) return null;
    if ("id" in (payload as Record<string, unknown>)) return payload as FinancePayment;
    if (payload && typeof payload === "object" && "data" in payload) {
      const data = (payload as { data?: FinancePayment }).data;
      return data ?? null;
    }
    return null;
  }, [paymentByIdQuery.data]);

  const resolvedChargeIdFromPayment = useMemo(() => {
    if (!paymentById) return null;
    const fromPayment = String(paymentById.chargeId ?? "").trim();
    return fromPayment || null;
  }, [paymentById]);

  const effectiveChargeId = chargeIdFromUrl || resolvedChargeIdFromPayment || "";

  const chargeByIdQuery = trpc.finance.charges.getById.useQuery(
    { id: effectiveChargeId },
    {
      enabled: canLoadFinance && Boolean(effectiveChargeId),
      retry: false,
    }
  );

  const { registerPayment, isSubmitting } = useChargeActions({
    location,
    navigate,
    returnPath: "/finances",
    refreshActions: [
      async () => {
        await chargesQuery.refetch();
      },
      async () => {
        if (effectiveChargeId) {
          await chargeByIdQuery.refetch();
        }
      },
      async () => {
        if (paymentIdFromUrl) {
          await paymentByIdQuery.refetch();
        }
      },
    ],
  });

  const charges = useMemo(
    () => safeExtractCharges(chargesQuery.data),
    [chargesQuery.data]
  );

  const scopedCharge = useMemo(() => {
    const payload = chargeByIdQuery.data as
      | FinanceCharge
      | { data?: FinanceCharge }
      | null
      | undefined;
    if (!payload) return null;
    if ("id" in (payload as Record<string, unknown>)) return payload as FinanceCharge;
    if (payload && typeof payload === "object" && "data" in payload) {
      const data = (payload as { data?: FinanceCharge }).data;
      return data ?? null;
    }
    return null;
  }, [chargeByIdQuery.data]);

  const visibleCharges = useMemo(() => {
    if (scopedCharge) return [scopedCharge];
    if (effectiveChargeId) return [];
    return charges.filter((charge) => {
      if (
        customerIdFromUrl &&
        String(charge.customerId ?? "") !== String(customerIdFromUrl)
      ) {
        return false;
      }
      return true;
    });
  }, [charges, effectiveChargeId, customerIdFromUrl, scopedCharge]);

  const paymentScopedCharge = useMemo(() => {
    if (!paymentIdFromUrl) return null;

    if (resolvedChargeIdFromPayment) {
      if (scopedCharge && String(scopedCharge.id) === resolvedChargeIdFromPayment) {
        return scopedCharge;
      }

      const directMatch = charges.find(
        (charge) => String(charge.id) === resolvedChargeIdFromPayment
      );
      if (directMatch) return directMatch;
    }

    return (
      visibleCharges.find((charge) =>
        (charge.payments ?? []).some(
          (payment) => String(payment?.id ?? "") === paymentIdFromUrl
        )
      ) ?? null
    );
  }, [
    paymentIdFromUrl,
    resolvedChargeIdFromPayment,
    scopedCharge,
    charges,
    visibleCharges,
  ]);

  const finalVisibleCharges = useMemo(() => {
    if (paymentScopedCharge) return [paymentScopedCharge];
    return visibleCharges;
  }, [paymentScopedCharge, visibleCharges]);

  const stats = useMemo(
    () => safeExtractStats(statsQuery.data),
    [statsQuery.data]
  );

  const hasNormalizedCharges = chargesQuery.data !== undefined;
  const hasNormalizedStats =
    isServiceOrderScoped || statsQuery.data !== undefined;
  const hasReusableData = hasNormalizedCharges || hasNormalizedStats;

  const hasError =
    chargesQuery.isError ||
    (!isServiceOrderScoped && statsQuery.isError) ||
    chargeByIdQuery.isError ||
    paymentByIdQuery.isError;

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(statsQuery.error, "") ||
    getErrorMessage(chargeByIdQuery.error, "") ||
    getErrorMessage(paymentByIdQuery.error, "") ||
    "Erro ao carregar";

  const hasAnyActiveLoading =
    chargesQuery.isLoading ||
    (!isServiceOrderScoped && statsQuery.isLoading) ||
    chargeByIdQuery.isLoading ||
    paymentByIdQuery.isLoading;

  const isInitialLoading = hasAnyActiveLoading && !hasReusableData;

  const shouldBlockForError = hasError && !hasReusableData;

  if (isInitializing) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Financeiro"
          title="Financeiro"
          description="Validando sessão e restaurando o contexto financeiro."
        />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Financeiro"
          title="Financeiro"
          description="Sua sessão não está ativa."
        />
      </PageShell>
    );
  }

  if (isInitialLoading) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Financeiro"
          title="Financeiro"
          description="Leitura consolidada de cobrança, recebimento e pendências sem alterar o fluxo funcional."
        />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center">
          <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados financeiros...
          </div>
        </SurfaceSection>
      </PageShell>
    );
  }

  if (shouldBlockForError) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Financeiro"
          title="Financeiro"
          description="Não foi possível carregar os dados financeiros."
        />
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          {errorMessage}
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Financeiro"
        title="Financeiro"
        description="Leitura consolidada de cobrança, recebimento e pendências sem alterar o fluxo funcional."
        actions={
          <button
            type="button"
            onClick={() => navigate("/service-orders")}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ir para Ordens de Serviço
          </button>
        }
      />

      {stats && !isServiceOrderScoped && (
        <FinanceOverviewAreaChart
          paidAmount={stats.paid?.amountCents || 0}
          pendingAmount={stats.pending?.amountCents || 0}
          overdueAmount={stats.overdue?.amountCents || 0}
        />
      )}

      {finalVisibleCharges.length === 0 ? (
        <SurfaceSection className="space-y-3">
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title={
              chargeIdFromUrl
                ? "Cobrança não encontrada"
                : isPaymentScoped
                  ? "Pagamento não encontrado"
                  : "Sem cobranças registradas"
            }
            description={
              chargeIdFromUrl
                ? "A cobrança solicitada não foi localizada neste workspace."
                : isPaymentScoped
                  ? "O pagamento solicitado não foi localizado neste workspace."
                  : "Assim que uma cobrança for criada, o financeiro passa a mostrar pendências, pagamentos e evolução do caixa."
            }
            action={{
              label: "Atualizar dados",
              onClick: () => void chargesQuery.refetch(),
            }}
            secondaryAction={{
              label: "Abrir O.S.",
              onClick: () => navigate("/service-orders"),
            }}
          />
          <DemoEnvironmentCta />
        </SurfaceSection>
      ) : (
        <div className="space-y-3">
          {finalVisibleCharges.map((c) => (
            <Card
              key={c.id}
              className="nexo-surface border-slate-200/70 bg-white/90 dark:border-white/8"
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="min-w-0">
                  <p>{c.customer?.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrencyFromCents(c.amountCents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{c.status}</Badge>
                  {normalizeStatus(c.status) !== "PAID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={async () => {
                        const result = (await registerPayment(c, "CASH")) as
                          | { paymentId?: string }
                          | undefined;
                        const paymentId = String(result?.paymentId ?? "").trim();
                        const params = new URLSearchParams();
                        params.set("chargeId", c.id);
                        if (paymentId) params.set("paymentId", paymentId);
                        if (customerIdFromUrl) params.set("customerId", customerIdFromUrl);
                        navigate(`/finances?${params.toString()}`);
                      }}
                    >
                      Marcar pago
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
