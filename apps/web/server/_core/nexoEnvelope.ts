import { TRPCError } from "@trpc/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiErrorMessage(payload: Record<string, unknown>) {
  const message = payload.message ?? payload.error ?? (isRecord(payload.data) ? payload.data.message : undefined);
  return typeof message === "string" && message.trim() ? message : "Resposta de erro da API Nexo";
}

/**
 * Normaliza envelopes de sucesso da API Nest sem converter erros HTTP em dados.
 * Suporta respostas diretas, { data }, { success, data } e { ok, data }, inclusive
 * quando o ApiResponseInterceptor adiciona um segundo nível de data.
 */
export function unwrapNexoApiResponse<T = unknown>(raw: unknown): T {
  let current = raw;
  let guard = 0;

  while (guard < 6 && isRecord(current)) {
    guard += 1;

    if (current.success === false || current.ok === false) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: apiErrorMessage(current),
      });
    }

    if ((current.success === true || current.ok === true) && "data" in current) {
      current = current.data;
      continue;
    }

    if (isRecord(current.data) && (current.data.success === true || current.data.ok === true) && "data" in current.data) {
      current = current.data.data;
      continue;
    }

    const keys = Object.keys(current);
    const isPlainDataEnvelope =
      "data" in current &&
      keys.every((key) => ["data", "meta", "success", "ok"].includes(key));

    if (isPlainDataEnvelope) {
      current = current.data;
      continue;
    }

    break;
  }

  return current as T;
}
