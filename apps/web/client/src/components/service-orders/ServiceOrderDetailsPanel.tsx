import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/operations/operations.utils";
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
  Receipt,
  Wrench,
} from "lucide-react";
import type { ServiceOrder } from "./service-order.types";

function getActionToneClass(tone: string) {
  if (tone === "red") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (tone === "blue") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (tone === "green") {
    return "border-green-200 bg-green-50 text-green-700";
  }
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
      box: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Clock3,
    };
  }

  return {
    box: "border-gray-200 bg-gray-50 text-gray-500",
    icon: CircleDollarSign,
  };
}

export default function ServiceOrderDetailsPanel({ os }: { os: ServiceOrder }) {
  const utils = trpc.useUtils();

  const timelineQuery = trpc.nexo.timeline.listByServiceOrder.useQuery(
    { serviceOrderId: os.id, limit: 20 },
    { retry: false }
  );

  const executionQuery = trpc.nexo.executions.listByServiceOrder.useQuery(
    { serviceOrderId: os.id },
    { retry: false }
  );

  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.nexo.serviceOrders.getById.invalidate({ id: os.id }),
        utils.nexo.timeline.listByServiceOrder.invalidate({
          serviceOrderId: os.id,
        }),
        utils.nexo.executions.listByServiceOrder.invalidate({
          serviceOrderId: os.id,
        }),
      ]);
    },
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.nexo.serviceOrders.getById.invalidate({ id: os.id }),
        utils.nexo.timeline.listByServiceOrder.invalidate({
          serviceOrderId: os.id,
        }),
        utils.nexo.executions.listByServiceOrder.invalidate({
          serviceOrderId: os.id,
        }),
      ]);
    },
  });

  const generateCharge = trpc.nexo.serviceOrders.generateCharge.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.nexo.serviceOrders.getById.invalidate({ id: os.id }),
        utils.nexo.timeline.listByServiceOrder.invalidate({
          serviceOrderId: os.id,
        }),
      ]);
    },
  });

  const latestExecution = useMemo(() => {
    const rows = (executionQuery.data as any)?.data || executionQuery.data || [];
    if (!Array.isArray(rows)) return null;

    return [...rows].sort((a: any, b: any) => {
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })[0] ?? null;
  }, [executionQuery.data]);

  const timelineRows = useMemo(() => {
    const rows = (timelineQuery.data as any)?.data || timelineQuery.data || [];
    return Array.isArray(rows) ? rows : [];
  }, [timelineQuery.data]);

  const isStarting = startExecution.isPending;
  const isFinishing = finishExecution.isPending;
  const isGeneratingCharge = generateCharge.isPending;
  const isBusy = isStarting || isFinishing || isGeneratingCharge;

  const canStart = ["OPEN", "ASSIGNED"].includes(String(os.status ?? ""));
  const canFinish = String(os.status ?? "") === "IN_PROGRESS";
  const canGenerateCharge =
    os.status === "DONE" && !os.financialSummary?.hasCharge;

  const operationalStage = getOperationalStage(os);
  const financialStage = getFinancialStage(os);
  const nextAction = getServiceOrderNextAction(os);
  const flowSteps = getServiceOrderFlowSteps(os);

  const OperationalIcon = operationalStage.icon;
  const FinancialIcon = financialStage.icon;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{os.title}</h3>
            <p className="text-sm text-muted-foreground">
              Hub operacional da ordem de serviço
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${operationalStage.className}`}>
              <OperationalIcon className="h-3.5 w-3.5" />
              {operationalStage.label}
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${financialStage.className}`}>
              <FinancialIcon className="h-3.5 w-3.5" />
              {financialStage.label}
            </div>
          </div>
        </div>

        <div className={`mb-4 rounded-xl border p-4 ${getActionToneClass(nextAction.tone)}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">{nextAction.title}</div>
              <div className="text-sm opacity-90">{nextAction.description}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {flowSteps.map((step) => {
            const stepUi = getFlowStepClasses(step.done, step.active);
            const StepIcon = stepUi.icon;

            return (
              <div
                key={step.key}
                className={`rounded-xl border p-3 text-sm ${stepUi.box}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <StepIcon className="h-4 w-4" />
                  <span className="font-medium">{step.label}</span>
                </div>

                <div className="text-xs opacity-90">
                  {step.done ? "Concluído" : step.active ? "Ação atual" : "Aguardando"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-2 flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          <h4 className="font-semibold">Ações do fluxo</h4>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={() => startExecution.mutate({ serviceOrderId: os.id })}
            disabled={!canStart || isBusy}
          >
            {isStarting ? "Iniciando..." : "Iniciar execução"}
          </button>

          <button
            className="rounded bg-green-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={() => finishExecution.mutate({ id: os.id })}
            disabled={!canFinish || isBusy}
          >
            {isFinishing ? "Finalizando..." : "Finalizar execução"}
          </button>

          <button
            className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={() => generateCharge.mutate({ id: os.id })}
            disabled={!canGenerateCharge || isBusy}
          >
            {isGeneratingCharge ? "Gerando..." : "Gerar cobrança"}
          </button>
        </div>

        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <b>Cliente:</b> {os.customer?.name || "—"}
          </div>
          <div>
            <b>Responsável:</b> {os.assignedTo?.name || "—"}
          </div>
          <div>
            <b>Agendado:</b> {formatDateTime(os.scheduledFor)}
          </div>
          <div>
            <b>Início:</b> {formatDateTime(os.startedAt)}
          </div>
          <div>
            <b>Fim:</b> {formatDateTime(os.finishedAt)}
          </div>
          <div>
            <b>Valor previsto:</b> {formatCurrency(os.amountCents)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <h4 className="font-semibold">Financeiro</h4>
        </div>

        {!os.financialSummary?.hasCharge ? (
          <p className="text-sm text-gray-500">Sem cobrança vinculada.</p>
        ) : (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <b>Status:</b> {os.financialSummary.chargeStatus || "—"}
            </div>
            <div>
              <b>Valor:</b> {formatCurrency(os.financialSummary.chargeAmountCents)}
            </div>
            <div>
              <b>Vencimento:</b> {formatDate(os.financialSummary.chargeDueDate)}
            </div>
            <div>
              <b>Pago em:</b> {formatDateTime(os.financialSummary.paidAt)}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <h4 className="mb-2 font-semibold">Última execução</h4>

        {!latestExecution ? (
          <p className="text-sm text-gray-500">Nenhuma execução registrada.</p>
        ) : (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <b>Status:</b> {latestExecution.status || "—"}
            </div>
            <div>
              <b>Modo:</b> {latestExecution.mode || "—"}
            </div>
            <div>
              <b>Início:</b> {formatDateTime(latestExecution.startedAt)}
            </div>
            <div>
              <b>Fim:</b> {formatDateTime(latestExecution.endedAt)}
            </div>
            <div className="md:col-span-2">
              <b>Observações:</b> {latestExecution.notes || "—"}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-4">
        <h4 className="mb-2 font-semibold">Timeline da O.S.</h4>

        {timelineQuery.isLoading ? (
          <p className="text-sm text-gray-500">Carregando timeline...</p>
        ) : timelineRows.length === 0 ? (
          <p className="text-sm text-gray-500">Sem eventos.</p>
        ) : (
          <div className="space-y-3">
            {timelineRows.map((e: any) => (
              <div key={e.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{e.action || e.type || "Evento"}</div>
                  <div className="text-gray-500">{formatDateTime(e.createdAt)}</div>
                </div>

                {e.description && (
                  <div className="mt-1 text-gray-700">{e.description}</div>
                )}

                {e.metadata && (
                  <pre className="mt-2 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
                    {JSON.stringify(e.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
