export type DecisionSeverity = "low" | "medium" | "high" | "critical";

export type DecisionAction = {
  label: string;
  execute: () => void;
};

export type Decision = {
  id: string;
  title: string;
  description: string;
  severity: DecisionSeverity;
  action: DecisionAction;
  source: "finance" | "appointment" | "service-order" | "whatsapp" | "governance";
  entityId?: string;
};
