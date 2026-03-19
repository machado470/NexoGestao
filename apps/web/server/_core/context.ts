import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: any | null;
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
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

function extractUserFromMePayload(me: any) {
  return (
    me?.user ??
    me?.data?.user ??
    me?.data?.data?.user ??
    me?.result?.data?.json?.user ??
    me?.result?.data?.json?.data?.user ??
    me?.result?.data?.json?.data?.data?.user ??
    null
  );
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: any | null = null;

  try {
    const me = await fetchNexoMe(opts.req);
    user = extractUserFromMePayload(me);
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
