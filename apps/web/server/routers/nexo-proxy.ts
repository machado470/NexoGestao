import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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

function getAuthHeader(ctx: CtxLike & { user?: { token?: string } | null }): string {
  const userToken = ctx?.user?.token;
  if (typeof userToken === "string" && userToken.trim()) {
    return `Bearer ${userToken.trim()}`;
  }

  const header = ctx?.req?.headers?.authorization;

  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }

  const cookieToken =
    typeof ctx?.req?.cookies?.[NEXO_TOKEN_COOKIE] === "string"
      ? ctx.req.cookies[NEXO_TOKEN_COOKIE].trim()
      : "";

  const token = cookieToken || getTokenFromCookie(ctx);

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autenticado" });
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
    result?.data?.data?.token ||
    result?.data?.token ||
    result?.token ||
    result?.accessToken ||
    result?.data?.accessToken ||
    null
  );
}

function toQueryString(input?: Record<string, unknown> | null): string {
  if (!input || typeof input !== "object") return "";

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      Number.isNaN(value)
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          params.append(key, String(item));
        }
      }
      continue;
    }

    params.append(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function nexoFetch(path: string, options: RequestInit = {}) {
  const url = `${NEXO_API_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
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

    const normalizedMessage = String(message);

    if (response.status === 401) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: normalizedMessage });
    }

    if (response.status === 403) {
      throw new TRPCError({ code: "FORBIDDEN", message: normalizedMessage });
    }

    if (response.status === 404) {
      throw new TRPCError({ code: "NOT_FOUND", message: normalizedMessage });
    }

    if (response.status === 400) {
      throw new TRPCError({ code: "BAD_REQUEST", message: normalizedMessage });
    }

    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: normalizedMessage });
  }

  return body;
}

async function authedFetch(
  ctx: CtxLike,
  path: string,
  options: RequestInit = {}
) {
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
  query?: Record<string, unknown>
) {
  return authedFetch(ctx, `${path}${toQueryString(query)}`);
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

const anyInput = z.any().optional();

const customerCreateInput = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

const customerUpdateInput = customerCreateInput
  .partial()
  .extend({
    id: z.string().min(1),
    active: z.boolean().optional(),
  });

const appointmentCreateInput = z.object({
  customerId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
});

const appointmentUpdateInput = z.object({
  id: z.string().min(1),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
});

const serviceOrderCreateInput = z.object({
  customerId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  scheduledFor: z.string().optional(),
  appointmentId: z.string().optional(),
  assignedToPersonId: z.string().optional(),
  amountCents: z.number().int().min(1).optional(),
  dueDate: z.string().optional(),
});

const serviceOrderUpdateInput = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  scheduledFor: z.string().optional(),
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).optional(),
  assignedToPersonId: z.string().nullable().optional(),
  amountCents: z.number().int().min(1).optional(),
  dueDate: z.string().optional(),
  cancellationReason: z.string().optional(),
  outcomeSummary: z.string().optional(),
});

const whatsappSendInput = z.object({
  customerId: z.string().min(1),
  content: z.string().min(1),
  toPhone: z.string().optional(),
  receiverNumber: z.string().optional(),
  entityType: z.enum(["CUSTOMER", "APPOINTMENT", "SERVICE_ORDER", "CHARGE"]).optional(),
  entityId: z.string().optional(),
  messageType: z
    .enum([
      "APPOINTMENT_CONFIRMATION",
      "SERVICE_UPDATE",
      "PAYMENT_REMINDER",
      "PAYMENT_CONFIRMATION",
      "EXECUTION_CONFIRMATION",
      "CUSTOMER_NOTIFICATION",
    ])
    .optional(),
  chargeId: z.string().optional(),
  serviceOrderId: z.string().optional(),
});

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

    forgotPassword: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
        })
      )
      .mutation(async ({ input }) => {
        return nexoFetch("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify(input),
        });
      }),

    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string(),
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

  me: protectedProcedure.query(async ({ ctx }) => {
    return authedGet(ctx as CtxLike, "/me");
  }),

  customers: router({
    list: protectedProcedure.input(anyInput).query(async ({ ctx, input }) => {
      return authedGet(ctx as CtxLike, "/customers", input);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/customers/${input.id}`);
      }),

    workspace: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/customers/${input.id}/workspace`);
      }),

    create: protectedProcedure.input(customerCreateInput).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/customers", input);
    }),

    update: protectedProcedure.input(customerUpdateInput).mutation(async ({ ctx, input }) => {
      const id = input?.id;
      if (!id || typeof id !== "string") {
        throw new Error("ID do cliente é obrigatório.");
      }

      const { id: _id, ...payload } = input ?? {};
      return authedPatch(ctx as CtxLike, `/customers/${id}`, payload);
    }),
  }),

  appointments: router({
    list: protectedProcedure.input(anyInput).query(async ({ ctx, input }) => {
      return authedGet(ctx as CtxLike, "/appointments", input);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/appointments/${input.id}`);
      }),

    create: protectedProcedure.input(appointmentCreateInput).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/appointments", input);
    }),

    update: protectedProcedure.input(appointmentUpdateInput).mutation(async ({ ctx, input }) => {
      const id = input?.id;
      if (!id || typeof id !== "string") {
        throw new Error("ID do agendamento é obrigatório.");
      }

      const { id: _id, ...payload } = input ?? {};
      return authedPatch(ctx as CtxLike, `/appointments/${id}`, payload);
    }),
  }),

  serviceOrders: router({
    list: protectedProcedure.input(anyInput).query(async ({ ctx, input }) => {
      return authedGet(ctx as CtxLike, "/service-orders", input);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/service-orders/${input.id}`);
      }),

    create: protectedProcedure.input(serviceOrderCreateInput).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/service-orders", input);
    }),

    update: protectedProcedure.input(serviceOrderUpdateInput).mutation(async ({ ctx, input }) => {
      const id = input?.id;
      if (!id || typeof id !== "string") {
        throw new Error("ID da ordem de serviço é obrigatório.");
      }

      const { id: _id, ...payload } = input ?? {};
      return authedPatch(ctx as CtxLike, `/service-orders/${id}`, payload);
    }),

    generateCharge: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return authedPost(
          ctx as CtxLike,
          `/service-orders/${input.id}/generate-charge`
        );
      }),
  }),

  timeline: router({
    listByOrg: protectedProcedure
      .input(z.object({ limit: z.number().optional(), action: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/timeline`, input ?? {});
      }),

    listByCustomer: protectedProcedure
      .input(z.object({ customerId: z.string(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { customerId, ...query } = input;
        return authedGet(
          ctx as CtxLike,
          `/timeline/customers/${customerId}`,
          query
        );
      }),

    listByServiceOrder: protectedProcedure
      .input(z.object({ serviceOrderId: z.string(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { serviceOrderId, ...query } = input;
        return authedGet(
          ctx as CtxLike,
          `/timeline/service-orders/${serviceOrderId}`,
          query
        );
      }),
  }),

  executions: router({
    listByServiceOrder: protectedProcedure
      .input(z.object({ serviceOrderId: z.string(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { serviceOrderId, ...query } = input;
        return authedGet(
          ctx as CtxLike,
          `/executions/service-order/${serviceOrderId}`,
          query
        );
      }),

    start: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/executions/start", input);
    }),

    complete: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      const id = input?.id;
      if (!id || typeof id !== "string") {
        throw new Error("ID da execução é obrigatório.");
      }

      const { id: _id, ...payload } = input ?? {};
      return authedPost(ctx as CtxLike, `/executions/${id}/complete`, payload);
    }),
  }),

  whatsapp: router({
    messages: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(
          ctx as CtxLike,
          `/whatsapp/messages/${input.customerId}`
        );
      }),

    send: protectedProcedure.input(whatsappSendInput).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/whatsapp/messages", input);
    }),
  }),

  demo: router({
    bootstrapLive: protectedProcedure
      .input(z.object({}).optional())
      .mutation(async ({ ctx }) => {
        return authedPost(ctx as CtxLike, "/demo/bootstrap/live");
      }),
  }),

  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return authedGet(ctx as CtxLike, "/organization-settings");
    }),

    update: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      return authedPatch(ctx as CtxLike, "/organization-settings", input);
    }),
  }),

  onboarding: router({
    complete: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as CtxLike, "/onboarding/complete", input);
    }),
  }),

  globalSearch: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().optional(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const query = String(input?.query ?? "").trim();

        const [customers, serviceOrders] = await Promise.all([
          authedGet(ctx as CtxLike, "/customers", query ? { search: query } : {}),
          authedGet(
            ctx as CtxLike,
            "/service-orders",
            query ? { search: query } : {}
          ),
        ]);

        return {
          ok: true,
          data: {
            query,
            customers,
            serviceOrders,
          },
        };
      }),
  }),

  audit: router({
    listEvents: protectedProcedure
      .input(
        z.object({
          page: z.number().optional(),
          limit: z.number().optional(),
          entityType: z.string().optional(),
          entityId: z.string().optional(),
          action: z.string().optional(),
          actorPersonId: z.string().optional(),
          from: z.string().optional(),
          to: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, "/audit/events", input);
      }),

    getSummary: protectedProcedure
      .input(
        z.object({
          from: z.string().optional(),
          to: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, "/audit/summary", input);
      }),
  }),

  risk: router({
    explainPerson: protectedProcedure
      .input(z.object({ personId: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as CtxLike, `/risk/explain/person/${input.personId}`);
      }),
  }),
});
