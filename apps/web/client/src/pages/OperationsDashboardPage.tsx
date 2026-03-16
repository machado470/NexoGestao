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
  TimerReset,
  Wrench,
} from "lucide-react";

const SERVICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Não iniciada",
  ASSIGNED: "Atribuída",
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

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page: 1,
      limit: 50,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 50,
      status: "PENDING",
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    refetchOnWindowFocus: false,
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

  const registerPayment = trpc.finance.charges.pay.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento registrado.");
      await Promise.all([
        chargesQuery.refetch(),
        alertsQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar pagamento");
    },
  });

  const checkoutCharge = trpc.payments.checkout.useMutation({
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar checkout");
    },
  });

  const appointments = useMemo(() => {
    return normalizeArrayPayload(appointmentsQuery.data);
  }, [appointmentsQuery.data]);

  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const pendingCharges = useMemo(() => {
    const payload = chargesQuery.data as any;
    return Array.isArray(payload?.data?.items)
      ? payload.data.items
      : normalizeArrayPayload(chargesQuery.data);
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

  const todayOpenOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) =>
      ["OPEN", "ASSIGNED"].includes(order?.status)
    );
  }, [todayServiceOrders]);

  const todayInProgressOrders = useMemo(() => {
    return todayServiceOrders.filter(
      (order: any) => order?.status === "IN_PROGRESS"
    );
  }, [todayServiceOrders]);

  const todayDoneOrders = useMemo(() => {
    return todayServiceOrders.filter((order: any) => order?.status === "DONE");
  }, [todayServiceOrders]);

  const doneOrdersWithoutCharge = useMemo(() => {
    const pendingOrKnownChargeServiceOrderIds = new Set(
      pendingCharges
        .map((charge: any) => charge?.serviceOrderId)
        .filter((value: any) => typeof value === "string" && value.length > 0)
    );

    return serviceOrders.filter((order: any) => {
      if (order?.status !== "DONE") return false;
      return !pendingOrKnownChargeServiceOrderIds.has(String(order.id));
    });
  }, [pendingCharges, serviceOrders]);

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

  const handleRegisterPayment = (charge: any) => {
    const amountCents = Number(charge?.amountCents ?? 0);

    if (!amountCents || amountCents <= 0) {
      toast.error("Valor da cobrança inválido para registrar pagamento");
      return;
    }

    registerPayment.mutate({
      chargeId: String(charge.id),
      method: "CASH",
      amountCents,
    });
  };

  const handleGenerateCheckout = async (charge: any) => {
    const amountCents = Number(charge?.amountCents ?? 0);

    if (!amountCents || amountCents <= 0) {
      toast.error("Valor da cobrança inválido para checkout");
      return;
    }

    if (!charge?.customerId) {
      toast.error("Cobrança sem cliente vinculado");
      return;
    }

    const description =
      charge?.notes?.trim() ||
      charge?.serviceOrder?.title ||
      `Cobrança #${String(charge.id).slice(0, 8)}`;

    const origin = window.location.origin;

    const result = await checkoutCharge.mutateAsync({
      chargeId: String(charge.id),
      customerId: String(charge.customerId),
      amount: amountCents,
      description,
      successUrl: `${origin}/dashboard/operations?checkout=success&chargeId=${String(charge.id)}`,
      cancelUrl: `${origin}/dashboard/operations?checkout=cancel&chargeId=${String(charge.id)}`,
    });

    const checkoutUrl = result?.checkoutUrl;

    if (!checkoutUrl) {
      toast.error("Checkout retornado sem URL");
      return;
    }

    window.location.href = checkoutUrl;
  };

  const isFinanceSubmitting =
    registerPayment.isPending || checkoutCharge.isPending;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-orange-500" />
            Dashboard Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão diária de agendamentos, execução, cobrança e leitura rápida
            do fluxo.
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Agendamentos de hoje</CardDescription>
            <CardTitle>{appointments.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>OS de hoje</CardDescription>
            <CardTitle>{todayServiceOrders.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em execução agora</CardDescription>
            <CardTitle>{todayInProgressOrders.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cobranças pendentes</CardDescription>
            <CardTitle>{formatCurrency(pendingTotalCents)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">OS aguardando ação</CardTitle>
            <CardDescription>
              Abertas ou atribuídas para hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {todayOpenOrders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">OS em execução</CardTitle>
            <CardDescription>Serviços rodando agora</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {todayInProgressOrders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Concluídas sem cobrança</CardTitle>
            <CardDescription>Possível gargalo do fluxo</CardDescription>
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
                    {formatTime(appointment.startsAt)}
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
              Ordens de serviço de hoje
            </CardTitle>
            <CardDescription>
              Abertas, em execução e concluídas no dia.
            </CardDescription>
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
                      {order.customer?.name || "Sem cliente"} •{" "}
                      {formatTime(
                        order?.scheduledFor || order?.appointment?.startsAt
                      )}
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
              <CreditCard className="h-4 w-4" />
              Cobranças pendentes e pagamentos
            </CardTitle>
            <CardDescription>
              Com vínculo visível entre cliente, O.S. e vencimento.
            </CardDescription>
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
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {charge.customer?.name || "Cliente"}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(charge.amountCents)} • Venc.{" "}
                    {charge.dueDate ? formatDate(charge.dueDate) : "-"}
                  </p>

                  <p className="truncate text-xs text-muted-foreground">
                    {charge.serviceOrder?.title
                      ? `O.S.: ${charge.serviceOrder.title}`
                      : "Cobrança manual ou sem O.S. vinculada"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleGenerateCheckout(charge)}
                    disabled={isFinanceSubmitting}
                  >
                    <CreditCard className="mr-1 h-4 w-4" />
                    Checkout
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleRegisterPayment(charge)}
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
              Alertas operacionais
            </CardTitle>
            <CardDescription>
              Onde o fluxo está pedindo socorro sem sutileza.
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
                    <p className="font-medium">
                      {charge.customer?.name || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(charge.amountCents)}
                    </p>
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
                    <p className="font-medium">{service.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.customer?.name
                        ? service.customer.name
                        : "Sem cliente"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                O.S. concluídas sem cobrança ({doneOrdersWithoutCharge.length})
              </p>
              <div className="space-y-2">
                {doneOrdersWithoutCharge.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma O.S. concluída sem cobrança aparente.
                  </p>
                )}

                {doneOrdersWithoutCharge.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="rounded border p-2 text-sm">
                    <p className="font-medium">{order.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer?.name || "Sem cliente"} • Finalizada{" "}
                      {order.finishedAt ? formatDate(order.finishedAt) : "recentemente"}
                    </p>
                  </div>
                ))}
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
            O que já andou e onde ainda existe atrito.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Agendado
            </p>
            <p className="mt-1 text-lg font-semibold">{appointments.length}</p>
            <p className="text-xs text-muted-foreground">
              Compromissos previstos para hoje.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Executado
            </p>
            <p className="mt-1 text-lg font-semibold">{todayDoneOrders.length}</p>
            <p className="text-xs text-muted-foreground">
              Ordens concluídas no dia.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              A cobrar
            </p>
            <p className="mt-1 text-lg font-semibold">
              {doneOrdersWithoutCharge.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Concluídas que merecem revisão financeira.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
