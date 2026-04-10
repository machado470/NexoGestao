import {
  getCustomerDecision,
  getAppointmentDecision,
  getChargeDecision,
  getServiceOrderDecision,
  type OperationalActionKey,
} from "@/lib/operations/operational-intelligence";

export type ActionSeverity = "critical" | "warning" | "normal" | "success";

export type NextActionIntent = "resolve" | "follow_up" | "notify" | "create";

export type NextActionItem = {
  label: string;
  reason: string;
  severity: ActionSeverity;
  intent: NextActionIntent;
  actionKey: OperationalActionKey;
};

export function getNextAction(params:
  | { entity: "service_order"; item: any }
  | { entity: "charge"; item: any }
  | { entity: "appointment"; item: any }
  | { entity: "customer"; item: any }) : NextActionItem {
  const decision =
    params.entity === "service_order"
      ? getServiceOrderDecision(params.item)
      : params.entity === "charge"
        ? getChargeDecision(params.item)
        : params.entity === "appointment"
          ? getAppointmentDecision({ appointment: params.item })
          : getCustomerDecision(params.item);

  return {
    label: decision.primaryAction.label,
    reason: decision.description,
    severity: mapSeverity(decision.severity),
    intent: mapIntent(decision.primaryAction.key),
    actionKey: decision.primaryAction.key,
  };
}

function mapSeverity(severity: "critical" | "overdue" | "pending" | "healthy"): ActionSeverity {
  if (severity === "critical") return "critical";
  if (severity === "overdue") return "warning";
  if (severity === "pending") return "normal";
  return "success";
}

function mapIntent(actionKey: OperationalActionKey): NextActionIntent {
  if (actionKey === "generate_charge" || actionKey === "review_execution") return "resolve";
  if (actionKey === "open_whatsapp") return "notify";
  if (actionKey === "create_service_order" || actionKey === "create_appointment") return "create";
  return "follow_up";
}
