import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import cookie from "cookie";

const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3000";
const NEXO_TOKEN_COOKIE = "nexo_token";

const zId = z.preprocess((v) => (v === undefined || v === null ? v : String(v)), z.string().min(1));

function getNexoTokenFromReq(req: any): string | null {
  const raw = req?.headers?.cookie;
  if (!raw || typeof raw !== "string") return null;
  const parsed = cookie.parse(raw);
  return parsed?.[NEXO_TOKEN_COOKIE] || null;
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

export const expensesRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1, "Descrição é obrigatória"),
        amount: z.number().positive("Valor deve ser > 0"),
        category: z.string().optional(),
        dueDate: z.date().optional(),
        paidAt: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await nexoFetch(ctx, `/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description: input.description,
          amount: input.amount,
          category: input.category,
          dueDate: input.dueDate ? input.dueDate.toISOString() : undefined,
          paidAt: input.paidAt ? input.paidAt.toISOString() : undefined,
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
      const out = await nexoFetch(ctx, `/expenses?page=${input.page}&limit=${input.limit}`, {
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
      return await nexoFetch(ctx, `/expenses/${input.id}`, { method: "GET" });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: zId,
        description: z.string().min(1).optional(),
        amount: z.number().positive().optional(),
        category: z.string().optional(),
        dueDate: z.date().optional(),
        paidAt: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return await nexoFetch(ctx, `/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? data.dueDate.toISOString() : undefined,
          paidAt: data.paidAt ? data.paidAt.toISOString() : undefined,
        }),
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ input, ctx }) => {
      return await nexoFetch(ctx, `/expenses/${input.id}`, { method: "DELETE" });
    }),
});
