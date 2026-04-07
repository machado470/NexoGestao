export type PriorityProblemType =
  | "idle_cash"
  | "overdue_charges"
  | "stalled_service_orders"
  | "operational_risk";

export type PriorityProblem = {
  id: string;
  type: PriorityProblemType;
  title: string;
  count: number;
  impactCents: number;
  ctaLabel: string;
  ctaPath: string;
  helperText: string;
};

const PRIORITY_WEIGHT: Record<PriorityProblemType, number> = {
  idle_cash: 4,
  overdue_charges: 3,
  stalled_service_orders: 2,
  operational_risk: 1,
};

export function rankPriorityProblems(problems: PriorityProblem[], limit = 3): PriorityProblem[] {
  return [...problems]
    .filter((problem) => problem.count > 0 || problem.impactCents > 0)
    .sort((a, b) => {
      const weightDiff = PRIORITY_WEIGHT[b.type] - PRIORITY_WEIGHT[a.type];
      if (weightDiff !== 0) return weightDiff;

      const impactDiff = b.impactCents - a.impactCents;
      if (impactDiff !== 0) return impactDiff;

      return b.count - a.count;
    })
    .slice(0, limit);
}
