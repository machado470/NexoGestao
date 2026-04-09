import { buildDashboardRules, type DashboardExecutionFacts } from "@/lib/execution/rules";
import type { ExecutionPlan } from "@/lib/execution/types";

export function buildDashboardExecutionPlan(
  facts: DashboardExecutionFacts
): ExecutionPlan {
  return {
    id: `dashboard-plan-${new Date().toISOString().slice(0, 10)}`,
    source: "dashboard",
    decisions: buildDashboardRules(facts),
  };
}
