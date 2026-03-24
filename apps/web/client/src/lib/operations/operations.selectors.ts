import { normalizeStatus } from "./operations.utils";

export function getOrdersByStatus<T extends { status?: string | null }>(
  list: T[],
  status: string
) {
  const targetStatus = normalizeStatus(status);
  return list.filter((o) => normalizeStatus(o?.status) === targetStatus);
}

export function getOrdersInStatuses<T extends { status?: string | null }>(
  list: T[],
  statuses: string[]
) {
  const targetStatuses = statuses.map((status) => normalizeStatus(status));
  return list.filter((o) =>
    targetStatuses.includes(normalizeStatus(o?.status))
  );
}

export function getPendingCharges<
  T extends { status?: string | null; amountCents?: number | null }
>(list: T[]) {
  return list.filter((c) => normalizeStatus(c?.status) === "PENDING");
}

export function getOverdueCharges<
  T extends { status?: string | null; amountCents?: number | null }
>(list: T[]) {
  return list.filter((c) => normalizeStatus(c?.status) === "OVERDUE");
}

export function getDoneWithoutCharge<
  T extends {
    status?: string | null;
    financialSummary?: { hasCharge?: boolean | null } | null;
  }
>(list: T[]) {
  return list.filter(
    (o) =>
      normalizeStatus(o?.status) === "DONE" &&
      !o?.financialSummary?.hasCharge
  );
}

export function sumAmountCents<T extends { amountCents?: number | null }>(
  list: T[]
) {
  return list.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
}
