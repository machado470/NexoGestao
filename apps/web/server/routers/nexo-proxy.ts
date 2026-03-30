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

type GlobalSearchResult = {
  id: string;
  type: "customer" | "appointment" | "serviceOrder" | "charge";
  title: string;
  subtitle?: string;
  route: string;
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
  const nested = payload?.data && typeof payload.data === "object" ? payload.data : null;

  const rawData = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(nested?.data)
      ? nested.data
      : Array.isArray(payload)
        ? payload
        : [];

  const rawPagination =
    nested?.pagination && typeof nested.pagination === "object"
      ? nested.pagination
      : payload?.pagination && typeof payload.pagination === "object"
        ? payload.pagination
        : null;

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

function normalizeArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function includesTerm(value: unknown, searchTerm: string) {
  return String(value ?? "").toLowerCase().includes(searchTerm);
}

function formatCurrencyFromCharge(charge: any) {
  const cents = Number(charge?.amountCents ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
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

async function searchCustomers(
  ctx: CtxLike,
  searchTerm: string,
  limit: number,
  seen: Set<string>
): Promise<GlobalSearchResult[]> {
  const payload = await authedGet(ctx, "/customers");
  const list = normalizeArrayPayload(payload);
  const results: GlobalSearchResult[] = [];

  list.forEach((customer: any) => {
    const matches =
      includesTerm(customer?.name, searchTerm) ||
      includesTerm(customer?.email, searchTerm) ||
      includesTerm(customer?.phone, searchTerm) ||
      includesTerm(customer?.notes, searchTerm);

    if (!matches) return;

    const id = String(customer?.id ?? "").trim();
    if (!id) return;

    const key = `customer-${id}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      id,
      type: "customer",
      title: customer?.name || "Cliente",
      subtitle: customer?.email || customer?.phone || "Cliente",
      route: `/customers?customerId=${id}`,
    });
  });

  return results.slice(0, limit);
}

async function searchAppointments(
  ctx: CtxLike,
  searchTerm: string,
  limit: number,
  seen: Set<string>
): Promise<GlobalSearchResult[]> {
  const payload = await authedGet(ctx, "/appointments");
  const list = normalizeArrayPayload(payload);
  const results: GlobalSearchResult[] = [];

  list.forEach((appointment: any) => {
    const matches =
      includesTerm(appointment?.customer?.name, searchTerm) ||
      includesTerm(appointment?.customer?.phone, searchTerm) ||
      includesTerm(appointment?.notes, searchTerm) ||
      includesTerm(appointment?.status, searchTerm);

    if (!matches) return;

    const id = String(appointment?.id ?? "").trim();
    if (!id) return;

    const key = `appointment-${id}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      id,
      type: "appointment",
      title: appointment?.customer?.name || "Agendamento",
      subtitle: appointment?.startsAt
        ? new Date(appointment.startsAt).toLocaleDateString("pt-BR")
        : appointment?.status || "Sem data",
      route: `/appointments?appointmentId=${id}`,
    });
  });

  return results.slice(0, limit);
}

async function searchServiceOrders(
  ctx: CtxLike,
  searchTerm: string,
  limit: number,
  seen: Set<string>
): Promise<GlobalSearchResult[]> {
  const payload = await authedGet(ctx, "/service-orders", {
    page: 1,
    limit: 100,
  });

  const list = normalizeArrayPayload(payload);
  const results: GlobalSearchResult[] = [];

  list.forEach((serviceOrder: any) => {
    const matches =
      includesTerm(serviceOrder?.title, searchTerm) ||
      includesTerm(serviceOrder?.status, searchTerm) ||
      includesTerm(serviceOrder?.customer?.name, searchTerm) ||
      includesTerm(serviceOrder?.notes, searchTerm);

    if (!matches) return;

    const id = String(serviceOrder?.id ?? "").trim();
    if (!id) return;

    const key = `serviceOrder-${id}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      id,
      type: "serviceOrder",
      title: serviceOrder?.title || "Ordem de serviço",
      subtitle:
        serviceOrder?.customer?.name ||
        serviceOrder?.status ||
        "Sem status",
      route: `/service-orders?os=${id}`,
    });
  });

  return results.slice(0, limit);
}

async function searchCharges(
  ctx: CtxLike,
  searchTerm: string,
  limit: number,
  seen: Set<string>
): Promise<GlobalSearchResult[]> {
  const payload = await authedGet(ctx, "/finance/charges", {
    page: 1,
    limit: 100,
  });

  const list = normalizeArrayPayload(payload);
  const results: GlobalSearchResult[] = [];

  list.forEach((charge: any) => {
    const matches =
      includesTerm(charge?.notes, searchTerm) ||
      includesTerm(charge?.status, searchTerm) ||
      includesTerm(charge?.customer?.name, searchTerm) ||
      includesTerm(charge?.customer?.phone, searchTerm) ||
      includesTerm(charge?.serviceOrder?.title, searchTerm) ||
      includesTerm(charge?.id, searchTerm);

    if (!matches) return;

    const id = String(charge?.id ?? "").trim();
    if (!id) return;

    const key = `charge-${id}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      id,
      type: "charge",
      title:
        charge?.serviceOrder?.title ||
        charge?.customer?.name ||
        "Cobrança",
      subtitle: `${formatCurrencyFromCharge(charge)} • ${
        charge?.status || "Sem status"
      }`,
      route: `/finances?chargeId=${id}`,
    });
  });

  return results.slice(0, limit);
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

  globalSearch: router({
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().trim().min(2),
          limit: z.number().int().min(1).max(20).optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const searchTerm = input.query.trim().toLowerCase();
        const limit = input.limit ?? 8;
        const seen = new Set<string>();

        const [customers, appointments, serviceOrders, charges] =
          await Promise.all([
            searchCustomers(ctx as CtxLike, searchTerm, limit, seen),
            searchAppointments(ctx as CtxLike, searchTerm, limit, seen),
            searchServiceOrders(ctx as CtxLike, searchTerm, limit, seen),
            searchCharges(ctx as CtxLike, searchTerm, limit, seen),
          ]);

        return [...customers, ...appointments, ...serviceOrders, ...charges].slice(
          0,
          limit
        );
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

    listByServiceOrder: protectedProcedure
      .input(
        z.object({
          serviceOrderId: z.string().min(1),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        return authedGet(
          ctx as CtxLike,
          `/timeline/service-orders/${input.serviceOrderId}`,
          {
            limit: input.limit,
          }
        );
      }),
  }),

  executions: router({
    listByServiceOrder: protectedProcedure
      .input(
        z.object({
          serviceOrderId: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) => {
        return authedGet(
          ctx as CtxLike,
          `/executions/service-order/${input.serviceOrderId}`
        );
      }),

    start: protectedProcedure
      .input(
        z.object({
          serviceOrderId: z.string().min(1),
          notes: z.string().optional(),
          checklist: z.any().optional(),
          attachments: z.any().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return authedPost(ctx as CtxLike, "/executions/start", input);
      }),

    complete: protectedProcedure
      .input(
        z.object({
          id: z.string().min(1),
          notes: z.string().optional(),
          checklist: z.any().optional(),
          attachments: z.any().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return authedPost(
          ctx as CtxLike,
          `/executions/${input.id}/complete`,
          {
            notes: input.notes,
            checklist: input.checklist,
            attachments: input.attachments,
          }
        );
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

