import { normalizeArrayPayload } from "@/lib/query-helpers";

export function normalizeList<T = any>(data: unknown): T[] {
  return normalizeArrayPayload<T>(data);
}
