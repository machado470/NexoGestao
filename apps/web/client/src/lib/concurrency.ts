const CONFLICT_CODES = new Set([
  "APPOINTMENT_CONCURRENT_MODIFICATION",
  "SERVICE_ORDER_CONCURRENT_MODIFICATION",
  "CHARGE_CONCURRENT_MODIFICATION",
  "CUSTOMER_CONCURRENT_MODIFICATION",
  "PERSON_CONCURRENT_MODIFICATION",
]);

function extractCodeFromMessage(message?: string | null): string | null {
  if (!message) return null;
  const match = message.match(/\[([A-Z0-9_]+)\]/);
  return match?.[1] ?? null;
}

export function extractErrorCode(error: unknown): string | null {
  const candidate = error as any;
  return (
    candidate?.data?.code ??
    candidate?.shape?.data?.code ??
    candidate?.cause?.body?.code ??
    extractCodeFromMessage(candidate?.message) ??
    null
  );
}

export function isConcurrentConflictError(error: unknown): boolean {
  const candidate = error as any;
  const code = extractErrorCode(error);
  return (
    code !== null && CONFLICT_CODES.has(code)
  ) || candidate?.data?.httpStatus === 409;
}

export function getConcurrencyErrorMessage(entityLabel = "registro"): string {
  return `Este ${entityLabel} foi alterado por outra ação. Recarregue os dados antes de salvar novamente.`;
}
