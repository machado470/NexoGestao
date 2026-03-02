import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import prisma from "../_core/prisma";

export const customersPrismaRouter = router({
  // Listar clientes da organização
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      const skip = (input.page - 1) * input.limit;

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where: { orgId: ctx.user.organizationId },
          orderBy: { createdAt: "desc" },
          skip,
          take: input.limit,
        }),
        prisma.customer.count({
          where: { orgId: ctx.user.organizationId },
        }),
      ]);

      return {
        data: customers,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),

  // Obter cliente por ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const customer = await prisma.customer.findFirst({
        where: { id: input.id, orgId: ctx.user.organizationId },
        include: {
          appointments: {
            orderBy: { startsAt: "desc" },
            take: 10,
          },
          serviceOrders: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          charges: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!customer) {
        throw new Error("Cliente não encontrado");
      }

      return customer;
    }),

  // Criar cliente
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const customer = await prisma.customer.create({
        data: {
          orgId: ctx.user.organizationId,
          name: input.name,
          phone: input.phone || "",
          email: input.email || null,
          notes: input.notes || null,
          active: true,
        },
      });

      return customer;
    }),

  // Atualizar cliente
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        notes: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const customer = await prisma.customer.updateMany({
        where: { id, orgId: ctx.user.organizationId },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      if (customer.count === 0) {
        throw new Error("Cliente não encontrado");
      }

      return { success: true };
    }),

  // Deletar cliente
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const customer = await prisma.customer.deleteMany({
        where: { id: input.id, orgId: ctx.user.organizationId },
      });

      if (customer.count === 0) {
        throw new Error("Cliente não encontrado");
      }

      return { success: true };
    }),

  // Buscar clientes por email
  findByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input, ctx }) => {
      const customer = await prisma.customer.findFirst({
        where: { email: input.email, orgId: ctx.user.organizationId },
      });

      return customer;
    }),

  // Estatísticas de clientes
  stats: protectedProcedure.query(async ({ ctx }) => {
    const [total, active, withAppointments, withServiceOrders] =
      await Promise.all([
        prisma.customer.count({
          where: { orgId: ctx.user.organizationId },
        }),
        prisma.customer.count({
          where: { orgId: ctx.user.organizationId, active: true },
        }),
        prisma.customer.count({
          where: {
            orgId: ctx.user.organizationId,
            appointments: { some: {} },
          },
        }),
        prisma.customer.count({
          where: {
            orgId: ctx.user.organizationId,
            serviceOrders: { some: {} },
          },
        }),
      ]);

    return {
      total,
      active,
      withAppointments,
      withServiceOrders,
    };
  }),
});
