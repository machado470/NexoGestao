import { TRPCError } from "@trpc/server";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

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

export class NexoHttpError extends Error {
  status: number;
  body: any;

  constructor(status: number, body: any) {
    super(extractErrorMessage(body, status));
    this.name = "NexoHttpError";
    this.status = status;
    this.body = body;
  }
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

  if (error.status === 400) {
    return new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
  }

  if (error.status === 429) {
    return new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message, cause: error });
  }

  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message, cause: error });
}

export async function nexoFetch<T>(
  source: CtxLike | any,
  path: string,
  init?: RequestInit & { allowAnonymous?: boolean }
): Promise<T | null> {
  const token = resolveAuthToken(source);

  if (!token) {
    if (init?.allowAnonymous) return null;
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado" });
  }

  const res = await fetch(`${NEXO_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });

  const text = await res.text();

  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw mapNexoHttpErrorToTrpcError(new NexoHttpError(res.status, body));
  }

  return body as T;
}
