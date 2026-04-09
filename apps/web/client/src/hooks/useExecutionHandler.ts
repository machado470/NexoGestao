import { useCallback } from "react";
import { useLocation } from "wouter";
import { executeExecutionAction } from "@/lib/execution/execute-action";
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

  const execute = useCallback(
    async (
      action: ExecutionAction,
      params: ExecuteParams
    ): Promise<ExecuteActionResult> => {
      return executeExecutionAction(
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
        }
      );
    },
    [navigate]
  );

  return { execute };
}
