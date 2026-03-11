import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

const zId = z.preprocess((v) => (v === undefined || v === null ? v : String(v)), z.string().min(1));

export const expensesRouter = router({
  /**
   * Criar despesa
   * Nest: POST /expenses
   */
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
      return await nexoFetch(ctx.req, `/expenses`, {
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

  /**
   * Listar despesas com paginação
   * Nest: GET /expenses?page=&limit=
   */
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().default(10),
        category: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const params = new URLSearchParams({
        page: String(input.page),
        limit: String(input.limit),
      });
      if (input.category) params.set("category", input.category);

      const out = await nexoFetch(ctx.req, `/expenses?${params.toString()}`, { method: "GET" });

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

  /**
   * Resumo de despesas
   * Nest: GET /expenses/summary (mais eficiente que carregar tudo)
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    try {
      const out = await nexoFetch(ctx.req, `/expenses/summary`, { method: "GET" });
      return out?.data ?? out;
    } catch {
      // Fallback: calcula localmente se endpoint não existir no backend
      const out = await nexoFetch(ctx.req, `/expenses?page=1&limit=1000`, { method: "GET" });
      const rows = Array.isArray(out) ? out : Array.isArray(out?.data) ? out.data : [];
      const totalExpenses = rows.reduce((acc: number, item: any) => acc + Number(item?.amount ?? 0), 0);
      return { totalExpenses, count: rows.length };
    }
  }),

  /**
   * Buscar despesa por ID
   * Nest: GET /expenses/:id
   */
  getById: protectedProcedure
    .input(z.object({ id: zId }))
    .query(async ({ input, ctx }) => {
      return await nexoFetch(ctx.req, `/expenses/${input.id}`, { method: "GET" });
    }),

  /**
   * Atualizar despesa
   * Nest: PATCH /expenses/:id
   */
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
      return await nexoFetch(ctx.req, `/expenses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? data.dueDate.toISOString() : undefined,
          paidAt: data.paidAt ? data.paidAt.toISOString() : undefined,
        }),
      });
    }),

  /**
   * Deletar despesa
   * Nest: DELETE /expenses/:id
   */
  delete: protectedProcedure
    .input(z.object({ id: zId }))
    .mutation(async ({ input, ctx }) => {
      return await nexoFetch(ctx.req, `/expenses/${input.id}`, { method: "DELETE" });
    }),
});
