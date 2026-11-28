import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { authedGetPage, authedGet, authedPatch, authedPost, type NexoContext } from "../_core/nexoTransport";

const appointmentCreateInput = z.object({
  customerId: z.string().min(1),
  assignedToPersonId: z.string().min(1).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
});

const appointmentSeriesPreviewInput = z.object({
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }).optional(),
        assignedToPersonId: z.string().uuid().optional(),
        cadence: z.enum(["WEEKLY", "BIWEEKLY"]),
        count: z.number().int().min(2).max(12),
      }).strict();

const appointmentUpdateInput = z.object({
  id: z.string().min(1),
  assignedToPersonId: z.string().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const appointmentsRouter = router({
    page: protectedProcedure.input(z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
      customerId: z.string().optional(),
      id: z.string().uuid().optional(),
      assignedToPersonId: z.string().optional(),
      page: z.number().int().positive().max(10_000).optional(),
      limit: z.number().int().positive().max(1000).optional(),
      search: z.string().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      return authedGetPage(ctx as NexoContext, "/appointments", input);
    }),

    list: protectedProcedure.input(z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
      customerId: z.string().optional(),
      id: z.string().uuid().optional(),
      assignedToPersonId: z.string().optional(),
      page: z.number().int().positive().max(10_000).optional(),
      limit: z.number().int().positive().max(1000).optional(),
      search: z.string().optional(),
    }).optional()).query(async ({ ctx, input }) => {
      return authedGet(ctx as NexoContext, "/appointments", input);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        return authedGet(ctx as NexoContext, `/appointments/${input.id}`);
      }),

    previewSeries: protectedProcedure
      .input(appointmentSeriesPreviewInput)
      .output(z.array(z.object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        conflict: z.boolean(),
      })))
      .mutation(({ ctx, input }) =>
        authedPost(ctx as NexoContext, "/appointments/series/preview", input)
      ),

    createSeries: protectedProcedure
      .input(appointmentSeriesPreviewInput.extend({
        customerId: z.string().uuid(),
        entryKey: z.string().trim().min(8).max(200),
        notes: z.string().max(2000).optional(),
      }))
      .output(z.object({ seriesId: z.string().uuid(), visitIds: z.array(z.string().uuid()) }))
      .mutation(({ ctx, input }) =>
        authedPost(ctx as NexoContext, "/appointments/series", input)
      ),

    rescheduleSeries: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        startsAt: z.string().datetime({ offset: true }),
        endsAt: z.string().datetime({ offset: true }),
        expectedUpdatedAt: z.string().datetime({ offset: true }),
      }).strict())
      .output(z.object({ seriesId: z.string().uuid(), visitIds: z.array(z.string().uuid()) }))
      .mutation(({ ctx, input: { id, ...input } }) =>
        authedPatch(ctx as NexoContext, `/appointments/${id}/series/following`, input)
      ),

    create: protectedProcedure.input(appointmentCreateInput).mutation(async ({ ctx, input }) => {
      return authedPost(ctx as NexoContext, "/appointments", input);
    }),

    update: protectedProcedure.input(appointmentUpdateInput).mutation(async ({ ctx, input }) => {
      const id = input?.id;
      if (!id || typeof id !== "string") {
        throw new Error("ID do agendamento é obrigatório.");
      }

      const { id: _id, ...payload } = input ?? {};
      const updatePayload = { ...payload };

      if (!updatePayload.expectedUpdatedAt) {
        const current = await authedGet(ctx as NexoContext, `/appointments/${id}`) as { updatedAt?: string | null };
        if (!current?.updatedAt) {
          throw new Error("Não foi possível obter a versão atual do agendamento.");
        }
        updatePayload.expectedUpdatedAt = current.updatedAt;
      }

      return authedPatch(ctx as NexoContext, `/appointments/${id}`, updatePayload);
    }),
  })
