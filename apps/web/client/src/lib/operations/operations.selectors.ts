export function getOrdersByStatus<T extends { status?: string | null }>(
  list: T[],
  status: string
) {
  return list.filter((o) => String(o?.status ?? "") === status);
}

export function getOrdersInStatuses<T extends { status?: string | null }>(
  list: T[],
  statuses: string[]
) {
  return list.filter((o) => statuses.includes(String(o?.status ?? "")));
}

export function getPendingCharges<
  T extends { status?: string | null; amountCents?: number | null }
>(list: T[]) {
  return list.filter((c) => String(c?.status ?? "") === "PENDING");
}

export function getOverdueCharges<
  T extends { status?: string | null; amountCents?: number | null }
>(list: T[]) {
  return list.filter((c) => String(c?.status ?? "") === "OVERDUE");
}

export function getDoneWithoutCharge<
  T extends {
    status?: string | null;
    financialSummary?: { hasCharge?: boolean | null } | null;
  }
>(list: T[]) {
  return list.filter(
    (o) =>
      String(o?.status ?? "") === "DONE" &&
      !o?.financialSummary?.hasCharge
  );
}

export function sumAmountCents<T extends { amountCents?: number | null }>(
  list: T[]
) {
  return list.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0);
}
