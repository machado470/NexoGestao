import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { charges } from "../../drizzle/schema";
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
  createCharge,
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
        const orgId = ctx.user?.organizationId || 1;
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
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        const allCustomers = await getCustomersByOrg(orgId);
        const total = allCustomers.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allCustomers.slice(start, start + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages,
          },
        };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getCustomerById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
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
          customerId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          startsAt: z.date(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        return await createAppointment({
          organizationId: orgId,
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          startsAt: input.startsAt,
          status: input.status || "SCHEDULED",
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
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        const allAppointments = await getAppointmentsByOrg(orgId);
        const total = allAppointments.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allAppointments.slice(start, start + input.limit);
        return {
          data,
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            pages,
          },
        };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getAppointmentById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startsAt: z.date().optional(),
          status: z.enum(["SCHEDULED", "CONFIRMED", "CANCELED", "DONE", "NO_SHOW"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, startsAt, ...data } = input;
        const updateData: any = data;
        if (startsAt) updateData.startsAt = startsAt;
        return await updateAppointment(id, updateData);
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
          customerId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          amount: z.number().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }: any) => {
        const orgId = ctx.user?.organizationId || 1;
        return await createServiceOrder({
          organizationId: orgId,
          customerId: input.customerId,
          title: input.title,
          description: input.description,
          amount: input.amount,
          priority: input.priority || "MEDIUM",
          assignedTo: input.assignedTo,
          notes: input.notes,
          status: "OPEN",
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          page: z.number().int().positive().default(1),
          limit: z.number().int().positive().default(10),
        })
      )
      .query(async ({ input, ctx }) => {
        const orgId = ctx.user?.organizationId || 1;
        return await getServiceOrdersByOrg(orgId);
      }),

    get: protectedProcedure
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
          amount: z.number().optional(),
          priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
          status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"]).optional(),
          assignedTo: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }: any) => {
        const { id, ...data } = input;
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Get the current ServiceOrder to check if status is changing to DONE
        const currentOrder = await getServiceOrderById(id);
        if (!currentOrder) throw new Error("ServiceOrder not found");

        // Update the ServiceOrder
        const result = await updateServiceOrder(id, data);

        // Auto-create charge when ServiceOrder is completed
        if (data.status === "DONE" && currentOrder.status !== "DONE" && currentOrder.amount) {
          const orgId = ctx.user?.organizationId || 1;
          
          // Create a charge with the ServiceOrder amount
          const chargeResult = await db.insert(charges).values({
            organizationId: orgId,
            customerId: currentOrder.customerId,
            description: `Cobranca - ${currentOrder.title}`,
            amount: Math.round(parseFloat(currentOrder.amount.toString()) * 100), // Convert to cents
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            status: "PENDING",
            notes: `Gerada automaticamente da Ordem de Servico #${id}`,
          });

          // Update ServiceOrder with the chargeId
          if (chargeResult && (chargeResult as any).insertId) {
            await updateServiceOrder(id, { chargeId: (chargeResult as any).insertId });
          }
        }

        return result;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteServiceOrder(input.id);
      }),
  }),
});
