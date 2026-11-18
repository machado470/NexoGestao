import { canVisitMobileRoute } from "./mobile-navigation";
import { type Role } from "./rbac";
import { unwrapTrpcPayload } from "./query-helpers";
export type SearchResult = {
  id: string;
  type: "customer" | "appointment" | "serviceOrder" | "charge";
  title: string;
  subtitle?: string;
  route: string;
};
const paths = {
  customer: ["/customers", "customerId"],
  appointment: ["/appointments", "appointmentId"],
  serviceOrder: ["/service-orders", "id"],
  charge: ["/finances", "chargeId"],
} as const;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
function collection(value: unknown, depth = 0): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!record(value) || depth > 4) return null;
  for (const key of ["items", "data", "rows", "results"])
    if (key in value) return collection(value[key], depth + 1);
  return null;
}
export function normalizeGlobalSearchResults(
  payload: unknown,
  role: Role | null
): { valid: boolean; results: SearchResult[] } {
  const raw = unwrapTrpcPayload(payload);
  let rows: unknown[];
  if (Array.isArray(raw)) rows = raw;
  else {
    const data = record(raw) && record(raw.data) ? raw.data : raw;
    if (!record(data)) return { valid: false, results: [] };
    const customers = collection(data.customers),
      orders = collection(data.serviceOrders);
    if (!customers || !orders) return { valid: false, results: [] };
    rows = [
      ...customers
        .filter(record)
        .map(item => ({
          ...item,
          type: "customer",
          title: item.name,
          subtitle: item.phone,
        })),
      ...orders
        .filter(record)
        .map(item => ({
          ...item,
          type: "serviceOrder",
          title: item.title,
          subtitle: item.number,
        })),
    ];
  }
  const results: SearchResult[] = [];
  for (const row of rows) {
    if (
      !record(row) ||
      typeof row.type !== "string" ||
      !Object.prototype.hasOwnProperty.call(paths, row.type) ||
      typeof row.title !== "string"
    )
      continue;
    if (typeof row.id !== "string" && typeof row.id !== "number") continue;
    const id = String(row.id).trim();
    if (!id) continue;
    const type = row.type as SearchResult["type"],
      [path, key] = paths[type];
    const route = `${path}?${new URLSearchParams({ [key]: id })}`;
    if (!canVisitMobileRoute(role, route)) continue;
    results.push({
      id,
      type,
      title: row.title,
      subtitle: typeof row.subtitle === "string" ? row.subtitle : undefined,
      route,
    });
  }
  return { valid: true, results };
}
