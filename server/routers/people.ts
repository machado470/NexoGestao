import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createPerson,
  getPeopleByOrg,
  getPersonById,
  updatePerson,
  deletePerson,
} from "../db";
import { TRPCError } from "@trpc/server";

export const peopleRouter = router({
  // ===== People Management =====
  people: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "Nome é obrigatório"),
          email: z.string().email("Email inválido"),
          phone: z.string().optional(),
          role: z.enum(["admin", "manager", "collaborator", "viewer"]).default("collaborator"),
          department: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Apenas admins podem criar pessoas
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas administradores podem criar pessoas",
          });
        }

        const orgId = ctx.user?.organizationId || 1;
        return await createPerson({
          organizationId: orgId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: input.role,
          department: input.department,
          status: "active",
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
        const allPeople = await getPeopleByOrg(orgId);
        const total = allPeople.length;
        const pages = Math.ceil(total / input.limit);
        const start = (input.page - 1) * input.limit;
        const data = allPeople.slice(start, start + input.limit);
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

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getPersonById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          role: z.enum(["admin", "manager", "collaborator", "viewer"]).optional(),
          department: z.string().optional(),
          status: z.enum(["active", "inactive", "suspended"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Apenas admins podem atualizar pessoas
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas administradores podem atualizar pessoas",
          });
        }

        const { id, ...data } = input;
        return await updatePerson(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Apenas admins podem deletar pessoas
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas administradores podem deletar pessoas",
          });
        }

        return await deletePerson(input.id);
      }),

    // ===== Statistics =====
    stats: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allPeople = await getPeopleByOrg(orgId);

      const active = allPeople.filter((p) => p.status === "active");
      const inactive = allPeople.filter((p) => p.status === "inactive");
      const suspended = allPeople.filter((p) => p.status === "suspended");

      const byRole = {
        admin: allPeople.filter((p) => p.role === "admin").length,
        manager: allPeople.filter((p) => p.role === "manager").length,
        collaborator: allPeople.filter((p) => p.role === "collaborator").length,
        viewer: allPeople.filter((p) => p.role === "viewer").length,
      };

      return {
        total: allPeople.length,
        active: active.length,
        inactive: inactive.length,
        suspended: suspended.length,
        byRole,
      };
    }),

    // ===== Role Distribution =====
    roleDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allPeople = await getPeopleByOrg(orgId);

      const distribution = [
        {
          name: "Administrador",
          value: allPeople.filter((p) => p.role === "admin").length,
          fill: "#EF4444",
        },
        {
          name: "Gerente",
          value: allPeople.filter((p) => p.role === "manager").length,
          fill: "#F97316",
        },
        {
          name: "Colaborador",
          value: allPeople.filter((p) => p.role === "collaborator").length,
          fill: "#3B82F6",
        },
        {
          name: "Visualizador",
          value: allPeople.filter((p) => p.role === "viewer").length,
          fill: "#6B7280",
        },
      ];

      return distribution.filter((d) => d.value > 0);
    }),

    // ===== Department Distribution =====
    departmentDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.organizationId || 1;
      const allPeople = await getPeopleByOrg(orgId);

      const departments: Record<string, number> = {};
      allPeople.forEach((person) => {
        const dept = person.department || "Sem Departamento";
        departments[dept] = (departments[dept] || 0) + 1;
      });

      return Object.entries(departments).map(([department, count]) => ({
        department,
        count,
      }));
    }),
  }),
});
