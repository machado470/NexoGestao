import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: any | null;
};

/**
 * Compat: alguns módulos antigos importam "Context" de ./context
 * Então a gente expõe um alias pra não quebrar.
 */
export type Context = TrpcContext;

export function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  if (!token) return null;

  return token;
}

export async function fetchNexoMe(req: any) {
  const token = getNexoTokenFromReq(req);
  if (!token) return null;

  const response = await fetch(`${NEXO_API_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;

  return response.json();
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: any | null = null;

  try {
    const me = await fetchNexoMe(opts.req);
    user = me?.data?.user ?? null;
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
