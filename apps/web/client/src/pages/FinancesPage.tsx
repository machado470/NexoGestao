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
import {
  buildWhatsAppUrlFromCharge,
  normalizeStatus,
} from "@/lib/operations/operations.utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FinanceOverviewAreaChart from "@/components/finance/FinanceOverviewAreaChart";
import { Receipt } from "lucide-react";
import { PageShell, SmartPage, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/QueryStateBoundary";
import { StatusBadge, mapFinanceStatus } from "@/components/StatusBadge";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";
import { useChargeActions } from "@/hooks/useChargeActions";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import { generateFinanceActions } from "@/lib/smartActions";
import {
  ChargeStatus,
  CHARGE_STATUS_BADGE,
  CHARGE_STATUS_LABEL,
} from "@shared/types/api";
import { ActionBarWrapper } from "@/components/operating-system/ActionBar";
import { PageHeader } from "@/components/operating-system/PageHeader";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";

type FinanceCharge = {
  id: string;
  customerId?: string | null;
  serviceOrderId?: string | null;
  customer?: { name?: string | null } | null;
  amountCents: number;
  status: string | null;
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

type FinanceNormalizedStatus = ChargeStatus | "NONE";
type FinanceQueueStatus = Exclude<FinanceNormalizedStatus, ChargeStatus.CANCELED>;

function normalizeChargeStatus(status?: string | null): FinanceNormalizedStatus {
  const normalized = normalizeStatus(status);
  if (normalized === ChargeStatus.PAID) return ChargeStatus.PAID;
  if (normalized === ChargeStatus.PENDING) return ChargeStatus.PENDING;
  if (normalized === ChargeStatus.OVERDUE) return ChargeStatus.OVERDUE;
  if (normalized === ChargeStatus.CANCELED) return ChargeStatus.CANCELED;
  return "NONE";
}

function getChargeStatusLabel(status: FinanceNormalizedStatus) {
  if (status === "NONE") return "Sem status";
  return CHARGE_STATUS_LABEL[status];
}

function toQueueStatus(status: FinanceNormalizedStatus): FinanceQueueStatus {
  if (status === ChargeStatus.CANCELED) return "NONE";
  return status;
}

function formatCurrencyFromCents(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

export default function FinancesPage() {
  const { track } = useProductAnalytics();
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
  const [paymentSubmittingId, setPaymentSubmittingId] = useState<string | null>(null);

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

        const normalized = toQueueStatus(normalizeChargeStatus(charge.status));

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
      .map((charge) => {
        const normalized = toQueueStatus(normalizeChargeStatus(charge.status));
        const dueDateRaw = charge.dueDate ?? charge.updatedAt ?? charge.createdAt ?? null;
        const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
        const dueTime = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.getTime() : Number.MAX_SAFE_INTEGER;

        return {
          charge,
          normalized,
          priority: normalized === ChargeStatus.OVERDUE ? 0 : 1,
          dueTime,
        };
      })
      .filter((item) => item.normalized !== ChargeStatus.PAID && item.normalized !== "NONE")
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const impactDiff =
          Math.max(b.charge.amountCents || 0, 0) - Math.max(a.charge.amountCents || 0, 0);
        if (impactDiff !== 0) return impactDiff;
        return a.dueTime - b.dueTime;
      });

    return ranked.slice(0, 8);
  }, [finalVisibleCharges]);
  const overdueAmountInQueue = useMemo(
    () =>
      billingQueue
        .filter((item) => item.normalized === ChargeStatus.OVERDUE)
        .reduce((acc, item) => acc + Math.max(item.charge.amountCents || 0, 0), 0),
    [billingQueue]
  );
  const pendingAmountInQueue = useMemo(
    () =>
      billingQueue
        .filter((item) => item.normalized === ChargeStatus.PENDING)
        .reduce((acc, item) => acc + Math.max(item.charge.amountCents || 0, 0), 0),
    [billingQueue]
  );
  const totalOpenAmountInQueue = overdueAmountInQueue + pendingAmountInQueue;

  const stats = useMemo(
    () => normalizeObjectPayload<FinanceStats>(statsQuery.data),
    [statsQuery.data]
  );


  const smartPriorities = useMemo(() => [
    {
      id: "fin-overdue",
      type: "overdue_charges" as const,
      title: "Cobranças vencidas",
      count: billingQueue.filter((item) => item.normalized === ChargeStatus.OVERDUE).length,
      impactCents: billingQueue
        .filter((item) => item.normalized === ChargeStatus.OVERDUE)
        .reduce((acc, item) => acc + Math.max(item.charge.amountCents || 0, 0), 0),
      ctaLabel: "Recuperar cobrança",
      ctaPath: "/finances",
      helperText: "Receita presa no caixa precisa de contato imediato.",
    },
    {
      id: "fin-pending",
      type: "idle_cash" as const,
      title: "Cobranças pendentes",
      count: billingQueue.filter((item) => item.normalized === ChargeStatus.PENDING).length,
      impactCents: billingQueue
        .filter((item) => item.normalized === ChargeStatus.PENDING)
        .reduce((acc, item) => acc + Math.max(item.charge.amountCents || 0, 0), 0),
      ctaLabel: "Seguir fila",
      ctaPath: "/finances",
      helperText: "Pendências de hoje viram vencimento amanhã.",
    },
    {
      id: "fin-risk",
      type: "operational_risk" as const,
      title: "Pagamentos sem fechamento operacional",
      count: isPaymentScoped ? 1 : 0,
      impactCents: paymentScopedCharge?.amountCents ?? 0,
      ctaLabel: "Fechar O.S.",
      ctaPath: "/service-orders",
      helperText: "Pagamento sem conclusão operacional reduz previsibilidade.",
    },
  ], [billingQueue, isPaymentScoped, paymentScopedCharge?.amountCents]);

  const nextAction = useMemo(() => {
    const overdue = billingQueue.find((item) => item.normalized === ChargeStatus.OVERDUE);
    if (overdue) {
      return {
        severity: "critical" as const,
        title: "Você tem dinheiro parado aqui",
        description: "Essa cobrança já venceu e está travando seu caixa. Acione o cliente agora e recupere receita.",
        ctaLabel: "Recuperar no WhatsApp",
        onClick: () => {
          const phone = String(
            overdue.charge.customerPhone ?? overdue.charge.phone ?? ""
          ).trim();
          track("send_whatsapp", {
            screen: "finances",
            chargeId: overdue.charge.id,
            source: "next_action_overdue",
          });
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
      title: "Seu caixa está em ritmo saudável",
      description: "Sem urgência crítica agora. Continue pela fila priorizada para manter previsibilidade de receita.",
      ctaLabel: "Seguir fila",
      onClick: () => navigate("/finances"),
    };
  }, [billingQueue, isPaymentScoped, navigate, paymentById?.id, paymentScopedCharge?.serviceOrderId]);

  const smartOperationalActions = useMemo(
    () =>
      generateFinanceActions({
        billingQueue,
        onSendWhatsApp: (chargeId, phone) => {
          track("send_whatsapp", {
            screen: "finances",
            chargeId,
            source: "smartpage_operational_action",
          });
          if (phone) {
            window.open(`https://wa.me/${phone}`, "_blank");
            return;
          }
          navigate("/whatsapp");
        },
      }),
    [billingQueue, navigate, track]
  );

  function getSeverityClass(severity: "critical" | "attention" | "healthy") {
    if (severity === "critical") return "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20";
    if (severity === "healthy") return "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20";
    return "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20";
  }

  const hasRenderableData =
    chargesQuery.data !== undefined ||
    chargeByIdQuery.data !== undefined ||
    paymentByIdQuery.data !== undefined ||
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
        <PageHeader
          title="Financeiro"
          subtitle="Validando sessão e restaurando o contexto financeiro."
          breadcrumb={[{ label: "Operação" }, { label: "Financeiro" }]}
        />
        <SurfaceSection>
          <TableSkeleton rows={4} columns={3} />
        </SurfaceSection>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHeader
          title="Financeiro"
          subtitle="Sua sessão não está ativa."
          breadcrumb={[{ label: "Operação" }, { label: "Financeiro" }]}
        />
      </PageShell>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Financeiro"
          subtitle="Estamos organizando suas cobranças para mostrar onde está o dinheiro e qual ação gera caixa agora."
          breadcrumb={[{ label: "Operação" }, { label: "Financeiro" }]}
        />
        <SurfaceSection>
          <TableSkeleton rows={6} columns={5} />
        </SurfaceSection>
      </PageShell>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageShell>
        <PageHeader
          title="Financeiro"
          subtitle="Não foi possível carregar os dados financeiros."
          breadcrumb={[{ label: "Operação" }, { label: "Financeiro" }]}
        />
        <SurfaceSection className="space-y-3 border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">
          <p>{errorMessage}</p>
          <Button type="button" variant="outline" onClick={() => void chargesQuery.refetch()}>
            Tentar novamente
          </Button>
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Financeiro"
        subtitle="Veja o que está acontecendo no caixa, por que isso importa para sua venda e qual ação executar agora."
        breadcrumb={[{ label: "Operação" }, { label: "Financeiro" }]}
      />
      <ActionBarWrapper
        secondaryActions={(
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/service-orders")}
          >
            Ir para Ordens de Serviço
          </Button>
        )}
        primaryAction={(
          <Button
            type="button"
            className="bg-orange-500 text-white"
            onClick={() => {
              track("cta_click", { screen: "finances", ctaId: "hero_prioritize_charges" });
              navigate("/finances");
            }}
          >
            Priorizar cobranças
          </Button>
        )}
      />


      <SmartPage
        pageContext="finances"
        headline="Caixa orientado por prioridade"
        dominantProblem={nextAction.title}
        dominantImpact={billingQueue.length > 0 ? `${billingQueue.length} cobranças na fila` : "Sem pressão crítica agora"}
        dominantCta={{
          label: nextAction.ctaLabel,
          onClick: nextAction.onClick,
          path: "/finances",
        }}
        priorities={smartPriorities}
        operationalActions={smartOperationalActions}
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
          <Button
            onClick={() => {
              track("cta_click", {
                screen: "finances",
                ctaId: "next_action_primary",
                label: nextAction.ctaLabel,
              });
              nextAction.onClick();
            }}
          >
            {nextAction.ctaLabel}
          </Button>
        </div>
      </SurfaceSection>

      {totalOpenAmountInQueue > 0 ? (
        <SurfaceSection className="border-2 border-orange-300 bg-gradient-to-r from-orange-50 via-white to-red-50 dark:border-orange-800/60 dark:from-orange-950/30 dark:via-zinc-900 dark:to-red-950/20">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                Você tem em aberto
              </p>
              <p className="mt-1 text-2xl font-extrabold text-zinc-950 dark:text-white">
                {formatCurrencyFromCents(totalOpenAmountInQueue)}
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Cada dia sem ação aumenta risco de perda e tempo de recebimento.
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 dark:border-red-900/40 dark:bg-red-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                Valores atrasados
              </p>
              <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-200">
                {formatCurrencyFromCents(overdueAmountInQueue)}
              </p>
              <p className="text-xs text-red-700/80 dark:text-red-300/90">
                Risco de perda: {formatCurrencyFromCents(overdueAmountInQueue)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Valores pendentes
              </p>
              <p className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-200">
                {formatCurrencyFromCents(pendingAmountInQueue)}
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/90">
                Impacto financeiro imediato no caixa da semana.
              </p>
            </div>
          </div>
        </SurfaceSection>
      ) : null}

      {billingQueue.length > 0 && (
        <SurfaceSection className="space-y-3">
          <div>
            <h2 className="nexo-section-title">O que gera caixa agora</h2>
            <p className="nexo-section-description">
              A fila já vem pronta com o que está vencido primeiro para você recuperar receita sem perder tempo.
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
                      normalized === ChargeStatus.OVERDUE
                        ? "text-red-600 dark:text-red-300"
                        : "text-gray-500"
                    }`}
                  >
                    {formatCurrencyFromCents(charge.amountCents)} •{" "}
                    {normalized === ChargeStatus.OVERDUE
                      ? "Vencida"
                      : normalized === ChargeStatus.PENDING
                        ? "Pendente"
                        : normalized}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      track("send_whatsapp", {
                        screen: "finances",
                        chargeId: charge.id,
                        source: "billing_queue",
                      });
                      setWhatsAppOpeningId(charge.id);
                      const nextPath =
                        buildWhatsAppUrlFromCharge(charge) ??
                        `/whatsapp?returnTo=${encodeURIComponent("/finances")}`;
                      navigate(nextPath);
                      setTimeout(() => setWhatsAppOpeningId(null), 1300);
                    }}
                  >
                    {whatsAppOpeningId === charge.id ? "WhatsApp aberto" : "WhatsApp"}
                  </Button>
                  <ActionFeedbackButton
                    state={
                      isSubmitting && paymentSubmittingId === charge.id
                        ? "loading"
                        : paymentDoneId === charge.id
                          ? "success"
                          : "idle"
                    }
                    idleLabel="Marcar pago"
                    loadingLabel="Processando..."
                    successLabel="Pago registrado"
                    onClick={() => {
                      void (async () => {
                        try {
                          setPaymentSubmittingId(charge.id);
                          await registerPayment(charge, "CASH");
                          setPaymentDoneId(charge.id);
                          setTimeout(() => setPaymentDoneId(null), 1500);
                          void chargesQuery.refetch();
                        } catch {
                          // handled by hook
                        } finally {
                          setPaymentSubmittingId(null);
                        }
                      })();
                    }}
                  />
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
                  : "Seu caixa está pronto para começar"
            }
            description={
              chargeIdFromUrl
                ? "A cobrança solicitada não foi localizada neste workspace."
                : isPaymentScoped
                  ? "O pagamento solicitado não foi localizado neste workspace."
                  : "Comece criando seu primeiro cliente e a primeira O.S.; em seguida, você verá aqui cobranças, recebimentos e evolução do caixa."
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
          {finalVisibleCharges.map((c) => {
            const normalizedStatus = normalizeChargeStatus(c.status);
            return (
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
                  <StatusBadge
                    {...mapFinanceStatus(normalizedStatus)}
                    label={getChargeStatusLabel(normalizedStatus)}
                  />
                  {normalizedStatus !== ChargeStatus.PAID && (
                    <ActionFeedbackButton
                      state={
                        isSubmitting && paymentSubmittingId === c.id
                          ? "loading"
                          : paymentDoneId === c.id
                            ? "success"
                            : "idle"
                      }
                      idleLabel="Marcar pago"
                      loadingLabel="Processando..."
                      successLabel="Pago registrado"
                      variant="outline"
                      onClick={() => {
                        void (async () => {
                          try {
                            setPaymentSubmittingId(c.id);
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
                          } finally {
                            setPaymentSubmittingId(null);
                          }
                        })();
                      }}
                    />
                  )}
                  {normalizedStatus === ChargeStatus.PAID ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(buildWhatsAppUrlFromCharge(c) ?? "/whatsapp")}
                    >
                      Enviar comprovante
                    </Button>
                  ) : null}
                </div>
              </CardContent>
              {paymentDoneId === c.id ? (
                <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  Pagamento registrado com sucesso. Próximo passo: enviar confirmação ao cliente e fechar a O.S.
                </div>
              ) : null}
            </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
