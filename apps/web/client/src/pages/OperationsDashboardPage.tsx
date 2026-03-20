import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useChargeActions } from "@/hooks/useChargeActions";
import {
  getErrorMessage,
  normalizeAlertsPayload,
  normalizeArrayPayload,
} from "@/lib/query-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import OperationsCompletionRadial from "@/components/operations/OperationsCompletionRadial";
import OperationsFlowAreaChart from "@/components/operations/OperationsFlowAreaChart";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  PlayCircle,
  RefreshCw,
  TimerReset,
  Wallet,
  Wrench,
  CircleDashed,
  UserCheck,
} from "lucide-react";

const SERVICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  DONE: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
}

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAppointmentStatusTone(status?: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "DONE":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "NO_SHOW":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "CANCELED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getServiceOrderStatusTone(status?: string) {
  switch (status) {
    case "DONE":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "IN_PROGRESS":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "OPEN":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "ASSIGNED":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "CANCELED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getChargeStatusTone(status?: string) {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "OVERDUE":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "PENDING":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function OperationsDashboardPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [location, navigate] = useLocation();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    {
      from: todayStart.toISOString(),
      to: todayEnd.toISOString(),
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      from: todayStart.toISOString(),
      to: todayEnd.toISOString(),
      page: 1,
      limit: 100,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 100,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { registerPayment, generateCheckout, isSubmitting: isFinanceSubmitting } =
    useChargeActions({
      location,
      navigate,
      returnPath: "/dashboard/operations",
      refreshActions: [
        () => chargesQuery.refetch(),
        () => alertsQuery.refetch(),
        () => serviceOrdersQuery.refetch(),
      ],
    });

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        serviceOrdersQuery.refetch(),
        chargesQuery.refetch(),
        alertsQuery.refetch(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar ordem de serviço");
    },
  });

  const appointments = useMemo(() => {
    return normalizeArrayPayload<any>(appointmentsQuery.data);
  }, [appointmentsQuery.data]);

  const serviceOrdersPayload = serviceOrdersQuery.data as any;
  const todayServiceOrders = useMemo(() => {
    const rows = Array.isArray(serviceOrdersPayload?.data)
      ? serviceOrdersPayload.data
      : Array.isArray(serviceOrdersPayload)
        ? serviceOrdersPayload
        : [];
    return rows;
  }, [serviceOrdersPayload]);

  const allCharges = useMemo(() => {
    return normalizeArrayPayload<any>(chargesQuery.data);
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload<any>(alertsQuery.data);
  }, [alertsQuery.data]);

  const overdueCharges = Array.isArray(alerts?.overdueCharges?.items)
    ? alerts.overdueCharges.items
    : [];

  const lateServices = Array.isArray(alerts?.overdueOrders?.items)
    ? alerts.overdueOrders.items
    : [];

  const doneOrdersWithoutCharge = Array.isArray(alerts?.doneOrdersWithoutCharge?.items)
    ? alerts.doneOrdersWithoutCharge.items
    : [];

  const todayOpenOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) => order?.status === "OPEN");
  }, [todayServiceOrders]);

  const todayAssignedOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) => order?.status === "ASSIGNED");
  }, [todayServiceOrders]);

  const todayInProgressOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) => order?.status === "IN_PROGRESS");
  }, [todayServiceOrders]);

  const todayDoneOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) => order?.status === "DONE");
  }, [todayServiceOrders]);

  const scheduledAppointments = useMemo(() => {
    return appointments.filter((item: any) => item?.status === "SCHEDULED");
  }, [appointments]);

  const confirmedAppointments = useMemo(() => {
    return appointments.filter((item: any) => item?.status === "CONFIRMED");
  }, [appointments]);

  const noShowAppointments = useMemo(() => {
    return appointments.filter((item: any) => item?.status === "NO_SHOW");
  }, [appointments]);

  const pendingCharges = useMemo(() => {
    return allCharges.filter((charge: any) => charge?.status === "PENDING");
  }, [allCharges]);

  const pendingTotalCents = useMemo(() => {
    return pendingCharges.reduce((acc: number, charge: any) => {
      return acc + Number(charge?.amountCents || 0);
    }, 0);
  }, [pendingCharges]);

  const overdueTotalCents = useMemo(() => {
    return overdueCharges.reduce((acc: number, charge: any) => {
      return acc + Number(charge?.amountCents || 0);
    }, 0);
  }, [overdueCharges]);

  const handleStartExecution = (id: string) => {
    updateServiceOrder.mutate(
      { id, data: { status: "IN_PROGRESS" } },
      {
        onSuccess: () => {
          toast.success("Execução iniciada.");
        },
      }
    );
  };

  const handleFinishExecution = (id: string) => {
    updateServiceOrder.mutate(
      { id, data: { status: "DONE" } },
      {
        onSuccess: () => {
          toast.success("Execução concluída.");
        },
      }
    );
  };

  const isLoading =
    appointmentsQuery.isLoading ||
    serviceOrdersQuery.isLoading ||
    chargesQuery.isLoading ||
    alertsQuery.isLoading;

  const hasError =
    appointmentsQuery.isError ||
    serviceOrdersQuery.isError ||
    chargesQuery.isError ||
    alertsQuery.isError;

  const errorMessage =
    getErrorMessage(appointmentsQuery.error, "") ||
    getErrorMessage(serviceOrdersQuery.error, "") ||
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Não foi possível carregar o dashboard operacional agora.";

  if (isInitializing) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Faça login para visualizar o dashboard operacional.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Carregando dashboard operacional...
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-orange-500" />
            Dashboard Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Agenda, execução, financeiro e gargalos do dia em uma leitura só.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            void appointmentsQuery.refetch();
            void serviceOrdersQuery.refetch();
            void chargesQuery.refetch();
            void alertsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Agendamentos de hoje"
          value={appointments.length}
          subtitle={`${confirmedAppointments.length} confirmados`}
        />
        <MetricCard
          title="O.S. do dia"
          value={todayServiceOrders.length}
          subtitle={`${todayInProgressOrders.length} em execução agora`}
        />
        <MetricCard
          title="Pendências financeiras"
          value={formatCurrency(pendingTotalCents)}
          subtitle={`${pendingCharges.length} cobranças pendentes`}
        />
        <MetricCard
          title="Atrasos críticos"
          value={overdueCharges.length + lateServices.length + doneOrdersWithoutCharge.length}
          subtitle="Financeiro e operação pedindo ação"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <OperationsCompletionRadial
          totalOrders={todayServiceOrders.length}
          completedOrders={todayDoneOrders.length}
          title="Conclusão operacional do dia"
          description="Percentual das ordens do dia que já chegaram ao fechamento"
        />

        <OperationsFlowAreaChart
          openOrders={todayOpenOrders.length}
          assignedOrders={todayAssignedOrders.length}
          inProgressOrders={todayInProgressOrders.length}
          completedOrders={todayDoneOrders.length}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agenda aguardando confirmação</CardTitle>
            <CardDescription>Agendados ainda não confirmados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {scheduledAppointments.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">O.S. atribuídas</CardTitle>
            <CardDescription>Prontas para começar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {todayAssignedOrders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">O.S. em execução</CardTitle>
            <CardDescription>Serviços rodando agora</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {todayInProgressOrders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Concluídas sem cobrança</CardTitle>
            <CardDescription>Buraco entre operação e financeiro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {doneOrdersWithoutCharge.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Agenda do dia
            </CardTitle>
            <CardDescription>
              O que está marcado para hoje e em que estado está.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {appointments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem agendamentos para hoje.
              </p>
            )}

            {appointments.map((appointment: any) => (
              <div key={appointment.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {appointment.customer?.name || "Cliente não identificado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(appointment.startsAt)}
                      {appointment.endsAt ? ` → ${formatTime(appointment.endsAt)}` : ""}
                    </p>
                  </div>

                  <Badge className={getAppointmentStatusTone(appointment.status)}>
                    {APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status}
                  </Badge>
                </div>

                {appointment.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {appointment.notes}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4" />
              Execução do dia
            </CardTitle>
            <CardDescription>
              O.S. do dia vindas direto do backend.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {todayServiceOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem ordens de serviço vinculadas ao dia.
              </p>
            )}

            {todayServiceOrders.map((order: any) => (
              <div key={order.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{order.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer?.name || "Sem cliente"} •{" "}
                      {formatTime(order?.scheduledFor || order?.appointment?.startsAt)}
                    </p>
                  </div>

                  <Badge className={getServiceOrderStatusTone(order.status)}>
                    {SERVICE_STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartExecution(String(order.id))}
                    disabled={
                      order.status === "IN_PROGRESS" ||
                      order.status === "DONE" ||
                      order.status === "CANCELED" ||
                      updateServiceOrder.isPending
                    }
                  >
                    <PlayCircle className="mr-1 h-4 w-4" />
                    Iniciar execução
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleFinishExecution(String(order.id))}
                    disabled={
                      order.status !== "IN_PROGRESS" ||
                      updateServiceOrder.isPending
                    }
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Concluir execução
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Financeiro em aberto
            </CardTitle>
            <CardDescription>
              Cobranças ativas aguardando avanço ou pagamento.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingCharges.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem cobranças pendentes.
              </p>
            )}

            {pendingCharges.slice(0, 8).map((charge: any) => (
              <div key={charge.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {charge.customer?.name || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(charge.amountCents)} • Venc.{" "}
                      {formatDate(charge.dueDate)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {charge.serviceOrder?.title
                        ? `O.S.: ${charge.serviceOrder.title}`
                        : "Cobrança manual ou sem O.S. vinculada"}
                    </p>
                  </div>

                  <Badge className={getChargeStatusTone(charge.status)}>
                    {charge.status === "PENDING" ? "Pendente" : charge.status}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void generateCheckout(charge)}
                    disabled={isFinanceSubmitting}
                  >
                    <CreditCard className="mr-1 h-4 w-4" />
                    Checkout
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => void registerPayment(charge, "PIX")}
                    disabled={isFinanceSubmitting}
                  >
                    Registrar pagamento
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas críticos
            </CardTitle>
            <CardDescription>
              Onde o fluxo está quebrando sem pedir licença.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">
                    Cobranças vencidas
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-400">
                    {overdueCharges.length} itens • {formatCurrency(overdueTotalCents)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/finances")}>
                  Ver financeiro
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
                    Serviços atrasados
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-400">
                    {lateServices.length} itens pedindo execução
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/service-orders")}>
                  Ver O.S.
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-300">
                    O.S. concluídas sem cobrança
                  </p>
                  <p className="text-xs text-orange-800 dark:text-orange-400">
                    {doneOrdersWithoutCharge.length} itens com risco de buraco no fluxo
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/service-orders")}>
                  Revisar
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/40 dark:bg-yellow-950/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                    No-show no dia
                  </p>
                  <p className="text-xs text-yellow-800 dark:text-yellow-400">
                    {noShowAppointments.length} agendamentos perdidos por ausência
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("/appointments")}>
                  Ver agenda
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TimerReset className="h-4 w-4" />
            Leitura rápida do ciclo
          </CardTitle>
          <CardDescription>
            O que andou bem e onde ainda existe atrito operacional.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CircleDashed className="h-3.5 w-3.5" />
              A confirmar
            </p>
            <p className="mt-1 text-lg font-semibold">{scheduledAppointments.length}</p>
            <p className="text-xs text-muted-foreground">
              Compromissos ainda não confirmados.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5" />
              Confirmado
            </p>
            <p className="mt-1 text-lg font-semibold">{confirmedAppointments.length}</p>
            <p className="text-xs text-muted-foreground">
              Agenda pronta para virar operação.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Executado
            </p>
            <p className="mt-1 text-lg font-semibold">{todayDoneOrders.length}</p>
            <p className="text-xs text-muted-foreground">
              Ordens concluídas no dia.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Travado entre operação e financeiro
            </p>
            <p className="mt-1 text-lg font-semibold">{doneOrdersWithoutCharge.length}</p>
            <p className="text-xs text-muted-foreground">
              Concluídas que ainda precisam caminhar para cobrança.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
