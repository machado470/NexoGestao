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

export function normalizeStatus(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function formatCurrency(valueCents?: number | null) {
  if (typeof valueCents !== "number") return "—";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR");
}
