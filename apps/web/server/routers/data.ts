import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

/**
 * Aceita number/string e normaliza em string (pra não morrer quando o backend for UUID).
 */
const zId = z.preprocess((v) => (v === undefined || v === null ? v : String(v)), z.string().min(1));

function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;
  const parsed = cookie.parse(raw);
  const token = parsed?.[NEXO_TOKEN_COOKIE];
  return token || null;
}

async function nexoFetch(ctx: any, path: string, init?: RequestInit) {
  const token = getNexoTokenFromReq(ctx?.req);
  if (!token) throw new Error("Sem sessão Nexo (cookie nexo_token não encontrado). Faça login novamente.");

  const res = await fetch(`${NEXO_API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || json?.raw || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return json;
}

function toISO(d: Date | undefined) {
  return d ? d.toISOString() : undefined;
}

export const dataRouter = router({
  // ===== Customers =====
  customers: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Nome é obrigatório"),
          email: z.string().email().optional(),
          phone: z.string().min(1, "Telefone é obrigatório"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/customers`, {
          method: "POST",
          body: JSON.stringify({
            name: input.name,
            email: input.email,
            phone: input.phone,
            notes: input.notes,
            active: true,
          }),
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        // Se o backend suportar paginação: ótimo. Se não, ele devolve array e a gente pagina aqui.
        const out = await nexoFetch(ctx, `/customers?page=${input.page}&limit=${input.limit}`, {
          method: "GET",
        });

        if (Array.isArray(out)) {
          const total = out.length;
          const offset = (input.page - 1) * input.limit;
          const data = out.slice(offset, offset + input.limit);
          return {
            data,
            pagination: {
              page: input.page,
              limit: input.limit,
              total,
              pages: Math.ceil(total / input.limit),
            },
          };
        }

        return out; // esperado: { data, pagination }
      }),

    getById: protectedProcedure
      .input(z.object({ id: zId }))
      .query(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/customers/${input.id}`, { method: "GET" });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: zId,
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          notes: z.string().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return await nexoFetch(ctx, `/customers/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/customers/${input.id}`, { method: "DELETE" });
      }),
  }),

  // ===== Appointments =====
  appointments: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: zId,
          title: z.string().min(1, "Título é obrigatório"),
          description: z.string().optional(),
          startsAt: z.date(),
          endsAt: z.date().optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).default("SCHEDULED"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/appointments`, {
          method: "POST",
          body: JSON.stringify({
            customerId: input.customerId,
            title: input.title,
            description: input.description,
            startsAt: toISO(input.startsAt),
            endsAt: toISO(input.endsAt),
            status: input.status,
            notes: input.notes,
          }),
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        const out = await nexoFetch(ctx, `/appointments?page=${input.page}&limit=${input.limit}`, {
          method: "GET",
        });

        if (Array.isArray(out)) {
          const total = out.length;
          const offset = (input.page - 1) * input.limit;
          const data = out.slice(offset, offset + input.limit);
          return {
            data,
            pagination: {
              page: input.page,
              limit: input.limit,
              total,
              pages: Math.ceil(total / input.limit),
            },
          };
        }

        return out;
      }),

    getById: protectedProcedure
      .input(z.object({ id: zId }))
      .query(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/appointments/${input.id}`, { method: "GET" });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: zId,
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          startsAt: z.date().optional(),
          endsAt: z.date().optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return await nexoFetch(ctx, `/appointments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...data,
            startsAt: data.startsAt ? toISO(data.startsAt) : undefined,
            endsAt: data.endsAt ? toISO(data.endsAt) : undefined,
          }),
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/appointments/${input.id}`, { method: "DELETE" });
      }),
  }),

  // ===== Service Orders =====
  serviceOrders: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: zId,
          title: z.string().min(1, "Título é obrigatório"),
          description: z.string().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
          status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).default("OPEN"),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/service-orders`, {
          method: "POST",
          body: JSON.stringify({
            customerId: input.customerId,
            title: input.title,
            description: input.description,
            priority: input.priority,
            status: input.status,
            assignedTo: input.assignedTo,
            notes: input.notes,
          }),
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        const out = await nexoFetch(ctx, `/service-orders?page=${input.page}&limit=${input.limit}`, {
          method: "GET",
        });

        if (Array.isArray(out)) {
          const total = out.length;
          const offset = (input.page - 1) * input.limit;
          const data = out.slice(offset, offset + input.limit);
          return {
            data,
            pagination: {
              page: input.page,
              limit: input.limit,
              total,
              pages: Math.ceil(total / input.limit),
            },
          };
        }

        return out;
      }),

    getById: protectedProcedure
      .input(z.object({ id: zId }))
      .query(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/service-orders/${input.id}`, { method: "GET" });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: zId,
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
          status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).optional(),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return await nexoFetch(ctx, `/service-orders/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: zId }))
      .mutation(async ({ input, ctx }) => {
        return await nexoFetch(ctx, `/service-orders/${input.id}`, { method: "DELETE" });
      }),
  }),
});
