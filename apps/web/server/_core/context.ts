import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import cookie from "cookie";

const NEXO_TOKEN_COOKIE = "nexo_token";

export type TrpcUser = {
  token: string;
  id?: string;
  organizationId?: string;
  role?: string;
  email?: string;
  name?: string;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: TrpcUser | null;
};

export type Context = TrpcContext;

export function getNexoTokenFromReq(req: any): string | null {
  const reqCookies = req?.cookies;
  if (reqCookies && typeof reqCookies?.[NEXO_TOKEN_COOKIE] === "string") {
    const token = reqCookies[NEXO_TOKEN_COOKIE].trim();
    if (token) return token;
  }

  const authHeader = req?.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.trim()) {
    const normalized = authHeader.trim();
    if (normalized.toLowerCase().startsWith("bearer ")) {
      const token = normalized.slice(7).trim();
      if (token) return token;
    } else {
      return normalized;
    }
  }

  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];

  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function unwrapMePayload(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null;

  const level1 = payload;
  const level2 = isObject(level1.data) ? level1.data : null;
  const level3 = level2 && isObject(level2.data) ? level2.data : null;

  if (level3 && isObject(level3.user)) {
    return level3;
  }

  if (level2 && isObject(level2.user)) {
    return level2;
  }

  if (isObject(level1.user)) {
    return level1;
  }

  return level3 ?? level2 ?? level1;
}

function normalizeMePayload(payload: unknown): Omit<TrpcUser, "token"> | null {
  const root = unwrapMePayload(payload);
  if (!root) {
    return null;
  }

  const rawUser = isObject(root.user) ? root.user : root;
  const rawPerson = isObject(rawUser.person) ? rawUser.person : null;
  const rawOrganization = isObject(root.organization) ? root.organization : null;

  const id = toOptionalString(rawUser.id);
  const organizationId =
    toOptionalString(rawUser.organizationId) ||
    toOptionalString(rawUser.orgId) ||
    toOptionalString(rawOrganization?.id);

  const role =
    toOptionalString(rawUser.role) || toOptionalString(rawPerson?.role);

  const email =
    toOptionalString(rawUser.email) || toOptionalString(rawPerson?.email);

  const name =
    toOptionalString(rawUser.name) || toOptionalString(rawPerson?.name);

  if (!id && !organizationId && !role && !email && !name) {
    return null;
  }

  return {
    id,
    organizationId,
    role,
    email,
    name,
  };
}

export async function fetchNexoMe(req: any) {
  const token = getNexoTokenFromReq(req);
  if (!token) return null;

  const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3000";
  const timeoutMs = Number(process.env.NEXO_ME_TIMEOUT_MS || 3500);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${NEXO_API_URL}/me`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();

    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[trpc/context] fetchNexoMe failed", {
          url: `${NEXO_API_URL}/me`,
          status: response.status,
          body,
        });
      }
      return null;
    }

    const normalized = normalizeMePayload(body);
    if (!normalized) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[trpc/context] fetchNexoMe normalize failed", {
          body,
        });
      }
      return null;
    }

    return {
      token,
      ...normalized,
    } satisfies TrpcUser;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[trpc/context] fetchNexoMe exception", {
        url: `${NEXO_API_URL}/me`,
        error,
      });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const token = getNexoTokenFromReq(opts.req);

  if (!token) {
    return {
      req: opts.req,
      res: opts.res,
      user: null,
    };
  }

  const me = await fetchNexoMe(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user: me ?? null,
  };
}
