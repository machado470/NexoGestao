export type OperationFeedbackInput = {
  operationStatus?: string | null;
  degradedStatus?: string | null;
  executedMessage: string;
  duplicateMessage: string;
  retryScheduledMessage: string;
  blockedMessage?: string;
};

export function resolveOperationFeedback(input: OperationFeedbackInput): string {
  const normalized = String(input.operationStatus ?? "").toLowerCase();

  if (normalized === "duplicate") return input.duplicateMessage;
  if (normalized === "blocked") return input.blockedMessage ?? "Ação bloqueada por política operacional.";
  if (normalized === "retry_scheduled" || String(input.degradedStatus ?? "").toLowerCase() === "retry_scheduled") {
    return input.retryScheduledMessage;
  }

  return input.executedMessage;
}
