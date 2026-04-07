import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/query-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FinanceOverviewAreaChart from "@/components/finance/FinanceOverviewAreaChart";
import { Loader2 } from "lucide-react";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";

/* ================= HELPERS ================= */

function safeExtractCharges(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function safeExtractStats(payload: any): any {
  if (!payload) return null;
  return payload?.data ?? payload;
}

function formatCurrencyFromCents(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((cents || 0) / 100);
}

/* ================= PAGE ================= */

export default function FinancesPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadFinance = isAuthenticated;

  const [location] = useLocation();

  const searchParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const serviceOrderIdFromUrl = searchParams.get("serviceOrderId") || "";
  const isServiceOrderScoped = Boolean(serviceOrderIdFromUrl);

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 20 },
    { enabled: canLoadFinance, retry: false }
  );

  const statsQuery = trpc.finance.charges.stats.useQuery(
    {},
    {
      enabled: canLoadFinance && !isServiceOrderScoped,
      retry: false,
    }
  );

  const charges = useMemo(
    () => safeExtractCharges(chargesQuery.data),
    [chargesQuery.data]
  );

  const stats = useMemo(
    () => safeExtractStats(statsQuery.data),
    [statsQuery.data]
  );

  const hasNormalizedCharges = chargesQuery.data !== undefined;
  const hasNormalizedStats = isServiceOrderScoped || statsQuery.data !== undefined;
  const hasReusableData = hasNormalizedCharges || hasNormalizedStats;

  const hasError =
    chargesQuery.isError || (!isServiceOrderScoped && statsQuery.isError);

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(statsQuery.error, "") ||
    "Erro ao carregar";

  const hasAnyActiveLoading =
    chargesQuery.isLoading || (!isServiceOrderScoped && statsQuery.isLoading);

  const isInitialLoading = hasAnyActiveLoading && !hasReusableData;

  const shouldBlockForError = hasError && !hasReusableData;

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (shouldBlockForError) {
    return (
      <PageShell>
        <PageHero eyebrow="Financeiro" title="Financeiro" description="Não foi possível carregar os dados financeiros." />
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
      />

      {stats && !isServiceOrderScoped && (
        <FinanceOverviewAreaChart
          paidAmount={stats.paid?.amountCents || 0}
          pendingAmount={stats.pending?.amountCents || 0}
          overdueAmount={stats.overdue?.amountCents || 0}
        />
      )}

      {charges.length === 0 ? (
        <SurfaceSection className="text-sm text-zinc-500 dark:text-zinc-400">Nenhuma cobrança</SurfaceSection>
      ) : (
        <div className="space-y-3">
          {charges.map((c: any) => (
            <Card key={c.id} className="nexo-surface border-slate-200/70 bg-white/90 dark:border-white/8">
              <CardContent className="flex justify-between pt-4">
                <div>
                  <p>{c.customer?.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrencyFromCents(c.amountCents)}
                  </p>
                </div>
                <Badge>{c.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
