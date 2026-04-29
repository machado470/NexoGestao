export type InboxPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type GovernanceSignal = {
  communicationFailure?: boolean;
  failedMessageCount?: number;
  lastFailedAt?: string | null;
};

type PriorityInput = {
  hasFailedDelivery: boolean;
  hasPendingCharge: boolean;
  isAwaitingReply: boolean;
  isResolved: boolean;
  governanceSignal?: GovernanceSignal | null;
};

export function resolveInboxPriority(input: PriorityInput): InboxPriority {
  if (input.hasFailedDelivery || input.governanceSignal?.communicationFailure) return "CRITICAL";
  if (input.hasPendingCharge) return "HIGH";
  if (input.isAwaitingReply) return "HIGH";
  if (input.isResolved) return "LOW";
  return "MEDIUM";
}

export function priorityRank(priority: InboxPriority): number {
  if (priority === "CRITICAL") return 0;
  if (priority === "HIGH") return 1;
  if (priority === "MEDIUM") return 2;
  return 3;
}
