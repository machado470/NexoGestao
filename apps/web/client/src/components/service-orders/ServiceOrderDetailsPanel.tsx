import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChargeActions } from "@/hooks/useChargeActions";
import {
  buildWhatsAppUrlFromServiceOrder,
  formatCurrency,
  formatDate,
  formatDateTime,
  normalizeOrders,
  normalizeStatus,
} from "@/lib/operations/operations.utils";
import {
  getFinancialStage,
  getOperationalStage,
  getServiceOrderFlowSteps,
  getServiceOrderNextAction,
} from "@/lib/operations/operations.selectors";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  Play,
  Receipt,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ExecutionRecord,
  ServiceOrder,
  TimelineEvent,
} from "./service-order.types";

function getActionToneClass(tone: string) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "blue") return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200";
  if (tone === "green") return "border-green-200 bg-green-50 text-green-700";
  return "border-gray-200 bg-gray-50 text-gray-700";
}

function getFlowStepClasses(done: boolean, active: boolean) {
  if (done) {
    return {
      box: "border-green-200 bg-green-50 text-green-700",
      icon: CheckCircle2,
    };
  }

  if (active) {
    return {
      box: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
      icon: Clock3,
    };
  }

  return {
    box: "border-gray-200 bg-gray-50 text-gray-500",
    icon: CircleDollarSign,
  };
}

function getTimelineLabel(event: TimelineEvent) {
  const action = String(event.action ?? event.type ?? "").trim().toUpperCase();

  if (action === "CHARGE_CREATED") return "Cobrança gerada";
  if (action === "CHARGE_PAID" || action === "PAYMENT_RECEIVED") {
    return "Pagamento recebido";
  }
  if (action === "CHARGE_OVERDUE") return "Cobrança vencida";
  if (action === "SERVICE_ORDER_CREATED") return "O.S. criada";
  if (action === "SERVICE_ORDER_UPDATED") return "O.S. atualizada";
  if (action === "EXECUTION_STARTED") return "Execução iniciada";
  if (action === "EXECUTION_COMPLETED" || action === "EXECUTION_DONE") {
    return "Execução concluída";
  }

  return event.description || event.action || event.type || "Evento";
}

function getExecutionStatusLabel(value?: string | null) {
  const status = normalizeStatus(value);

  if (status === "DONE" || status === "COMPLETED") return "Concluída";
  if (status === "IN_PROGRESS") return "Em andamento";
  if (status === "OPEN") return "Aberta";

  return status || "—";
}

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function withReturnTo(url: string, returnTo: string) {
  const [pathname, rawQuery = ""] = url.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("returnTo", returnTo);
  return `${pathname}?${params.toString()}`;
}

