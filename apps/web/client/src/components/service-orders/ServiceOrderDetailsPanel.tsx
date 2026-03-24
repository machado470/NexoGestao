import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Wrench,
  History,
  Receipt,
} from "lucide-react";
import type { ServiceOrder } from "./service-order.types";
import { formatCurrency, formatDate, formatDateTime } from "./service-order.utils";

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
  const canGenerateCharge = !os.financialSummary?.hasCharge;

  return (
    <div className="space-y-4">
      <div className="border p-4 rounded">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4" />
          <h4 className="font-semibold">Resumo da O.S.</h4>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
            onClick={() => startExecution.mutate({ serviceOrderId: os.id })}
            disabled={!canStart || isBusy}
          >
            {isStarting ? "Iniciando..." : "Iniciar"}
          </button>

          <button
            className="px-3 py-1 text-xs rounded bg-green-600 text-white disabled:opacity-50"
            onClick={() => finishExecution.mutate({ id: os.id })}
            disabled={!canFinish || isBusy}
          >
            {isFinishing ? "Finalizando..." : "Finalizar"}
          </button>

          {canGenerateCharge && (
            <button
              className="px-3 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-50"
              onClick={() => generateCharge.mutate({ id: os.id })}
              disabled={isBusy}
            >
              {isGeneratingCharge ? "Gerando..." : "Gerar cobrança"}
            </button>
          )}
        </div>

        <div className="grid gap-2 text-sm">
          <div><b>Cliente:</b> {os.customer?.name || "—"}</div>
          <div><b>Status:</b> {os.status || "—"}</div>
          <div><b>Responsável:</b> {os.assignedTo?.name || "—"}</div>
          <div><b>Agendado:</b> {formatDateTime(os.scheduledFor)}</div>
          <div><b>Início:</b> {formatDateTime(os.startedAt)}</div>
          <div><b>Fim:</b> {formatDateTime(os.finishedAt)}</div>
        </div>
      </div>

      <div className="border p-4 rounded">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="h-4 w-4" />
          <h4 className="font-semibold">Financeiro</h4>
        </div>

        {!os.financialSummary?.hasCharge ? (
          <p className="text-sm text-gray-500">Sem cobrança</p>
        ) : (
          <div className="text-sm space-y-1">
            <div><b>Status:</b> {os.financialSummary.chargeStatus || "—"}</div>
            <div>
              <b>Valor:</b>{" "}
              {formatCurrency(os.financialSummary.chargeAmountCents)}
            </div>
            <div>
              <b>Vencimento:</b>{" "}
              {formatDate(os.financialSummary.chargeDueDate)}
            </div>
            <div>
              <b>Pago em:</b>{" "}
              {formatDateTime(os.financialSummary.paidAt)}
            </div>
          </div>
        )}
      </div>

      <div className="border p-4 rounded">
        <h4 className="font-semibold mb-2">Risco operacional</h4>

        <div className="text-sm space-y-1">
          {os.status === "DONE" && !os.financialSummary?.hasCharge && (
            <div className="text-red-600">
              ⚠ Execução concluída sem cobrança
            </div>
          )}

          {os.financialSummary?.chargeStatus === "OVERDUE" && (
            <div className="text-red-600">
              ⚠ Cobrança vencida
            </div>
          )}

          {os.status === "OPEN" && (
            <div className="text-amber-600">
              ⚠ Ordem ainda não iniciada
            </div>
          )}

          {os.status === "IN_PROGRESS" && !os.finishedAt && (
            <div className="text-orange-600">
              ⚠ Execução em andamento
            </div>
          )}

          {os.status === "PAID" && (
            <div className="text-green-600">
              ✓ Fluxo financeiro concluído
            </div>
          )}

          {os.status !== "DONE" &&
            os.status !== "IN_PROGRESS" &&
            os.status !== "OPEN" &&
            os.financialSummary?.chargeStatus !== "OVERDUE" &&
            !(os.status === "DONE" && !os.financialSummary?.hasCharge) && (
              <div className="text-gray-500">
                Sem alertas operacionais imediatos.
              </div>
            )}

          {os.status === "DONE" &&
            os.financialSummary?.hasCharge &&
            os.financialSummary?.chargeStatus !== "OVERDUE" &&
            os.financialSummary?.chargeStatus !== "PAID" && (
              <div className="text-amber-600">
                ⚠ Execução concluída com cobrança pendente
              </div>
            )}

          {os.status === "DONE" &&
            os.financialSummary?.chargeStatus === "PAID" && (
              <div className="text-green-600">
                ✓ Execução concluída e pagamento recebido
              </div>
            )}
        </div>
      </div>

      <div className="border p-4 rounded">
        <h4 className="font-semibold mb-2">Execução</h4>

        {executionQuery.isLoading ? (
          <p className="text-sm text-gray-500">Carregando execução...</p>
        ) : !latestExecution ? (
          <p className="text-sm text-gray-500">Sem execução</p>
        ) : (
          <div className="text-sm space-y-1">
            <div><b>Status:</b> {latestExecution.status || "—"}</div>
            <div><b>Início:</b> {formatDateTime(latestExecution.startedAt)}</div>
            <div><b>Fim:</b> {formatDateTime(latestExecution.endedAt)}</div>
            <div><b>Notas:</b> {latestExecution.notes || "—"}</div>
          </div>
        )}
      </div>

      <div className="border p-4 rounded">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4" />
          <h4 className="font-semibold">Timeline</h4>
        </div>

        {timelineQuery.isLoading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : timelineRows.length === 0 ? (
          <p className="text-sm text-gray-500">Sem eventos</p>
        ) : (
          <div className="space-y-2 text-sm">
            {timelineRows.map((e: any) => (
              <div key={e.id} className="border p-2 rounded">
                <div><b>{e.action || e.type || "EVENT"}</b></div>
                <div className="text-gray-500">{formatDateTime(e.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
