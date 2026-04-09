import type { ExecutionLog, OperationalDecision } from "@/lib/execution/types";
import type { DashboardExecutionFacts } from "@/lib/execution/rules";

function getRecentSuccessCount(decisionId: string, logs: ExecutionLog[]) {
  const now = Date.now();
  const windowMs = 1000 * 60 * 60 * 24;

  return logs.filter(log => {
    if (log.decisionId !== decisionId) return false;
    if (log.status !== "success") return false;
    return now - log.executedAt <= windowMs;
  }).length;
}

function getRecencyPenalty(decisionId: string, logs: ExecutionLog[]) {
  const latestSuccess = logs
    .filter(log => log.decisionId === decisionId && log.status === "success")
    .sort((a, b) => b.executedAt - a.executedAt)[0];

  if (!latestSuccess) return 0;

  const elapsedMs = Date.now() - latestSuccess.executedAt;
  if (elapsedMs <= 1000 * 60 * 30) return 40;
  if (elapsedMs <= 1000 * 60 * 60 * 6) return 20;
  if (elapsedMs <= 1000 * 60 * 60 * 24) return 10;
  return 0;
}

export function applyDynamicPriorities(
  decisions: OperationalDecision[],
  facts: DashboardExecutionFacts
): OperationalDecision[] {
  const logs = facts.executionLogs ?? [];
  const doneWithoutCharge = Math.max(facts.completedOrders - facts.chargesGenerated, 0);
  const overdueDays = Math.max(Number(facts.overdueChargeCandidate?.daysOverdue ?? 0), 0);
  const overdueValueCents = Math.max(Number(facts.overdueChargeCandidate?.amountCents ?? 0), 0);

  return decisions.map((decision) => {
    const basePriority = Number(decision.priority ?? 0);

    let timeWeight = 0;
    let valueWeight = 0;
    let frequencyWeight = 0;

    if (decision.id === "decision-overdue-charge") {
      timeWeight = Math.min(overdueDays * 3, 35);
      valueWeight = Math.min(Math.floor(overdueValueCents / 10000), 30);
      frequencyWeight = Math.min(facts.overdueCharges * 2, 20);
    }

    if (decision.id === "decision-done-without-charge") {
      valueWeight = Math.min(
        Math.floor(Math.max(Number(facts.doneWithoutChargeCandidate?.amountCents ?? 0), 0) / 8000),
        35
      );
      frequencyWeight = Math.min(doneWithoutCharge * 3, 25);
    }

    if (decision.id === "decision-today-appointments") {
      frequencyWeight = Math.min(facts.todayAppointments * 2, 20);
      timeWeight = facts.todayAppointments > 0 ? 8 : 0;
    }

    const recentSuccessCount = getRecentSuccessCount(decision.id, logs);
    const recencyPenalty = getRecencyPenalty(decision.id, logs);
    const frequencyPenalty = recentSuccessCount > 0 ? Math.min(recentSuccessCount * 5, 15) : 0;

    return {
      ...decision,
      priority: Math.max(
        basePriority + timeWeight + valueWeight + frequencyWeight - recencyPenalty - frequencyPenalty,
        1
      ),
    };
  });
}
