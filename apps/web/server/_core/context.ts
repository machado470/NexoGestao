import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import cookie from "cookie";

const NEXO_TOKEN_COOKIE = "nexo_token";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: {
    token: string;
  } | null;
};

export type Context = TrpcContext;

export function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];

  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

export async function fetchNexoMe(req: any) {
  const token = getNexoTokenFromReq(req);
  if (!token) return null;

  const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3000";

  try {
    const response = await fetch(`${NEXO_API_URL}/me`, {
      method: "GET",
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

    return body;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[trpc/context] fetchNexoMe exception", {
        url: `${NEXO_API_URL}/me`,
        error,
      });
    }
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const token = getNexoTokenFromReq(opts.req);

  return {
    req: opts.req,
    res: opts.res,
    user: token
      ? {
          token,
        }
      : null,
  };
}
