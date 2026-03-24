import { normalizeList } from "@/lib/utils/normalizeList";

export function normalizeOrders<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}

export function normalizeCharges<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}

export function normalizeAppointments<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}
