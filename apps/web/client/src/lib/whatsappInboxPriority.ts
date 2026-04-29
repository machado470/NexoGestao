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
  hasOverdueCharge?: boolean;
  noResponseSince?: string | Date | null;
  governanceSignal?: GovernanceSignal | null;
};

export function resolveInboxPriority(input: PriorityInput): InboxPriority {
  const failedCount = input.governanceSignal?.failedMessageCount ?? 0;
  const hasNoResponse = Boolean(input.isAwaitingReply || input.noResponseSince);
  if ((input.hasOverdueCharge && hasNoResponse) || input.hasFailedDelivery || failedCount >= 2 || input.governanceSignal?.communicationFailure) return "CRITICAL";
  if (input.hasPendingCharge || hasNoResponse) return "HIGH";
  if (input.isResolved) return "LOW";
  return "MEDIUM";
}

export function priorityRank(priority: InboxPriority): number {
  if (priority === "CRITICAL") return 0;
  if (priority === "HIGH") return 1;
  if (priority === "MEDIUM") return 2;
  return 3;
}
