import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCustomer,
  getCustomersByOrg,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  createAppointment,
  getAppointmentsByOrg,
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  createServiceOrder,
  getServiceOrdersByOrg,
  getServiceOrderById,
  updateServiceOrder,
  deleteServiceOrder,
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
        const orgId = ctx.user?.id || 1;
        return await createCustomer({
          organizationId: orgId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          notes: input.notes,
          active: 1,
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
        const orgId = ctx.user?.id || 1;
        const allCustomers = await getCustomersByOrg(orgId);
        const total = allCustomers.length;
        const offset = (input.page - 1) * input.limit;
        const data = allCustomers.slice(offset, offset + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getCustomerById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          notes: z.string().optional(),
          active: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await updateCustomer(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteCustomer(input.id);
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

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user?.id || 1;
        const allAppointments = await getAppointmentsByOrg(orgId);
        const total = allAppointments.length;
        const offset = (input.page - 1) * input.limit;
        const data = allAppointments.slice(offset, offset + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getAppointmentById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          startsAt: z.date().optional(),
          endsAt: z.date().optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await updateAppointment(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteAppointment(input.id);
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

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ ctx, input }) => {
        const orgId = ctx.user?.id || 1;
        const allServiceOrders = await getServiceOrdersByOrg(orgId);
        const total = allServiceOrders.length;
        const offset = (input.page - 1) * input.limit;
        const data = allServiceOrders.slice(offset, offset + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages: Math.ceil(total / input.limit),
          },
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getServiceOrderById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
          status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).optional(),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await updateServiceOrder(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteServiceOrder(input.id);
      }),
  }),
});
