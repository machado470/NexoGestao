import { useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { executeExecutionAction } from "@/lib/execution/execute-action";
import { runExecutionMutation } from "@/lib/execution/mutation-adapter";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import { buildExecutionKey, hasRecentExecutionByKey } from "@/lib/execution/idempotency";
import { trackExecutionEvent } from "@/lib/execution/telemetry";
import type {
  ExecuteActionResult,
  ExecutionAction,
  ExecutionSource,
} from "@/lib/execution/types";


async function hasRecentExecutionOnBackend(executionKey: string) {
  try {
    const response = await fetch(
      `/execution/logs?executionKey=${encodeURIComponent(executionKey)}&sinceMs=${1000 * 60 * 30}`,
      { credentials: "include" }
    );

    if (!response.ok) return false;
    const payload = (await response.json()) as { logs?: Array<{ status?: string }> };
    return Array.isArray(payload.logs)
      ? payload.logs.some(log => log.status === "success")
      : false;
  } catch {
    return false;
  }
}

type ExecuteParams = {
  source: ExecutionSource;
  decisionId?: string;
  entityType?: "customer" | "appointment" | "serviceOrder" | "charge" | "payment" | "system";
  entityId?: string;
};

export function useExecutionHandler() {
  const [, navigate] = useLocation();
  const apiClient = trpc.useUtils();
  const generateChargeMutation = trpc.nexo.serviceOrders.generateCharge.useMutation();
  const payChargeMutation = trpc.finance.charges.pay.useMutation();
  const { appendExecutionLog, logs, wasRecentlyExecuted, syncExecutionLogAsync } = useExecutionMemory();

  const invalidateOperationalData = useCallback(async () => {
    await Promise.all([
      apiClient.nexo.serviceOrders.list.invalidate(),
      apiClient.finance.charges.list.invalidate(),
      apiClient.finance.charges.stats.invalidate(),
      apiClient.dashboard.alerts.invalidate(),
      apiClient.dashboard.kpis.invalidate(),
      apiClient.dashboard.revenueTrend.invalidate(),
      apiClient.dashboard.chargeDistribution.invalidate(),
      apiClient.dashboard.serviceOrdersStatus.invalidate(),
      apiClient.nexo.timeline.listByOrg.invalidate(),
    ]);
  }, [apiClient]);

  const execute = useCallback(
    async (
      action: ExecutionAction,
      params: ExecuteParams
    ): Promise<ExecuteActionResult> => {
      const executionKey = buildExecutionKey(action.id, action.payload);

      trackExecutionEvent({
        event: "action_clicked",
        actionId: action.id,
        decisionId: params.decisionId,
        source: params.source,
        telemetryKey: action.telemetryKey,
      });

      if (
        action.kind === "mutation" &&
        (wasRecentlyExecuted({
          actionId: action.id,
          decisionId: params.decisionId ?? "unknown",
          executionKey,
        }) ||
          hasRecentExecutionByKey({ executionKey, logs }) ||
          (await hasRecentExecutionOnBackend(executionKey)))
      ) {
        return {
          ok: true,
          status: "executed",
          message: "Ação já executada recentemente. Operação mantida sem duplicidade.",
        };
      }

      const result = await executeExecutionAction(
        action,
        {
          source: params.source,
          decisionId: params.decisionId,
        },
        {
          navigate,
          openExternal: (url) => {
            window.open(url, "_blank", "noopener,noreferrer");
          },
          mutate: async (mutationKey, payload) => {
            return runExecutionMutation(
              mutationKey,
              payload,
              {
                generateChargeFromServiceOrder: async (serviceOrderId) =>
                  generateChargeMutation.mutateAsync({ id: serviceOrderId }),
                payCharge: async (input) => payChargeMutation.mutateAsync(input),
                invalidateOperationalData,
                checkIdempotency: (key) =>
                  wasRecentlyExecuted({
                    actionId: action.id,
                    decisionId: params.decisionId ?? "unknown",
                    executionKey: key,
                  }),
              },
              { executionKey }
            );
          },
        }
      );

      if (result.ok && result.message) {
        toast.success(result.message);
      }

      const log = {
        id: `${action.id}-${Date.now()}`,
        actionId: action.id,
        decisionId: params.decisionId ?? "unknown",
        executionKey,
        executedAt: Date.now(),
        status: result.ok ? ("success" as const) : ("failed" as const),
        entityType: params.entityType,
        entityId: params.entityId,
      };

      appendExecutionLog(log);
      void syncExecutionLogAsync(log);

      trackExecutionEvent({
        event: result.ok ? "action_executed" : "action_failed",
        actionId: action.id,
        decisionId: params.decisionId,
        source: params.source,
        telemetryKey: action.telemetryKey,
        status: result.status,
        ok: result.ok,
        message: result.message,
      });

      return result;
    },
    [
      navigate,
      logs,
      appendExecutionLog,
      invalidateOperationalData,
      generateChargeMutation,
      payChargeMutation,
      syncExecutionLogAsync,
      wasRecentlyExecuted,
    ]
  );

  return { execute };
}
