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

type ServiceOrderListResponse = {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

type GenerateChargeResponse = {
  created?: boolean;
  chargeId?: string;
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

function extractToken(result: any): string | null {
  return (
    result?.data?.token ||
    result?.token ||
    result?.accessToken ||
    result?.data?.accessToken ||
    null
  );
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

  if (status === 404) {
    return normalized || "Recurso não encontrado";
  }

  return normalized;
}

function buildQuery(input?: Record<string, unknown> | null): string {
  if (!input) return "";

  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

function normalizeServiceOrdersListResult(payload: any): ServiceOrderListResponse {
  const rawData = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];

  const rawPagination = payload?.pagination;

  return {
    data: rawData,
    pagination: {
      page: Number(rawPagination?.page ?? 1),
      limit: Number(rawPagination?.limit ?? rawData.length ?? 20),
      total: Number(rawPagination?.total ?? rawData.length ?? 0),
      pages: Number(rawPagination?.pages ?? 1),
    },
  };
}

function normalizeGenerateChargeResult(payload: any): GenerateChargeResponse {
  const source =
    payload && typeof payload === "object" && payload.data && typeof payload.data === "object"
      ? payload.data
      : payload;

  if (!source || typeof source !== "object") {
    return {};
  }

  return {
    created:
      typeof source.created === "boolean"
        ? source.created
        : undefined,
    chargeId:
      typeof source.chargeId === "string" && source.chargeId.trim().length > 0
        ? source.chargeId
        : undefined,
  };
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

async function authedGet(
  ctx: CtxLike,
  path: string,
  query?: Record<string, unknown> | null
) {
  return authedFetch(ctx, `${path}${buildQuery(query)}`);
}

async function authedPost(ctx: CtxLike, path: string, body?: unknown) {
  return authedFetch(ctx, path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function authedPatch(ctx: CtxLike, path: string, body?: unknown) {
  return authedFetch(ctx, path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function authedDelete(ctx: CtxLike, path: string) {
  return authedFetch(ctx, path, {
    method: "DELETE",
  });
}

const idInput = z.object({ id: z.string().min(1) });
const updateInput = z.object({
  id: z.string().min(1),
  data: z.any(),
});

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
        return nexoFetch("/bootstrap/first-admin", {
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

        const token = extractToken(result);

        if (!token) {
          throw new Error("Cadastro não retornou token.");
        }

        setTokenCookie(ctx as CtxLike, token);
        return result;
      }),

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

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        return nexoFetch("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),

    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string().min(1),
          password: z.string().min(8),
        })
      )
      .mutation(async ({ input }) => {
        return nexoFetch("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),
  }),

  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return authedGet(ctx as CtxLike, "/customers");
    }),

    getById: protectedProcedure.input(idInput).query(async ({ input, ctx }) => {
      return authedGet(ctx as CtxLike, `/customers/${input.id}`);
    }),

    workspace: protectedProcedure.input(idInput).query(async ({ input, ctx }) => {
      return authedGet(ctx as CtxLike, `/customers/${input.id}/workspace`);
    }),

    create: protectedProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      return authedPost(ctx as CtxLike, "/customers", input);
    }),

    update: protectedProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      return authedPatch(ctx as CtxLike, `/customers/${input.id}`, input.data);
    }),
  }),

  timeline: router({
    listByCustomer: protectedProcedure
      .input(
        z.object({
          customerId: z.string().min(1),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        return authedGet(ctx as CtxLike, `/timeline/customers/${input.customerId}`, {
          limit: input.limit,
        });
      }),
  }),

  appointments: router({
    list: protectedProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      return authedGet(ctx as CtxLike, "/appointments", input ?? undefined);
    }),

    getById: protectedProcedure.input(idInput).query(async ({ input, ctx }) => {
      return authedGet(ctx as CtxLike, `/appointments/${input.id}`);
    }),

    create: protectedProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      return authedPost(ctx as CtxLike, "/appointments", input);
    }),

    update: protectedProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      return authedPatch(ctx as CtxLike, `/appointments/${input.id}`, input.data);
    }),

    delete: protectedProcedure.input(idInput).mutation(async ({ input, ctx }) => {
      return authedDelete(ctx as CtxLike, `/appointments/${input.id}`);
    }),
  }),

  serviceOrders: router({
    list: protectedProcedure.input(z.any().optional()).query(async ({ input, ctx }) => {
      const result = await authedGet(
        ctx as CtxLike,
        "/service-orders",
        input ?? undefined
      );

      return normalizeServiceOrdersListResult(result);
    }),

    getById: protectedProcedure.input(idInput).query(async ({ input, ctx }) => {
      return authedGet(ctx as CtxLike, `/service-orders/${input.id}`);
    }),

    create: protectedProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      return authedPost(ctx as CtxLike, "/service-orders", input);
    }),

    update: protectedProcedure.input(updateInput).mutation(async ({ input, ctx }) => {
      return authedPatch(ctx as CtxLike, `/service-orders/${input.id}`, input.data);
    }),

    delete: protectedProcedure.input(idInput).mutation(async ({ input, ctx }) => {
      return authedDelete(ctx as CtxLike, `/service-orders/${input.id}`);
    }),

    generateCharge: protectedProcedure.input(idInput).mutation(async ({ input, ctx }) => {
      const result = await authedPost(
        ctx as CtxLike,
        `/service-orders/${input.id}/generate-charge`
      );

      return normalizeGenerateChargeResult(result);
    }),
  }),

  whatsapp: router({
    messages: protectedProcedure
      .input(z.object({ customerId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        return authedGet(ctx as CtxLike, `/whatsapp/messages/${input.customerId}`);
      }),

    send: protectedProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      return authedPost(ctx as CtxLike, "/whatsapp/messages", input);
    }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1),
          status: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return authedPatch(
          ctx as CtxLike,
          `/whatsapp/messages/${input.id}/status`,
          { status: input.status }
        );
      }),
  }),

  onboarding: router({
    complete: protectedProcedure.mutation(async ({ ctx }) => {
      return authedPost(ctx as CtxLike, "/onboarding/complete");
    }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return authedGet(ctx as CtxLike, "/organization-settings");
    }),

    update: protectedProcedure.input(z.any()).mutation(async ({ input, ctx }) => {
      return authedPatch(ctx as CtxLike, "/organization-settings", input);
    }),
  }),
});
