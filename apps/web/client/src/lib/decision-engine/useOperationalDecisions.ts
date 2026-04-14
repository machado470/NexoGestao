import { useMemo } from "react";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { trpc } from "@/lib/trpc";
import {
  getAppointmentDecisions,
  getFinanceDecisions,
  getGovernanceDecisions,
  getServiceOrderDecisions,
  getWhatsappDecisions,
} from "./decision.resolvers";
import type { Decision, DecisionSeverity } from "./decision.types";

type UseOperationalDecisionsInput = {
  navigate: (href: string) => void;
  customerId?: string | null;
  enabled?: boolean;
};

export const severityRank: Record<DecisionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortDecisionsBySeverity(decisions: Decision[]) {
  return [...decisions].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function useOperationalDecisions(input: UseOperationalDecisionsInput) {
  const enabled = input.enabled ?? true;
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false, enabled });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false, enabled });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false, enabled });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false, enabled });
  const governanceSummaryQuery = trpc.governance.summary.useQuery(undefined, { retry: false, enabled });
  const messagesQuery = trpc.nexo.whatsapp.messages.useQuery(
    { customerId: String(input.customerId ?? "") },
    { retry: false, enabled: enabled && Boolean(input.customerId) }
  );

  const decisions = useMemo(() => {
    const customerId = String(input.customerId ?? "");
    const charges = normalizeArrayPayload<any>(chargesQuery.data).filter((item) => !customerId || String(item?.customerId ?? "") === customerId);
    const appointments = normalizeArrayPayload<any>(appointmentsQuery.data).filter((item) => !customerId || String(item?.customerId ?? "") === customerId);
    const serviceOrders = normalizeArrayPayload<any>(serviceOrdersQuery.data).filter((item) => !customerId || String(item?.customerId ?? "") === customerId);
    const customers = normalizeArrayPayload<any>(customersQuery.data).filter((item) => !customerId || String(item?.id ?? "") === customerId);
    const messages = normalizeArrayPayload<any>(messagesQuery.data);
    const governanceSummary = normalizeObjectPayload<any>(governanceSummaryQuery.data) ?? {};

    const resolved: Decision[] = sortDecisionsBySeverity([
      ...getFinanceDecisions({ charges }, { navigate: input.navigate }),
      ...getAppointmentDecisions({ appointments }, { navigate: input.navigate }),
      ...getServiceOrderDecisions({ serviceOrders }, { navigate: input.navigate }),
      ...getWhatsappDecisions({ customers, messages }, { navigate: input.navigate }),
      ...getGovernanceDecisions({ summary: governanceSummary }, { navigate: input.navigate }),
    ].filter((decision) => typeof decision.action?.execute === "function" && Boolean(decision.action?.label)));

    return resolved;
  }, [
    appointmentsQuery.data,
    chargesQuery.data,
    customersQuery.data,
    governanceSummaryQuery.data,
    input.customerId,
    input.navigate,
    messagesQuery.data,
    serviceOrdersQuery.data,
  ]);

  const isLoading = chargesQuery.isLoading || appointmentsQuery.isLoading || serviceOrdersQuery.isLoading || customersQuery.isLoading || governanceSummaryQuery.isLoading;

  return {
    decisions,
    isLoading,
    refetchAll: () => Promise.all([
      chargesQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      customersQuery.refetch(),
      governanceSummaryQuery.refetch(),
      input.customerId ? messagesQuery.refetch() : Promise.resolve(),
    ]),
  };
}
