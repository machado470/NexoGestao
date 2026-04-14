import type { Decision } from "@/lib/decision-engine/decision.types";

export type AutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  condition: (decision: Decision) => boolean;
  autoExecute: boolean;
  delayMs?: number;
};

export type AutomationLogStatus = "success" | "error" | "skipped";

export type AutomationLogEntry = {
  rule_id: string;
  decision_id: string;
  timestamp: string;
  status: AutomationLogStatus;
  error?: string;
};
