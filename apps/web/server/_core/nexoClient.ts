import { TRPCError } from "@trpc/server";
import cookie from "cookie";
import { resolveNexoApiUrl } from "./nexoApiUrl";
import { internalApiHeaders } from "./internalAuth";

const NEXO_API_URL = resolveNexoApiUrl();
const NEXO_TOKEN_COOKIE = "nexo_token";
const NEXO_FETCH_TIMEOUT_MS = Number(process.env.NEXO_FETCH_TIMEOUT_MS || 12000);

type CtxLike = {
  req?: any;
  user?: {
    token?: string;
  } | null;
};

function getBearerTokenFromHeader(authHeader: unknown): string | null {
  if (typeof authHeader !== "string") return null;

  const normalized = authHeader.trim();
  if (!normalized) return null;

  if (normalized.toLowerCase().startsWith("bearer ")) {
    const token = normalized.slice(7).trim();
    return token || null;
  }

  return normalized;
}

function getNexoTokenFromReq(req: any): string | null {
  const reqCookies = req?.cookies;
  if (reqCookies && typeof reqCookies?.[NEXO_TOKEN_COOKIE] === "string") {
    const token = reqCookies[NEXO_TOKEN_COOKIE].trim();
    if (token) return token;
  }

  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function resolveAuthToken(source: any): string | null {
  if (source?.user?.token && typeof source.user.token === "string") {
    const token = source.user.token.trim();
    if (token) return token;
  }

  const directHeader = getBearerTokenFromHeader(source?.headers?.authorization);
  if (directHeader) return directHeader;

  const reqHeader = getBearerTokenFromHeader(source?.req?.headers?.authorization);
  if (reqHeader) return reqHeader;

  const reqCookieToken = getNexoTokenFromReq(source?.req ?? source);
  if (reqCookieToken) return reqCookieToken;

  return null;
}

function extractErrorMessage(body: any, status: number): string {
  if (!body) return `Nexo API error ${status}`;

  if (typeof body === "string" && body.trim()) return body;

  if (Array.isArray(body?.message)) return body.message.join(", ");

  if (typeof body?.message === "string") return body.message;

  if (typeof body?.error === "string") return body.error;

  if (typeof body?.data?.message === "string") return body.data.message;

  return `Nexo API error ${status}`;
}

/** Upstream codes are identifiers, never free text (same contract as the API filter). */
const SAFE_UPSTREAM_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;
/** Longest wait the BFF will relay; anything above is clamped, anything malformed dropped. */
export const MAX_RETRY_AFTER_SECONDS = 3600;

function extractErrorCode(body: any): string | null {
  const code = body?.code ?? body?.data?.code ?? body?.errorCode;
  return typeof code === "string" && SAFE_UPSTREAM_CODE.test(code.trim()) ? code.trim() : null;
}

/**
 * Parses an upstream Retry-After header. Only delta-seconds (1–5 ASCII digits) are accepted;
 * HTTP-dates, signs, decimals, lists or any other text are ignored. The result is clamped to
 * [1, MAX_RETRY_AFTER_SECONDS], so the BFF only ever emits an integer it produced itself.
 */
export function parseRetryAfterSeconds(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!/^\d{1,5}$/.test(value)) return undefined;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return undefined;
  return Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
}

export class NexoHttpError extends Error {
  status: number;
  body: any;
  code: string | null;
  retryAfterSeconds: number | undefined;

