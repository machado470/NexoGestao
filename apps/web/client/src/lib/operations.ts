export type AppOperationalState = "NORMAL" | "ATENÇÃO" | "CRÍTICO";
export type AppPriorityLevel = "URGENTE" | "ALTA" | "MÉDIA" | "BAIXA";

export function normalizeOperationalState(input: unknown): AppOperationalState {
  const value = String(input ?? "").trim().toLowerCase();
  if (["critical", "crítico", "critico", "suspended", "restricted"].includes(value)) return "CRÍTICO";
  if (["alert", "attention", "atenção", "atencao", "warning"].includes(value)) return "ATENÇÃO";
  return "NORMAL";
}

export function normalizePriorityLabel(input: unknown): AppPriorityLevel {
  const value = String(input ?? "").trim().toLowerCase();
  if (["urgent", "urgente", "critical", "crítico", "critico", "p0"].includes(value)) return "URGENTE";
  if (["high", "alta", "p1"].includes(value)) return "ALTA";
  if (["medium", "média", "media", "médio", "medio", "p2"].includes(value)) return "MÉDIA";
  return "BAIXA";
}
