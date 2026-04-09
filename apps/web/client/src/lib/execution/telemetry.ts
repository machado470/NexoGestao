import type { ExecutionSource } from "@/lib/execution/types";

type ExecutionTelemetryEvent =
  | "action_shown"
  | "action_clicked"
  | "action_executed"
  | "action_failed";

type TrackExecutionEventInput = {
  event: ExecutionTelemetryEvent;
  actionId: string;
  decisionId?: string;
  source: ExecutionSource;
  telemetryKey: string;
  status?: string;
  ok?: boolean;
  message?: string;
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
    message: input.message,
    timestamp: new Date().toISOString(),
  });
}