  constructor(status: number, body: any, retryAfterSeconds?: number) {
    super(extractErrorMessage(body, status));
    this.name = "NexoHttpError";
    this.status = status;
    this.body = body;
    this.code = extractErrorCode(body);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const GENERIC_UPSTREAM_MESSAGE = /^(nexo api error \d{3}|thrott?ler ?exception.*|too many requests|service unavailable( exception)?|internal server error)$/i;

function retrySentence(seconds: number | undefined): string {
  if (!seconds) return "Tente novamente em alguns instantes.";
  if (seconds < 60) return `Tente novamente em ${seconds} ${seconds === 1 ? "segundo" : "segundos"}.`;
  const minutes = Math.ceil(seconds / 60);
  return `Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`;
}

/**
 * User-facing text for 429/503. Specific API messages (e.g. a tenant queue limit) are kept;
 * generic ones and the rate-limit family get a clear message with the wait time, if known.
 */
export function temporaryFailureMessage(error: Pick<NexoHttpError, "status" | "message" | "code" | "retryAfterSeconds" | "body">): string {
  const generic =
    typeof error.body !== "object" || error.body === null ||
    !error.message.trim() ||
    GENERIC_UPSTREAM_MESSAGE.test(error.message.trim()) ||
    error.code === "RATE_LIMITED" ||
    error.code === "RATE_LIMIT_UNAVAILABLE" ||
    error.code === "SERVICE_UNAVAILABLE";
  if (!generic) return error.message;
  const base = error.status === 429
    ? "Muitas tentativas em pouco tempo."
    : "Serviço temporariamente indisponível.";
  return `${base} ${retrySentence(error.retryAfterSeconds)}`;
}

function mapNexoHttpErrorToTrpcError(error: NexoHttpError): TRPCError {
  if (error.status === 401) {
    return new TRPCError({ code: "UNAUTHORIZED", message: error.message, cause: error });
  }

  if (error.status === 403) {
    return new TRPCError({ code: "FORBIDDEN", message: error.message, cause: error });
  }

  if (error.status === 404) {
    return new TRPCError({ code: "NOT_FOUND", message: error.message, cause: error });
  }

  if (error.status === 409) {
    return new TRPCError({ code: "CONFLICT", message: error.message, cause: error });
  }

  if (error.status === 400) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
  }

  if (error.status === 429) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: temporaryFailureMessage(error), cause: error });
  }

  if (error.status === 503) {
    return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: temporaryFailureMessage(error), cause: error });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message, cause: error });
}

/** Safe, client-visible details of a failed upstream call (used by the tRPC error formatter). */
export function upstreamErrorDetails(error: unknown): { upstreamCode?: string; retryAfterSeconds?: number } {
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (!(cause instanceof NexoHttpError)) return {};
  return {
    ...(cause.code ? { upstreamCode: cause.code } : {}),
    ...(cause.retryAfterSeconds ? { retryAfterSeconds: cause.retryAfterSeconds } : {}),
  };
}

async function requestNexo<T>(
  source: CtxLike | any,
  path: string,
  init: RequestInit = {},
  requireAuth = true,
): Promise<T> {
  const startedAt = Date.now();
  const token = resolveAuthToken(source);

  if (!token && requireAuth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado" });
  }
  const timeoutMs =
    Number.isFinite(NEXO_FETCH_TIMEOUT_MS) && NEXO_FETCH_TIMEOUT_MS > 0
      ? NEXO_FETCH_TIMEOUT_MS
      : 12000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const upstreamSignal = init?.signal;

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort(upstreamSignal.reason ?? "aborted");
    } else {
      upstreamSignal.addEventListener(
        "abort",
        () => controller.abort(upstreamSignal.reason ?? "aborted"),
        { once: true }
      );
    }
  }

  let res: Response;
  try {
    const requestId =
      source?.req?.headers?.["x-request-id"] ??
      source?.headers?.["x-request-id"] ??
      undefined;
    const correlationId =
      source?.req?.headers?.["x-correlation-id"] ??
      source?.headers?.["x-correlation-id"] ??
      requestId ??
      undefined;
    const url = `${NEXO_API_URL}${path}`;
    res = await fetch(url, {
      ...init,
      credentials: "include",
      signal: controller.signal,
      // C7.2d: caller x-nexo-* headers are dropped; the BFF signature (if enabled) is added last.
      headers: internalApiHeaders(
        {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "content-type": "application/json",
          ...(requestId ? { "x-request-id": String(requestId) } : {}),
          ...(correlationId ? { "x-correlation-id": String(correlationId) } : {}),
          ...((init?.headers as Record<string, string> | undefined) || {}),
        },
        { method: init?.method ?? "GET", url, body: init?.body },
      ),
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `Timeout ao chamar Nexo API (${timeoutMs}ms) em ${path}`,
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Falha ao conectar no backend Nexo API (${NEXO_API_URL}) em ${path}: ${error?.message || "erro desconhecido"}`,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  const durationMs = Date.now() - startedAt;

  if (process.env.NODE_ENV === "development") {
    console.log("[NEXO_FETCH]", {
      path,
      status: res.status,
      durationMs,
      ok: res.ok,
    });
  }

  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const retryAfterSeconds = res.status === 429 || res.status === 503
      ? parseRetryAfterSeconds(res.headers?.get?.("retry-after"))
      : undefined;
    throw mapNexoHttpErrorToTrpcError(new NexoHttpError(res.status, body, retryAfterSeconds));
  }

  return body as T;
}

export async function nexoFetch<T>(
  source: CtxLike | any,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return requestNexo<T>(source, path, init, true);
}

/** Shared transport for the API's intentionally anonymous auth endpoints. */
export async function nexoPublicFetch<T>(
  source: CtxLike | any,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return requestNexo<T>(source, path, init, false);
}
