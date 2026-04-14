import { useEffect } from "react";
import { runAutomation } from "@/lib/automation-engine/automation.engine";
import { useOperationalDecisions } from "@/lib/decision-engine/useOperationalDecisions";

type UseAutomationRunnerInput = Parameters<typeof useOperationalDecisions>[0];

export function useAutomationRunner(input: UseAutomationRunnerInput) {
  const { decisions } = useOperationalDecisions(input);

  useEffect(() => {
    if (!decisions.length) return;

    void runAutomation(decisions);
  }, [decisions]);
}
