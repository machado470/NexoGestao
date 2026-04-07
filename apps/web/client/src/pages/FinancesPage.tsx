import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  getErrorMessage,
  getQueryUiState,
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
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
  dueDate?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  phone?: string | null;
  customerPhone?: string | null;
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
  const [whatsAppOpeningId, setWhatsAppOpeningId] = useState<string | null>(null);
  const [paymentDoneId, setPaymentDoneId] = useState<string | null>(null);

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

  const paymentById = useMemo(
    () => normalizeObjectPayload<FinancePayment>(paymentByIdQuery.data),
    [paymentByIdQuery.data]
  );

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
    () => normalizeArrayPayload<FinanceCharge>(chargesQuery.data),
    [chargesQuery.data]
  );

  const scopedCharge = useMemo(
    () => normalizeObjectPayload<FinanceCharge>(chargeByIdQuery.data),
    [chargeByIdQuery.data]
  );

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

  const timelineData = useMemo(() => {
    const ordered = [...finalVisibleCharges];
    if (ordered.length === 0) {
      return [];
    }

    const points = ordered
      .map((charge, index) => {
        const dateRaw =
          charge.dueDate ?? charge.updatedAt ?? charge.createdAt ?? new Date();
        const parsed = new Date(dateRaw);
        const day = Number.isNaN(parsed.getTime())
          ? `D${index + 1}`
          : parsed.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            });

        const normalized = normalizeStatus(charge.status);

        return {
          day,
          paid: normalized === "PAID" ? Math.max(charge.amountCents || 0, 0) : 0,
          pending:
            normalized !== "PAID" && normalized !== "OVERDUE"
              ? Math.max(charge.amountCents || 0, 0)
              : 0,
          overdue:
            normalized === "OVERDUE" ? Math.max(charge.amountCents || 0, 0) : 0,
        };
      })
      .slice(0, 12);

    return points;
  }, [finalVisibleCharges]);

  const billingQueue = useMemo(() => {
    const ranked = finalVisibleCharges
      .filter((charge) => normalizeStatus(charge.status) !== "PAID")
      .map((charge) => {
        const normalized = normalizeStatus(charge.status);
        const dueDateRaw = charge.dueDate ?? charge.updatedAt ?? charge.createdAt ?? null;
        const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
        const dueTime = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.getTime() : Number.MAX_SAFE_INTEGER;

        return {
          charge,
          normalized,
          priority: normalized === "OVERDUE" ? 0 : 1,
          dueTime,
        };
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.dueTime - b.dueTime;
      });

    return ranked.slice(0, 8);
  }, [finalVisibleCharges]);

  const stats = useMemo(
    () => normalizeObjectPayload<FinanceStats>(statsQuery.data),
    [statsQuery.data]
  );

  const nextAction = useMemo(() => {
    const overdue = billingQueue.find((item) => item.normalized === "OVERDUE");
    if (overdue) {
      return {
        severity: "critical" as const,
        title: "Cobrança vencida detectada",
        description: "Priorize contato imediato por WhatsApp para reduzir atraso de caixa.",
        ctaLabel: "Cobrar no WhatsApp",
        onClick: () => {
          const phone = String(
            overdue.charge.customerPhone ?? overdue.charge.phone ?? ""
          ).trim();
          if (phone) window.open(`https://wa.me/${phone}`, "_blank");
          else navigate("/whatsapp");
        },
      };
    }

    if (isPaymentScoped && paymentById?.id) {
      return {
        severity: "healthy" as const,
        title: "Pagamento registrado",
        description: "Feche o ciclo operacional marcando a O.S. como concluída e com resultado.",
        ctaLabel: "Ir para O.S.",
        onClick: () => {
          const serviceOrderId = String(paymentScopedCharge?.serviceOrderId ?? "").trim();
          if (serviceOrderId) navigate(`/service-orders?os=${serviceOrderId}`);
          else navigate("/service-orders");
        },
      };
    }

    return {
      severity: "attention" as const,
      title: "Monitorar fila de cobrança",
      description: "Sem urgências críticas no momento. Siga a fila priorizada automaticamente.",
      ctaLabel: "Ver fila",
      onClick: () => navigate("/finances"),
    };
  }, [billingQueue, isPaymentScoped, navigate, paymentById?.id, paymentScopedCharge?.serviceOrderId]);

  function getSeverityClass(severity: "critical" | "attention" | "healthy") {
    if (severity === "critical") return "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20";
    if (severity === "healthy") return "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20";
    return "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20";
  }

  const hasRenderableData =
    chargesQuery.data !== undefined ||
    isServiceOrderScoped ||
    statsQuery.data !== undefined;

  const queryState = getQueryUiState(
    [
      chargesQuery,
      ...(isServiceOrderScoped ? [] : [statsQuery]),
      chargeByIdQuery,
      paymentByIdQuery,
    ],
    hasRenderableData
  );

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

  if (queryState.isInitialLoading) {
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

  if (queryState.shouldBlockForError) {
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
        description="Cobrança conectada à execução: acompanhe pendências, recebimentos e próximos passos comerciais."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              Priorizar cobranças
            </button>
            <button
              type="button"
              onClick={() => navigate("/service-orders")}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Ir para Ordens de Serviço
            </button>
          </div>
        }
      />

      {queryState.hasBackgroundUpdate ? (
        <SurfaceSection className="border-blue-500/30 bg-blue-500/10 text-sm text-blue-200">
          Atualizando financeiro em segundo plano...
        </SurfaceSection>
      ) : null}

      {hasError && !queryState.shouldBlockForError ? (
        <SurfaceSection className="border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
          {errorMessage}
        </SurfaceSection>
      ) : null}

      {stats && !isServiceOrderScoped && (
        <FinanceOverviewAreaChart timeline={timelineData} />
      )}

      <SurfaceSection className={getSeverityClass(nextAction.severity)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
              Próxima ação
            </p>
            <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
              {nextAction.title}
            </p>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {nextAction.description}
            </p>
          </div>
          <Button onClick={nextAction.onClick}>{nextAction.ctaLabel}</Button>
        </div>
      </SurfaceSection>

      {billingQueue.length > 0 && (
        <SurfaceSection className="space-y-3">
          <div>
            <h2 className="nexo-section-title">Fila de cobrança</h2>
            <p className="nexo-section-description">
              Ordem automática por vencido primeiro e mais antigo no topo.
            </p>
          </div>

          {billingQueue.map(({ charge, normalized }) => (
            <Card
              key={`queue-${charge.id}`}
              className="nexo-surface border-slate-200/70 bg-white/90 dark:border-white/8"
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <div className="min-w-0">
                  <p>{charge.customer?.name || "Cliente sem nome"}</p>
                  <p
                    className={`text-sm ${
                      normalized === "OVERDUE"
                        ? "text-red-600 dark:text-red-300"
                        : "text-gray-500"
                    }`}
                  >
                    {formatCurrencyFromCents(charge.amountCents)} • {normalized}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setWhatsAppOpeningId(charge.id);
                      const customerPhone = String(
                        charge.customerPhone ?? charge.phone ?? ""
                      ).trim();
                      if (customerPhone) {
                        window.open(`https://wa.me/${customerPhone}`, "_blank");
                      } else {
                        navigate("/whatsapp");
                      }
                      setTimeout(() => setWhatsAppOpeningId(null), 1300);
                    }}
                  >
                    {whatsAppOpeningId === charge.id ? "WhatsApp aberto" : "WhatsApp"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={async () => {
                      try {
                        await registerPayment(charge, "CASH");
                        setPaymentDoneId(charge.id);
                        setTimeout(() => setPaymentDoneId(null), 1500);
                        void chargesQuery.refetch();
                      } catch {
                        // handled by hook
                      }
                    }}
                  >
                    {isSubmitting
                      ? "Processando..."
                      : paymentDoneId === charge.id
                        ? "Pago registrado"
                        : "Marcar pago"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </SurfaceSection>
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
                  : "Financeiro pronto para começar"
            }
            description={
              chargeIdFromUrl
                ? "A cobrança solicitada não foi localizada neste workspace."
                : isPaymentScoped
                  ? "O pagamento solicitado não foi localizado neste workspace."
                  : "Quando a primeira O.S. gerar cobrança, esta tela passa a mostrar pendências, recebimentos e evolução do caixa."
            }
            action={{
              label: "Atualizar financeiro",
              onClick: () => void chargesQuery.refetch(),
            }}
            secondaryAction={{
              label: "Ir para Ordens de Serviço",
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
                  <Badge
                    className={
                      normalizeStatus(c.status) === "OVERDUE"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : normalizeStatus(c.status) === "PENDING"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : normalizeStatus(c.status) === "PAID"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : ""
                    }
                  >
                    {c.status}
                  </Badge>
                  {normalizeStatus(c.status) !== "PAID" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={async () => {
                        try {
                          const result = (await registerPayment(c, "CASH")) as
                            | { paymentId?: string }
                            | undefined;
                          setPaymentDoneId(c.id);
                          setTimeout(() => setPaymentDoneId(null), 1500);
                          const paymentId = String(result?.paymentId ?? "").trim();
                          const params = new URLSearchParams();
                          params.set("chargeId", c.id);
                          if (paymentId) params.set("paymentId", paymentId);
                          if (customerIdFromUrl) {
                            params.set("customerId", customerIdFromUrl);
                          }
                          navigate(`/finances?${params.toString()}`);
                        } catch {
                          // feedback handled in useChargeActions
                        }
                      }}
                    >
                      {isSubmitting
                        ? "Processando..."
                        : paymentDoneId === c.id
                          ? "Pago registrado"
                          : "Marcar pago"}
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
