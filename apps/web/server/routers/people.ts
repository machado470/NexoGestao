import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

export const peopleRouter = router({
  /**
   * Listar pessoas ativas da organização
   * Nest: GET /people
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/people`, { method: "GET" });
    // Nest retorna array direto ou { ok, data: [] }
    return Array.isArray(raw) ? raw : (raw?.data ?? raw ?? []);
  }),

  /**
   * Buscar pessoa por ID
   * Nest: GET /people/:id
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/people/${input.id}`, { method: "GET" });
      return raw?.data ?? raw;
    }),

  /**
   * Criar pessoa
   * Nest: POST /people
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        role: z.string().min(1, "Cargo é obrigatório"),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/people`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      return raw?.data ?? raw;
    }),

  /**
   * Atualizar pessoa
   * Nest: PATCH /people/:id
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        role: z.string().optional(),
        email: z.string().email().optional(),
        active: z.boolean().optional(),
        expectedUpdatedAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const raw = await nexoFetch<any>(ctx.req, `/people/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return raw?.data ?? raw;
    }),

  /**
   * Métricas de pessoas vinculadas
   * Nest: GET /people/stats/linked
   */
  statsLinked: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, `/people/stats/linked`, { method: "GET" });
    return raw?.data ?? raw;
  }),

  /**
   * Desativar pessoa (soft delete)
   * Nest: DELETE /people/:id
   * Regra de negócio: bloqueia se houver OS ativa vinculada à pessoa.
   */
  deactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx.req, `/people/${input.id}`, {
        method: "DELETE",
      });
      return raw?.data ?? raw;
    }),
});
