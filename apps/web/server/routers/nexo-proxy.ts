import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import cookie from "cookie";
import { getSessionCookieOptions } from "../_core/cookies";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://127.0.0.1:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

type CtxLike = {
  req: any;
  res: any;
};

function getTokenFromCookie(ctx: CtxLike): string | null {
  const raw = ctx?.req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;

  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

function getAuthHeader(ctx: CtxLike): string {
  const header = ctx?.req?.headers?.authorization;

  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  const token = getTokenFromCookie(ctx);

  if (!token) {
    throw new Error("Não autenticado");
  }

  return `Bearer ${token}`;
}

function setTokenCookie(ctx: CtxLike, token: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);

  ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// 🔥 CORREÇÃO AQUI
function extractToken(result: any): string | null {
  return (
    result?.data?.data?.token ||
    result?.data?.token ||
    result?.token ||
    result?.accessToken ||
    result?.data?.accessToken ||
    null
  );
}

async function nexoFetch(path: string, options: RequestInit = {}) {
  const url = `${NEXO_API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
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
    const message =
      body?.message ||
      body?.error ||
      body?.data?.message ||
      text ||
      `API error: ${response.status}`;

    throw new Error(String(message));
  }

  return body;
}

async function authedFetch(ctx: CtxLike, path: string, options: RequestInit = {}) {
  const authHeader = getAuthHeader(ctx);

  return nexoFetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: authHeader,
    },
  });
}

async function authedGet(ctx: CtxLike, path: string) {
  return authedFetch(ctx, path);
}

async function authedPost(ctx: CtxLike, path: string, body?: unknown) {
  return authedFetch(ctx, path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const nexoProxyRouter = router({
  auth: router({
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await nexoFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });

        const token = extractToken(result);

        if (!token) {
          throw new Error("Login não retornou token.");
        }

        setTokenCookie(ctx as CtxLike, token);

        return result;
      }),

    register: publicProcedure
      .input(
        z.object({
          orgName: z.string(),
          adminName: z.string(),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await nexoFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(input),
        });

        const token = extractToken(result);

        if (!token) {
          throw new Error("Cadastro não retornou token.");
        }

        setTokenCookie(ctx as CtxLike, token);

        return result;
      }),
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return authedGet(ctx as CtxLike, "/me");
  }),
});
