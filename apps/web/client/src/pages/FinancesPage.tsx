import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/query-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FinanceOverviewAreaChart from "@/components/finance/FinanceOverviewAreaChart";
import { Loader2 } from "lucide-react";

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

  const hasCharges = charges.length > 0;
  const hasStats =
    isServiceOrderScoped || !!(stats && (stats.pending || stats.overdue || stats.paid));

  const hasError =
    chargesQuery.isError || (!isServiceOrderScoped && statsQuery.isError);

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(statsQuery.error, "") ||
    "Erro ao carregar";

  const isInitialLoading =
    (chargesQuery.isLoading && !hasCharges) ||
    (!isServiceOrderScoped && statsQuery.isLoading && !hasStats);

  const shouldBlockForError =
    hasError && !hasCharges && (!isServiceOrderScoped ? !hasStats : true);

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="p-6">Faça login</div>;
  }

  if (isInitialLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (shouldBlockForError) {
    return <div className="p-6 text-red-500">{errorMessage}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {stats && !isServiceOrderScoped && (
        <FinanceOverviewAreaChart
          paidAmount={stats.paid?.amountCents || 0}
          pendingAmount={stats.pending?.amountCents || 0}
          overdueAmount={stats.overdue?.amountCents || 0}
        />
      )}

      {charges.length === 0 ? (
        <div>Nenhuma cobrança</div>
      ) : (
        <div className="space-y-3">
          {charges.map((c: any) => (
            <Card key={c.id}>
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
    </div>
  );
}
