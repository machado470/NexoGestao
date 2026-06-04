import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";
import { unwrapNexoApiResponse } from "../_core/nexoEnvelope";

export const peopleRouter = router({
  /**
   * Listar pessoas ativas da organização
   * Nest: GET /people
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx, `/people`, { method: "GET" });
    // Nest retorna array direto ou { ok, data: [] }
    return Array.isArray(raw) ? raw : (unwrapNexoApiResponse(raw) ?? []);
  }),


  /**
   * Listar responsáveis para filtros operacionais de agenda.
   * Nest: GET /people/assignees
   */
  assignees: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx, `/people/assignees`, { method: "GET" });
    return Array.isArray(raw) ? raw : (unwrapNexoApiResponse(raw) ?? []);
  }),

  /**
   * Resumo operacional tenant-scoped da equipe
   * Nest: GET /people/operational-summary
   */
  operationalSummary: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx, `/people/operational-summary`, { method: "GET" });
    return unwrapNexoApiResponse(raw);
  }),

  /**
   * Buscar pessoa por ID
   * Nest: GET /people/:id
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx, `/people/${input.id}`, { method: "GET" });
      return unwrapNexoApiResponse(raw);
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
      const raw = await nexoFetch<any>(ctx, `/people`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      return unwrapNexoApiResponse(raw);
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
        dailyServiceOrderCapacity: z.number().int().min(1).max(100).optional(),
        dailyAppointmentCapacity: z.number().int().min(1).max(100).optional(),
        workloadNotes: z.string().max(500).nullable().optional(),
        expectedUpdatedAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const raw = await nexoFetch<any>(ctx, `/people/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      return unwrapNexoApiResponse(raw);
    }),


  /** Listar indisponibilidades temporárias tenant-scoped. */
  listAvailabilityExceptions: protectedProcedure
    .input(z.object({ personId: z.string().min(1) }).strict())
    .query(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx, `/people/${input.personId}/availability-exceptions`, { method: "GET" });
      return unwrapNexoApiResponse(raw);
    }),

  /** Criar indisponibilidade temporária sem aceitar orgId do client. */
  createAvailabilityException: protectedProcedure
    .input(z.object({
      personId: z.string().min(1),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().max(200).nullable().optional(),
    }).strict().refine(({ startsAt, endsAt }) => new Date(startsAt) < new Date(endsAt), { message: "Início deve ser anterior ao fim", path: ["endsAt"] }))
    .mutation(async ({ input, ctx }) => {
      const { personId, ...data } = input;
      const raw = await nexoFetch<any>(ctx, `/people/${personId}/availability-exceptions`, { method: "POST", body: JSON.stringify(data) });
      return unwrapNexoApiResponse(raw);
    }),

  /** Remover indisponibilidade temporária tenant-scoped. */
  deleteAvailabilityException: protectedProcedure
    .input(z.object({ personId: z.string().min(1), exceptionId: z.string().min(1) }).strict())
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx, `/people/${input.personId}/availability-exceptions/${input.exceptionId}`, { method: "DELETE" });
      return unwrapNexoApiResponse(raw);
    }),

  /**
   * Métricas de pessoas vinculadas
   * Nest: GET /people/stats/linked
   */
  statsLinked: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx, `/people/stats/linked`, { method: "GET" });
    return unwrapNexoApiResponse(raw);
  }),

  /**
   * Desativar pessoa (soft delete)
   * Nest: DELETE /people/:id
   * Regra de negócio: bloqueia se houver OS ativa vinculada à pessoa.
   */
  deactivate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const raw = await nexoFetch<any>(ctx, `/people/${input.id}`, {
        method: "DELETE",
      });
      return unwrapNexoApiResponse(raw);
    }),
});
