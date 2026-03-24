import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useChargeActions } from "@/hooks/useChargeActions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { normalizeAlertsPayload } from "@/lib/query-helpers";
import {
  normalizeCharges,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import {
  getOrdersInStatuses,
  getPendingCharges,
  getOverdueCharges,
  getDoneWithoutCharge,
  sumAmountCents,
} from "@/lib/operations/operations.selectors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RefreshCw,
  CheckCircle2,
  CreditCard,
  PlayCircle,
  ArrowRightLeft,
  Wallet,
  Wrench,
  Receipt,
} from "lucide-react";

type ServiceOrderRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  customer?: { name?: string | null } | null;
  assignedTo?: { name?: string | null } | null;
  financialSummary?: { hasCharge?: boolean | null } | null;
};

type ChargeRow = {
  id: string;
  status?: string | null;
  amountCents?: number | null;
  dueDate?: string | null;
  customer?: { name?: string | null } | null;
  serviceOrder?: { title?: string | null } | null;
};

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default function OperationalWorkflowPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: canQuery, retry: false }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: canQuery, retry: false }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
  });

  const { registerPayment, generateCheckout, isSubmitting } =
    useChargeActions({
      location,
      navigate,
      returnPath: "/operations",
      refreshActions: [
        () => chargesQuery.refetch(),
        () => alertsQuery.refetch(),
        () => serviceOrdersQuery.refetch(),
      ],
    });

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: () => {
      serviceOrdersQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // =========================
  // NORMALIZAÇÃO
  // =========================

  const serviceOrders = useMemo(() => {
    return normalizeOrders<ServiceOrderRow>(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const charges = useMemo(() => {
    return normalizeCharges<ChargeRow>(chargesQuery.data);
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload<any>(alertsQuery.data);
  }, [alertsQuery.data]);

  // =========================
  // DERIVAÇÕES
  // =========================

  const actionableOrders = useMemo(() => {
    return getOrdersInStatuses(serviceOrders, [
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
    ]);
  }, [serviceOrders]);

  const doneWithoutCharge = useMemo(() => {
    return getDoneWithoutCharge(serviceOrders);
  }, [serviceOrders]);

  const pendingCharges = useMemo(() => {
    return getPendingCharges(charges);
  }, [charges]);

  const overdueCharges = useMemo(() => {
    return getOverdueCharges(charges);
  }, [charges]);

  const receivableTotal = useMemo(() => {
    return sumAmountCents([...pendingCharges, ...overdueCharges]);
  }, [pendingCharges, overdueCharges]);

  // =========================
  // ACTIONS
  // =========================

  function handleStart(id: string) {
    updateServiceOrder.mutate({ id, data: { status: "IN_PROGRESS" } });
  }

  function handleFinish(id: string) {
    updateServiceOrder.mutate({ id, data: { status: "DONE" } });
  }

  // =========================
  // UI STATES
  // =========================

  if (isInitializing) return <div className="p-6">Carregando...</div>;
  if (!isAuthenticated) return <div className="p-6">Faça login</div>;

  // =========================
  // UI
  // =========================

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wrench className="h-6 w-6 text-orange-500" />
          Workflow Operacional
        </h1>

        <Button
          variant="outline"
          onClick={() => {
            chargesQuery.refetch();
            serviceOrdersQuery.refetch();
            alertsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* EXECUTAR */}
      <Card>
        <CardHeader>
          <CardTitle>Executar agora</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {actionableOrders.map((o) => (
            <div key={o.id} className="border rounded-lg p-3">
              <p className="font-semibold">{o.title}</p>

              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleStart(o.id)}>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>

                <Button size="sm" onClick={() => handleFinish(o.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Concluir
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* COBRAR */}
      <Card>
        <CardHeader>
          <CardTitle>Cobrar agora</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {doneWithoutCharge.map((o) => (
            <div key={o.id} className="border rounded-lg p-3">
              <p className="font-semibold">{o.title}</p>

              <Button
                size="sm"
                onClick={() => navigate(`/finances?serviceOrderId=${o.id}`)}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Cobrar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RECEBER */}
      <Card>
        <CardHeader>
          <CardTitle>Receber agora</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {[...overdueCharges, ...pendingCharges].map((c) => (
            <div key={c.id} className="border rounded-lg p-3">
              <p>{c.customer?.name}</p>
              <p>{formatCurrency(c.amountCents)}</p>

              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={() => generateCheckout(c)}
                  disabled={isSubmitting}
                >
                  Checkout
                </Button>

                <Button
                  size="sm"
                  onClick={() => registerPayment(c, "PIX")}
                  disabled={isSubmitting}
                >
                  Baixar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RESUMO */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo financeiro</CardTitle>
        </CardHeader>

        <CardContent>
          <p className="text-xl font-bold">
            {formatCurrency(receivableTotal)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
