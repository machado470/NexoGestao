export type PriorityProblemType =
  | "idle_cash"
  | "overdue_charges"
  | "stalled_service_orders"
  | "operational_risk";

export type PriorityPageContext =
  | "dashboard"
  | "customers"
  | "finances"
  | "service-orders"
  | "appointments"
  | "people";

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

const BASE_PRIORITY_WEIGHT: Record<PriorityProblemType, number> = {
  idle_cash: 4,
  overdue_charges: 3,
  stalled_service_orders: 2,
  operational_risk: 1,
};

const CONTEXT_WEIGHT_BOOST: Record<PriorityPageContext, Partial<Record<PriorityProblemType, number>>> = {
  dashboard: {},
  customers: {
    stalled_service_orders: 2,
  },
  finances: {
    overdue_charges: 4,
    idle_cash: 2,
  },
  "service-orders": {
    stalled_service_orders: 4,
    overdue_charges: 2,
  },
  appointments: {
    operational_risk: 3,
    stalled_service_orders: 2,
  },
  people: {
    operational_risk: 4,
    stalled_service_orders: 2,
  },
};

function resolveWeight(type: PriorityProblemType, pageContext: PriorityPageContext) {
  return BASE_PRIORITY_WEIGHT[type] + (CONTEXT_WEIGHT_BOOST[pageContext][type] ?? 0);
}

type RankPriorityOptions = {
  limit?: number;
  pageContext?: PriorityPageContext;
};

export function rankPriorityProblems(
  problems: PriorityProblem[],
  options: number | RankPriorityOptions = 3
): PriorityProblem[] {
  const limit = typeof options === "number" ? options : options.limit ?? 3;
  const pageContext = typeof options === "number" ? "dashboard" : options.pageContext ?? "dashboard";

  return [...problems]
    .filter((problem) => problem.count > 0 || problem.impactCents > 0)
    .sort((a, b) => {
      const weightDiff = resolveWeight(b.type, pageContext) - resolveWeight(a.type, pageContext);
      if (weightDiff !== 0) return weightDiff;

      const impactDiff = b.impactCents - a.impactCents;
      if (impactDiff !== 0) return impactDiff;

      return b.count - a.count;
    })
    .slice(0, limit);
}
