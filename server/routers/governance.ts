import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createGovernance,
  getGovernanceByOrg,
  getGovernanceById,
  updateGovernance,
  deleteGovernance,
  getCustomerById,
  getAppointmentById,
  getServiceOrderById,
  getChargeById,
} from "../db";
import { TRPCError } from "@trpc/server";

export const governanceRouter = router({
  governance: router({
    create: protectedProcedure
      .input(
        z.object({
          customerId: z.number().optional(),
          appointmentId: z.number().optional(),
          serviceOrderId: z.number().optional(),
          chargeId: z.number().optional(),
          riskScore: z.number().min(0).max(100),
          riskLevel: z.enum(["low", "medium", "high", "critical"]),
          complianceStatus: z.enum(["compliant", "warning", "non_compliant"]),
          issues: z.array(z.string()).optional(),
          recommendations: z.array(z.string()).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const orgId = ctx.user?.id || 1;
        return await createGovernance({
          organizationId: orgId,
          customerId: input.customerId,
          appointmentId: input.appointmentId,
          serviceOrderId: input.serviceOrderId,
          chargeId: input.chargeId,
          riskScore: input.riskScore,
          riskLevel: input.riskLevel,
          complianceStatus: input.complianceStatus,
          issues: input.issues ? JSON.stringify(input.issues) : null,
          recommendations: input.recommendations ? JSON.stringify(input.recommendations) : null,
          notes: input.notes,
          evaluatedBy: ctx.user?.email,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      return await getGovernanceByOrg(orgId);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getGovernanceById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          riskScore: z.number().min(0).max(100).optional(),
          riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
          complianceStatus: z.enum(["compliant", "warning", "non_compliant"]).optional(),
          issues: z.array(z.string()).optional(),
          recommendations: z.array(z.string()).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.issues) updateData.issues = JSON.stringify(data.issues);
        if (data.recommendations) updateData.recommendations = JSON.stringify(data.recommendations);
        updateData.evaluatedBy = ctx.user?.email;
        updateData.lastEvaluated = new Date();

        return await updateGovernance(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteGovernance(input.id);
      }),

    // ===== Risk Analysis =====
    riskSummary: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const allGovernance = await getGovernanceByOrg(orgId);

      const critical = allGovernance.filter((g) => g.riskLevel === "critical").length;
      const high = allGovernance.filter((g) => g.riskLevel === "high").length;
      const medium = allGovernance.filter((g) => g.riskLevel === "medium").length;
      const low = allGovernance.filter((g) => g.riskLevel === "low").length;

      const compliant = allGovernance.filter((g) => g.complianceStatus === "compliant").length;
      const warning = allGovernance.filter((g) => g.complianceStatus === "warning").length;
      const nonCompliant = allGovernance.filter((g) => g.complianceStatus === "non_compliant").length;

      const avgRiskScore = allGovernance.length > 0
        ? Math.round(allGovernance.reduce((sum, g) => sum + g.riskScore, 0) / allGovernance.length)
        : 0;

      return {
        total: allGovernance.length,
        riskDistribution: { critical, high, medium, low },
        complianceDistribution: { compliant, warning, nonCompliant },
        averageRiskScore: avgRiskScore,
      };
    }),

    riskDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const allGovernance = await getGovernanceByOrg(orgId);

      const distribution = [
        {
          name: "Crítico",
          value: allGovernance.filter((g) => g.riskLevel === "critical").length,
          fill: "#DC2626",
        },
        {
          name: "Alto",
          value: allGovernance.filter((g) => g.riskLevel === "high").length,
          fill: "#F97316",
        },
        {
          name: "Médio",
          value: allGovernance.filter((g) => g.riskLevel === "medium").length,
          fill: "#FBBF24",
        },
        {
          name: "Baixo",
          value: allGovernance.filter((g) => g.riskLevel === "low").length,
          fill: "#10B981",
        },
      ];

      return distribution.filter((d) => d.value > 0);
    }),

    complianceDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const allGovernance = await getGovernanceByOrg(orgId);

      const distribution = [
        {
          name: "Conforme",
          value: allGovernance.filter((g) => g.complianceStatus === "compliant").length,
          fill: "#10B981",
        },
        {
          name: "Aviso",
          value: allGovernance.filter((g) => g.complianceStatus === "warning").length,
          fill: "#FBBF24",
        },
        {
          name: "Não Conforme",
          value: allGovernance.filter((g) => g.complianceStatus === "non_compliant").length,
          fill: "#DC2626",
        },
      ];

      return distribution.filter((d) => d.value > 0);
    }),

    // ===== Auto Risk Scoring =====
    autoScore: protectedProcedure
      .input(
        z.object({
          customerId: z.number().optional(),
          appointmentId: z.number().optional(),
          serviceOrderId: z.number().optional(),
          chargeId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        let riskScore = 0;
        let issues: string[] = [];
        let recommendations: string[] = [];

        // Customer Risk Assessment
        if (input.customerId) {
          const customer = await getCustomerById(input.customerId);
          if (customer) {
            if (!customer.phone) {
              riskScore += 10;
              issues.push("Cliente sem telefone cadastrado");
              recommendations.push("Adicionar telefone do cliente");
            }
            if (!customer.email) {
              riskScore += 10;
              issues.push("Cliente sem email cadastrado");
              recommendations.push("Adicionar email do cliente");
            }
          }
        }

        // Appointment Risk Assessment
        if (input.appointmentId) {
          const appointment = await getAppointmentById(input.appointmentId);
          if (appointment) {
            const now = new Date();
            const appointmentDate = new Date(appointment.startsAt);
            if (appointmentDate < now && appointment.status !== "DONE") {
              riskScore += 20;
              issues.push("Agendamento vencido não finalizado");
              recommendations.push("Finalizar ou reagendar o agendamento");
            }
          }
        }

        // Service Order Risk Assessment
        if (input.serviceOrderId) {
          const serviceOrder = await getServiceOrderById(input.serviceOrderId);
          if (serviceOrder) {
            if (serviceOrder.status === "OPEN" || serviceOrder.status === "IN_PROGRESS") {
              const createdDate = new Date(serviceOrder.createdAt);
              const daysSinceCreation = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
              if (daysSinceCreation > 30) {
                riskScore += 15;
                issues.push("Ordem de serviço aberta há mais de 30 dias");
                recommendations.push("Revisar e finalizar a ordem de serviço");
              }
            }
          }
        }

        // Charge Risk Assessment
        if (input.chargeId) {
          const charge = await getChargeById(input.chargeId);
          if (charge) {
            if (charge.status === "OVERDUE") {
              riskScore += 25;
              issues.push("Cobrança vencida não paga");
              recommendations.push("Contatar cliente para pagamento");
            } else if (charge.status === "PENDING") {
              const dueDate = new Date(charge.dueDate);
              const daysUntilDue = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (daysUntilDue < 7) {
                riskScore += 10;
                issues.push("Cobrança vencendo em menos de 7 dias");
                recommendations.push("Enviar lembrete de pagamento");
              }
            }
          }
        }

        const riskLevel =
          riskScore >= 80
            ? "critical"
            : riskScore >= 60
            ? "high"
            : riskScore >= 40
            ? "medium"
            : "low";

        const complianceStatus =
          riskScore >= 60
            ? "non_compliant"
            : riskScore >= 40
            ? "warning"
            : "compliant";

        return {
          riskScore: Math.min(100, riskScore),
          riskLevel,
          complianceStatus,
          issues,
          recommendations,
        };
      }),
  }),
});
