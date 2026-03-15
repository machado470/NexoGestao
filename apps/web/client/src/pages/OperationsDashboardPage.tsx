import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  PlayCircle,
  RefreshCw,
  Wrench,
} from "lucide-react";

const SERVICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Não iniciada",
  ASSIGNED: "Não iniciada",
  IN_PROGRESS: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
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

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
}

function statusTone(status?: string) {
  if (!status) return "bg-gray-100 text-gray-700";
  if (["DONE", "PAID", "CONFIRMED"].includes(status)) {
    return "bg-green-100 text-green-700";
  }
  if (["IN_PROGRESS", "OVERDUE"].includes(status)) {
    return "bg-amber-100 text-amber-700";
  }
  if (["OPEN", "ASSIGNED", "SCHEDULED", "PENDING"].includes(status)) {
    return "bg-blue-100 text-blue-700";
  }
  if (["CANCELED", "NO_SHOW"].includes(status)) {
    return "bg-red-100 text-red-700";
  }
  return "bg-gray-100 text-gray-700";
}

function normalizeArrayPayload(payload: any): any[] {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeAlertsPayload(payload: any) {
  return payload?.data ?? payload ?? {};
}

export default function OperationsDashboardPage() {
  const utils = trpc.useUtils();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery({
    from: todayStart.toISOString(),
    to: todayEnd.toISOString(),
  });

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const chargesQuery = trpc.finance.charges.list.useQuery({
    page: 1,
    limit: 50,
    status: "PENDING",
  });

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: async () => {
      await serviceOrdersQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar ordem de serviço");
    },
  });

  const registerPayment = trpc.finance.charges.pay.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento registrado.");
      await Promise.all([
        chargesQuery.refetch(),
        alertsQuery.refetch(),
        utils.finance.charges.list.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar pagamento");
    },
  });

  const appointments = useMemo(() => {
    return normalizeArrayPayload(appointmentsQuery.data);
  }, [appointmentsQuery.data]);

  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const pendingCharges = useMemo(() => {
    return normalizeArrayPayload(chargesQuery.data);
  }, [chargesQuery.data]);

  const todayServiceOrders = useMemo(() => {
    return serviceOrders.filter((order: any) => {
      const dateCandidate =
        order?.scheduledFor ||
        order?.dueDate ||
        order?.appointment?.startsAt ||
        order?.createdAt;

      if (!dateCandidate) return false;

      const dt = new Date(dateCandidate);
      return dt >= todayStart && dt <= todayEnd;
    });
  }, [serviceOrders, todayEnd, todayStart]);

  const pendingTotalCents = useMemo(() => {
    return pendingCharges.reduce((acc: number, charge: any) => {
      return acc + Number(charge?.amountCents || 0);
    }, 0);
  }, [pendingCharges]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload(alertsQuery.data);
  }, [alertsQuery.data]);

  const overdueCharges = Array.isArray(alerts?.overdueCharges?.items)
    ? alerts.overdueCharges.items
    : [];

  const lateServices = Array.isArray(alerts?.overdueOrders?.items)
    ? alerts.overdueOrders.items
    : [];

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-orange-500" />
            Dashboard Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão diária de agendamentos, execução de serviços e cobranças.
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Agendamentos de hoje</CardDescription>
            <CardTitle>{appointments.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ordens de serviço de hoje</CardDescription>
            <CardTitle>{todayServiceOrders.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cobranças pendentes</CardDescription>
            <CardTitle>{formatCurrency(pendingTotalCents)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Agendamentos de hoje
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {appointments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem agendamentos para hoje.
              </p>
            )}

            {appointments.map((appointment: any) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {appointment.title || "Agendamento"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.startsAt
                      ? new Date(appointment.startsAt).toLocaleTimeString(
                          "pt-BR",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "--:--"}
                    {appointment.customer?.name
                      ? ` • ${appointment.customer.name}`
                      : ""}
                  </p>
                </div>
                <Badge className={statusTone(appointment.status)}>
                  {appointment.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4" />
              Ordens de serviço (hoje)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {todayServiceOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem ordens para hoje.
              </p>
            )}

            {todayServiceOrders.map((order: any) => (
              <div key={order.id} className="space-y-2 rounded border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{order.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer?.name || "Sem cliente"}
                    </p>
                  </div>
                  <Badge className={statusTone(order.status)}>
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
              <CreditCard className="h-4 w-4" />
              Cobranças pendentes e pagamentos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingCharges.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem cobranças pendentes.
              </p>
            )}

            {pendingCharges.map((charge: any) => (
              <div
                key={charge.id}
                className="flex items-center justify-between gap-3 rounded border p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {charge.customer?.name || "Cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(charge.amountCents)} • Venc.{" "}
                    {charge.dueDate
                      ? new Date(charge.dueDate).toLocaleDateString("pt-BR")
                      : "-"}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() =>
                    registerPayment.mutate({
                      chargeId: String(charge.id),
                      method: "CASH",
                      amountCents: Number(charge.amountCents),
                    })
                  }
                  disabled={registerPayment.isPending}
                >
                  Registrar pagamento
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas operacionais
            </CardTitle>
            <CardDescription>
              Cobranças vencidas e serviços atrasados.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">
                Cobranças vencidas ({overdueCharges.length})
              </p>
              <div className="space-y-2">
                {overdueCharges.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma cobrança vencida.
                  </p>
                )}

                {overdueCharges.slice(0, 5).map((charge: any) => (
                  <div key={charge.id} className="rounded border p-2 text-sm">
                    {charge.customer?.name} • {formatCurrency(charge.amountCents)}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                Serviços atrasados ({lateServices.length})
              </p>
              <div className="space-y-2">
                {lateServices.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhum serviço atrasado.
                  </p>
                )}

                {lateServices.slice(0, 5).map((service: any) => (
                  <div key={service.id} className="rounded border p-2 text-sm">
                    {service.title}
                    {service.customer?.name ? ` • ${service.customer.name}` : ""}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
