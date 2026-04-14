import { useMemo } from "react";
import { useOperationalDecisions } from "./useOperationalDecisions";

type UseNextExecutionInput = Parameters<typeof useOperationalDecisions>[0];

export function useNextExecution(input: UseNextExecutionInput) {
  const { decisions, isLoading, refetchAll } = useOperationalDecisions(input);

  const nextExecution = useMemo(() => {
    const nextDecision = decisions[0] ?? null;
    const queue = decisions.slice(0, 3);
    return { nextDecision, queue };
  }, [decisions]);

  return {
    ...nextExecution,
    isLoading,
    refetchAll,
    allDecisions: decisions,
  };
}
