import type { ExecutionSource } from "@/lib/execution/types";

type ExecutionTelemetryEvent =
  | "action_shown"
  | "action_clicked"
  | "action_executed"
  | "action_failed"
  | "action_policy_blocked"
  | "action_requires_confirmation"
  | "action_throttled";

type TrackExecutionEventInput = {
  event: ExecutionTelemetryEvent;
  actionId: string;
  decisionId?: string;
  source: ExecutionSource;
  telemetryKey: string;
  status?: string;
  ok?: boolean;
  message?: string;
  reasonCode?: string;
};

export function trackExecutionEvent(input: TrackExecutionEventInput) {
  console.info("[execution.telemetry]", {
    event: input.event,
    actionId: input.actionId,
    decisionId: input.decisionId,
    source: input.source,
    telemetryKey: input.telemetryKey,
    status: input.status,
    ok: input.ok,
    reasonCode: input.reasonCode,
    message: input.message,
    timestamp: new Date().toISOString(),
  });
}
