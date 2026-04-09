import { applyDynamicPriorities } from "@/lib/execution/prioritizer";
import { buildDashboardRules, type DashboardExecutionFacts, sortDecisions } from "@/lib/execution/rules";
import type { ExecutionPlan } from "@/lib/execution/types";

export function buildDashboardExecutionPlan(
  facts: DashboardExecutionFacts
): ExecutionPlan {
  const baseDecisions = buildDashboardRules(facts);
  const prioritized = applyDynamicPriorities(baseDecisions, facts);

  return {
    id: `dashboard-plan-${new Date().toISOString().slice(0, 10)}`,
    source: "dashboard",
    decisions: sortDecisions(prioritized),
  };
}