export default function ServiceOrderDetailsPanel({ os }: { os: ServiceOrder }) {
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);
  const whatsappUrlWithReturn = whatsappUrl
    ? withReturnTo(whatsappUrl, `/service-orders?os=${os.id}`)
    : null;

  const timelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: os.id, limit: 20 },
    { retry: false }
  );

  const executionQuery = trpc.nexo.executions.listByServiceOrder.useQuery(
    { serviceOrderId: os.id, limit: 20 },
    { retry: false }
  );

  const invalidateOperationalData = async () => {
    await Promise.all([
      utils.nexo.serviceOrders.list.invalidate(),
      utils.nexo.serviceOrders.getById.invalidate({ id: os.id }),
      utils.finance.charges.list.invalidate(),
      utils.finance.charges.stats.invalidate(),
      utils.dashboard.alerts.invalidate(),
      utils.nexo.timeline.listByOrg.invalidate(),
      utils.nexo.timeline.listByServiceOrder.invalidate(),
    ]);
  };

  const { registerPayment, generateCheckout, isSubmitting } = useChargeActions({
    location,
    navigate,
    returnPath: `/service-orders?os=${os.id}`,
    refreshActions: [invalidateOperationalData],
  });

  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: async () => {
      toast.success("Execução iniciada");
      await invalidateOperationalData();
      await executionQuery.refetch();
      await timelineQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar execução");
    },
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: async () => {
      toast.success("Execução finalizada");
      await invalidateOperationalData();
      await executionQuery.refetch();
      await timelineQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao finalizar execução");
    },
  });

  const generateCharge = trpc.nexo.serviceOrders.generateCharge.useMutation({
    onSuccess: async () => {
      toast.success("Cobrança gerada");
      await invalidateOperationalData();
      await timelineQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar cobrança");
    },
  });

  const timeline = useMemo(
    () => normalizeOrders<TimelineEvent>(timelineQuery.data),
    [timelineQuery.data]
  );

  const executions = useMemo(
    () => normalizeOrders<ExecutionRecord>(executionQuery.data),
    [executionQuery.data]
  );

  const latestExecution = executions[0] ?? null;

  const canStart = ["OPEN", "ASSIGNED"].includes(normalizeStatus(os.status));
  const canFinish =
    normalizeStatus(os.status) === "IN_PROGRESS" &&
    Boolean(latestExecution?.id) &&
    normalizeStatus(latestExecution?.status) === "IN_PROGRESS";
  const canGenerateCharge =
    normalizeStatus(os.status) === "DONE" && !os.financialSummary?.hasCharge;

  const operationalStage = getOperationalStage(os);
  const financialStage = getFinancialStage(os);
  const nextAction = getServiceOrderNextAction(os);
  const flowSteps = getServiceOrderFlowSteps(os);
  const chargeIsPaid =
    normalizeStatus(os.financialSummary?.chargeStatus) === "PAID";

  const charge =
    os.financialSummary?.hasCharge && isValidId(os.financialSummary.chargeId)
      ? {
          id: os.financialSummary.chargeId,
          customerId: os.customerId,
          amountCents: os.financialSummary.chargeAmountCents ?? 0,
          serviceOrderId: os.id,
          serviceOrder: { title: os.title },
        }
      : null;

  const OperationalIcon = operationalStage.icon;
  const FinancialIcon = financialStage.icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl">{os.title}</CardTitle>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-xs ${operationalStage.className}`}
                >
                  <OperationalIcon className="h-4 w-4" />
                  {operationalStage.label}
                </span>

                <span
                  className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-xs ${financialStage.className}`}
                >
                  <FinancialIcon className="h-4 w-4" />
                  {financialStage.label}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => startExecution.mutate({ serviceOrderId: os.id })}
                disabled={startExecution.isPending || !canStart}
              >
                <Play className="mr-2 h-4 w-4" />
                Iniciar
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  latestExecution?.id &&
                  finishExecution.mutate({ executionId: latestExecution.id })
                }
                disabled={finishExecution.isPending || !canFinish}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalizar
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => generateCharge.mutate({ id: os.id })}
                disabled={generateCharge.isPending || !canGenerateCharge}
              >
                <Receipt className="mr-2 h-4 w-4" />
                Gerar cobrança
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (whatsappUrlWithReturn) navigate(whatsappUrlWithReturn);
                }}
                disabled={!whatsappUrlWithReturn}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${getActionToneClass(nextAction.tone)}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{nextAction.title}</div>
                <div className="text-sm opacity-90">{nextAction.description}</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Cliente
              </div>
              <div className="mt-1 font-medium">
                {os.customer?.name || os.customerId || "—"}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Responsável
              </div>
              <div className="mt-1 font-medium">
                {os.assignedTo?.name || "Não atribuído"}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Agendamento
              </div>
              <div className="mt-1 font-medium">
                {formatDateTime(os.scheduledFor || os.appointment?.startsAt)}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Valor da O.S.
              </div>
              <div className="mt-1 font-medium">
                {formatCurrency(os.amountCents)}
              </div>
            </div>
          </div>

          {os.description ? (
            <div className="rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Descrição
              </div>
              <div className="mt-2 text-sm">{os.description}</div>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <h4 className="font-semibold">Fluxo operacional</h4>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {flowSteps.map((step) => {
                const visual = getFlowStepClasses(step.done, step.active);
                const StepIcon = visual.icon;

                return (
                  <div
                    key={step.key}
                    className={`rounded-xl border p-3 ${visual.box}`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <StepIcon className="h-4 w-4" />
                      {step.label}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {step.done
                        ? "Etapa concluída"
                        : step.active
                        ? "Etapa atual"
                        : "Aguardando etapa anterior"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financeiro</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {!os.financialSummary?.hasCharge ? (
              <div className="space-y-3 rounded-xl border border-dashed p-4">
                <div className="text-sm text-muted-foreground">
                  Ainda não existe cobrança vinculada a esta O.S.
                </div>

                <Button
                  onClick={() => generateCharge.mutate({ id: os.id })}
                  disabled={generateCharge.isPending || !canGenerateCharge}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Gerar cobrança
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status
                    </div>
                    <div className="mt-1 font-medium">
                      {os.financialSummary.chargeStatus || "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Valor
                    </div>
                    <div className="mt-1 font-medium">
                      {formatCurrency(os.financialSummary.chargeAmountCents)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Vencimento
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDate(os.financialSummary.chargeDueDate)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Pago em
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDateTime(os.financialSummary.paidAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!chargeIsPaid && charge ? (
                    <>
                      <Button
                        onClick={() => void generateCheckout(charge)}
                        disabled={isSubmitting}
                      >
                        Checkout
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await registerPayment(charge, "CASH");
                            await timelineQuery.refetch();
                          } catch {
                            // toast already handled by shared hook
                          }
                        }}
                        disabled={isSubmitting}
                      >
                        Marcar pago
                      </Button>
                    </>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={() => {
                      if (whatsappUrlWithReturn) navigate(whatsappUrlWithReturn);
                    }}
                    disabled={!whatsappUrlWithReturn}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {chargeIsPaid ? "Falar com cliente" : "Cobrar no WhatsApp"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execução</CardTitle>
          </CardHeader>

          <CardContent>
            {executionQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">
                Carregando execução...
              </div>
            ) : latestExecution ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status
                    </div>
                    <div className="mt-1 font-medium">
                      {getExecutionStatusLabel(latestExecution.status)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Modo
                    </div>
                    <div className="mt-1 font-medium">
                      {latestExecution.mode || "—"}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Início
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDateTime(latestExecution.startedAt)}
                    </div>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Fim
                    </div>
                    <div className="mt-1 font-medium">
                      {formatDateTime(latestExecution.endedAt)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Observações
                  </div>
                  <div className="mt-2 text-sm">
                    {latestExecution.notes || "Sem observações registradas."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Nenhuma execução registrada para esta O.S.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>

        <CardContent>
          {timelineQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Carregando timeline...
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhum evento encontrado para esta O.S.
            </div>
          ) : (
            <div className="space-y-3">
              {timeline.map((event) => (
                <div key={event.id} className="rounded-xl border p-3">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div className="font-medium">{getTimelineLabel(event)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>

                  {event.description ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {event.description}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
