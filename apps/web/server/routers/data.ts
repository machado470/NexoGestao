import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCustomer,
  getCustomersByOrg,
  createAppointment,
  getAppointmentsByOrg,
  createServiceOrder,
  getServiceOrdersByOrg,
} from "../db";

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
        const orgId = ctx.user?.id || 1; // Use user ID como org ID para simplicidade
        return await createCustomer({
          organizationId: orgId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          notes: input.notes,
          active: 1,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getCustomersByOrg(orgId);
    }),
  }),

  // ===== Appointments =====
  appointments: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.number().min(1, "Cliente é obrigatório"),
          title: z.string().min(1, "Título é obrigatório"),
          description: z.string().optional(),
          startsAt: z.date(),
          endsAt: z.date().optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).default("SCHEDULED"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.id || 1;
        return await createAppointment({
          organizationId: orgId,
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: input.status,
          notes: input.notes,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getAppointmentsByOrg(orgId);
    }),
  }),

  // ===== Service Orders =====
  serviceOrders: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.number().min(1, "Cliente é obrigatório"),
          title: z.string().min(1, "Título é obrigatório"),
          description: z.string().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
          status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).default("OPEN"),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.id || 1;
        return await createServiceOrder({
          organizationId: orgId,
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          status: input.status,
          assignedTo: input.assignedTo,
          notes: input.notes,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getServiceOrdersByOrg(orgId);
    }),
  }),
});
