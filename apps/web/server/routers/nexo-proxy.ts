import { publicProcedure, router } from "../_core/trpc";
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
  return parsed?.[NEXO_TOKEN_COOKIE] || null;
}

function getAuthHeader(ctx: CtxLike): string | null {
  const header = ctx?.req?.headers?.authorization;
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  const token = getTokenFromCookie(ctx);
  return token ? `Bearer ${token}` : null;
}

function setTokenCookie(ctx: CtxLike, token: string) {
  const cookieOptions = getSessionCookieOptions(ctx.req);

  ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookie(ctx: CtxLike) {
  const cookieOptions = getSessionCookieOptions(ctx.req);

  ctx.res.cookie(NEXO_TOKEN_COOKIE, "", {
    ...cookieOptions,
    maxAge: 0,
  });
}

function extractErrorMessage(body: any, status: number, text: string): string {
  const message =
    body?.message ||
    body?.error ||
    body?.data?.message ||
    text ||
    `API error: ${status}`;

  const normalized = String(message).trim();

  if (status === 401) {
    return normalized || "Não autenticado";
  }

  if (status === 403) {
    return normalized || "Sem permissão";
  }

  return normalized;
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
    const message = extractErrorMessage(body, response.status, text);
    throw new Error(message);
  }

  return body;
}

export const nexoProxyRouter = router({
  bootstrap: router({
    firstAdmin: publicProcedure
      .input(
        z.object({
          orgName: z.string(),
          adminName: z.string(),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        return await nexoFetch("/bootstrap/first-admin", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),
  }),

  auth: router({
    register: publicProcedure
      .input(
        z.object({
          orgName: z.string().min(1),
          adminName: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await nexoFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify(input),
        });

        const token =
          result?.data?.token ||
          result?.token ||
          result?.accessToken ||
          result?.data?.accessToken;

        if (!token) {
          throw new Error("Cadastro não retornou token.");
        }

        setTokenCookie(ctx as CtxLike, token);
        return result;
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const result = await nexoFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });

        const token =
          result?.data?.token ||
          result?.token ||
          result?.accessToken ||
          result?.data?.accessToken;

        if (!token) {
          throw new Error("Login não retornou token.");
        }

        setTokenCookie(ctx as CtxLike, token);
        return result;
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      clearTokenCookie(ctx as CtxLike);
      return { ok: true };
    }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        return await nexoFetch("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(1), password: z.string().min(8) }))
      .mutation(async ({ input }) => {
        return await nexoFetch("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),

    me: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);

      if (!authHeader) {
        return null;
      }

      try {
        return await nexoFetch("/me", {
          headers: { Authorization: authHeader },
        });
      } catch (error) {
        const message =
          typeof (error as any)?.message === "string"
            ? (error as any).message.toLowerCase()
            : "";

        if (
          message.includes("não autenticado") ||
          message.includes("unauthorized") ||
          message.includes("jwt") ||
          message.includes("token")
        ) {
          clearTokenCookie(ctx as CtxLike);
          return null;
        }

        throw error;
      }
    }),
  }),

  customers: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/customers", {
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/customers/${input.id}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    workspace: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/customers/${input.id}/workspace`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/customers", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    update: publicProcedure
      .input(z.object({ id: z.string(), data: z.any() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/customers/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(input.data),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
  }),

  timeline: router({
    listByCustomer: publicProcedure
      .input(z.object({ customerId: z.string(), limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        const query = input.limit ? `?limit=${input.limit}` : "";

        return await nexoFetch(`/timeline/customers/${input.customerId}${query}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
  }),

  appointments: router({
    list: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      const query = input ? `?${new URLSearchParams(input).toString()}` : "";

      return await nexoFetch(`/appointments${query}`, {
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/appointments/${input.id}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/appointments", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    update: publicProcedure
      .input(z.object({ id: z.string(), data: z.any() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/appointments/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(input.data),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/appointments/${input.id}`, {
          method: "DELETE",
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
  }),

  serviceOrders: router({
    list: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      const query = input ? `?${new URLSearchParams(input).toString()}` : "";

      return await nexoFetch(`/service-orders${query}`, {
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/service-orders/${input.id}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/service-orders", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    update: publicProcedure
      .input(z.object({ id: z.string(), data: z.any() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/service-orders/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(input.data),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/service-orders/${input.id}`, {
          method: "DELETE",
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
  }),

  whatsapp: router({
    messages: publicProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/whatsapp/messages/${input.customerId}`, {
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),

    send: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/whatsapp/messages", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    updateStatus: publicProcedure
      .input(z.object({ id: z.string(), status: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as CtxLike);
        return await nexoFetch(`/whatsapp/messages/${input.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: input.status }),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
  }),

  onboarding: router({
    complete: publicProcedure.mutation(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/onboarding/complete", {
        method: "POST",
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  settings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/organization-settings", {
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),

    update: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as CtxLike);
      return await nexoFetch("/organization-settings", {
        method: "PATCH",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),
});
