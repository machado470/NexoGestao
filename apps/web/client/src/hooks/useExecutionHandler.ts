import { useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { executeExecutionAction } from "@/lib/execution/execute-action";
import { runExecutionMutation } from "@/lib/execution/mutation-adapter";
import { useExecutionMemory } from "@/lib/execution/execution-memory";
import type {
  ExecuteActionResult,
  ExecutionAction,
  ExecutionSource,
} from "@/lib/execution/types";

type ExecuteParams = {
  source: ExecutionSource;
  decisionId?: string;
};

export function useExecutionHandler() {
  const [, navigate] = useLocation();
  const apiClient = trpc.useUtils();
  const generateChargeMutation = trpc.nexo.serviceOrders.generateCharge.useMutation();
  const payChargeMutation = trpc.finance.charges.pay.useMutation();
  const { appendExecutionLog } = useExecutionMemory();

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
      console.info("[execution.telemetry]", {
        event: "action_clicked",
        actionId: action.id,
        decisionId: params.decisionId,
        source: params.source,
        telemetryKey: action.telemetryKey,
      });

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
            return runExecutionMutation(mutationKey, payload, {
              generateChargeFromServiceOrder: async (serviceOrderId) =>
                generateChargeMutation.mutateAsync({ serviceOrderId }),
              payCharge: async (input) => payChargeMutation.mutateAsync(input),
              invalidateOperationalData,
            });
          },
        }
      );

      if (result.ok && result.message) {
        toast.success(result.message);
      }

      appendExecutionLog({
        id: `${action.id}-${Date.now()}`,
        actionId: action.id,
        decisionId: params.decisionId ?? "unknown",
        executedAt: Date.now(),
        status: result.ok ? "success" : "failed",
      });

      console.info("[execution.telemetry]", {
        event: "action_executed",
        actionId: action.id,
        decisionId: params.decisionId,
        source: params.source,
        telemetryKey: action.telemetryKey,
        status: result.status,
        ok: result.ok,
      });

      return result;
    },
    [
      navigate,
      apiClient,
      appendExecutionLog,
      invalidateOperationalData,
      generateChargeMutation,
      payChargeMutation,
    ]
  );

  return { execute };
}
