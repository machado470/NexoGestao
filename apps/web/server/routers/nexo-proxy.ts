import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

type CtxLike = {
  req: { headers: Record<string, any> };
  res: any;
};

function getTokenFromCookie(ctx: CtxLike): string | null {
  const raw = ctx?.req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;
  const parsed = cookie.parse(raw);
  return parsed?.[NEXO_TOKEN_COOKIE] || null;
}

function getAuthHeader(ctx: CtxLike): string | null {
  const h = ctx?.req?.headers?.authorization;
  if (typeof h === "string" && h.trim().length > 0) return h;
  const token = getTokenFromCookie(ctx);
  return token ? `Bearer ${token}` : null;
}

function setTokenCookie(ctx: CtxLike, token: string) {
  ctx.res.cookie(NEXO_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookie(ctx: CtxLike) {
  ctx.res.cookie(NEXO_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  return response.json();
}

const protectedProxy = publicProcedure.input(z.any().optional());

export const nexoProxyRouter = router({
  bootstrap: router({
    firstAdmin: publicProcedure
      .input(z.object({
        orgName: z.string(),
        adminName: z.string(),
        email: z.string().email(),
        password: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        return await nexoFetch("/bootstrap/first-admin", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),
  }),

  auth: router({
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const result = await nexoFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify(input),
        });
        const token = result?.data?.token;
        if (token) setTokenCookie(ctx as any, token);
        return result;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      clearTokenCookie(ctx as any);
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
      .input(z.object({ token: z.string(), password: z.string() }))
      .mutation(async ({ input }) => {
        return await nexoFetch("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),
    me: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      if (!authHeader) throw new Error("Não autenticado");
      return await nexoFetch("/me", { headers: { Authorization: authHeader } });
    }),
  }),

  customers: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/customers", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/customers/${input.id}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/customers", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
    update: publicProcedure.input(z.object({ id: z.string(), data: z.any() })).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/customers/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.data),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  appointments: router({
    list: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      const query = input ? "?" + new URLSearchParams(input).toString() : "";
      return await nexoFetch(`/appointments${query}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/appointments/${input.id}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/appointments", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
    update: publicProcedure.input(z.object({ id: z.string(), data: z.any() })).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/appointments/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.data),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  serviceOrders: router({
    list: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      const query = input ? "?" + new URLSearchParams(input).toString() : "";
      return await nexoFetch(`/service-orders${query}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/service-orders/${input.id}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/service-orders", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
    update: publicProcedure.input(z.object({ id: z.string(), data: z.any() })).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/service-orders/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.data),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  people: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/people", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/people/${input.id}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/people", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
    update: publicProcedure.input(z.object({ id: z.string(), data: z.any() })).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/people/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.data),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  finance: router({
    overview: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/finance/overview", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    charges: router({
      list: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        const query = input ? "?" + new URLSearchParams(input).toString() : "";
        return await nexoFetch(`/finance/charges${query}`, { headers: authHeader ? { Authorization: authHeader } : {} });
      }),
      stats: publicProcedure.query(async ({ ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        return await nexoFetch("/finance/charges/stats", { headers: authHeader ? { Authorization: authHeader } : {} });
      }),
      revenueByMonth: publicProcedure.query(async ({ ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        return await nexoFetch("/finance/charges/revenue-by-month", { headers: authHeader ? { Authorization: authHeader } : {} });
      }),
      create: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        return await nexoFetch("/finance/charges", {
          method: "POST",
          body: JSON.stringify(input),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
      update: publicProcedure.input(z.object({ id: z.string(), data: z.any() })).mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        return await nexoFetch(`/finance/charges/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify(input.data),
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
      delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
        const authHeader = getAuthHeader(ctx as any);
        return await nexoFetch(`/finance/charges/${input.id}`, {
          method: "DELETE",
          headers: authHeader ? { Authorization: authHeader } : {},
        });
      }),
    }),
  }),

  governance: router({
    summary: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/governance/summary", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    runs: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      const query = input ? "?" + new URLSearchParams(input).toString() : "";
      return await nexoFetch(`/governance/runs${query}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    autoScore: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/governance/auto-score", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
  }),

  dashboard: router({
    metrics: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/dashboard/metrics", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    revenue: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/dashboard/revenue", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    growth: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/dashboard/growth", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    serviceOrdersStatus: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/dashboard/service-orders-status", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    chargesStatus: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/dashboard/charges-status", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
  }),

  reports: router({
    executive: publicProcedure.query(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/reports/executive-report", { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    metrics: publicProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      const query = input ? "?" + new URLSearchParams(input).toString() : "";
      return await nexoFetch(`/reports/metrics${query}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
  }),

  whatsapp: router({
    messages: publicProcedure.input(z.object({ customerId: z.string() })).query(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/whatsapp/messages/${input.customerId}`, { headers: authHeader ? { Authorization: authHeader } : {} });
    }),
    send: publicProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/whatsapp/messages", {
        method: "POST",
        body: JSON.stringify(input),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
    updateStatus: publicProcedure.input(z.object({ id: z.string(), status: z.string() })).mutation(async ({ input, ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch(`/whatsapp/messages/${input.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status }),
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),

  onboarding: router({
    complete: publicProcedure.mutation(async ({ ctx }) => {
      const authHeader = getAuthHeader(ctx as any);
      return await nexoFetch("/onboarding/complete", {
        method: "POST",
        headers: authHeader ? { Authorization: authHeader } : {},
      });
    }),
  }),
});
