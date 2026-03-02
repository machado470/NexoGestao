import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getCustomersByOrg,
  getAppointmentsByOrg,
  getServiceOrdersByOrg,
  getChargesByOrg,
  getGovernanceByOrg,
} from "../db";

export const dashboardRouter = router({
  dashboard: router({
    // ===== Main KPIs =====
    kpis: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;

      // Get all data
      const customers = await getCustomersByOrg(orgId);
      const appointments = await getAppointmentsByOrg(orgId);
      const serviceOrders = await getServiceOrdersByOrg(orgId);
      const charges = await getChargesByOrg(orgId);
      const governance = await getGovernanceByOrg(orgId);

      // Calculate KPIs
      const totalCustomers = customers.length;
      const activeCustomers = customers.filter((c) => c.active).length;

      const totalAppointments = appointments.length;
      const completedAppointments = appointments.filter((a) => a.status === "DONE").length;
      const pendingAppointments = appointments.filter(
        (a) => a.status === "SCHEDULED" || a.status === "CONFIRMED"
      ).length;

      const totalServiceOrders = serviceOrders.length;
      const completedServiceOrders = serviceOrders.filter((s) => s.status === "DONE").length;

      const totalRevenue = charges.reduce((sum, c) => sum + c.amount, 0);
      const paidRevenue = charges
        .filter((c) => c.status === "PAID")
        .reduce((sum, c) => sum + c.amount, 0);
      const pendingRevenue = charges
        .filter((c) => c.status === "PENDING")
        .reduce((sum, c) => sum + c.amount, 0);
      const overdueRevenue = charges
        .filter((c) => c.status === "OVERDUE")
        .reduce((sum, c) => sum + c.amount, 0);

      const criticalRisks = governance.filter((g) => g.riskLevel === "critical").length;
      const highRisks = governance.filter((g) => g.riskLevel === "high").length;
      const averageRiskScore =
        governance.length > 0
          ? Math.round(governance.reduce((sum, g) => sum + g.riskScore, 0) / governance.length)
          : 0;

      return {
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          inactive: totalCustomers - activeCustomers,
        },
        appointments: {
          total: totalAppointments,
          completed: completedAppointments,
          pending: pendingAppointments,
          completionRate:
            totalAppointments > 0
              ? Math.round((completedAppointments / totalAppointments) * 100)
              : 0,
        },
        serviceOrders: {
          total: totalServiceOrders,
          completed: completedServiceOrders,
          inProgress: totalServiceOrders - completedServiceOrders,
          completionRate:
            totalServiceOrders > 0
              ? Math.round((completedServiceOrders / totalServiceOrders) * 100)
              : 0,
        },
        revenue: {
          total: totalRevenue,
          paid: paidRevenue,
          pending: pendingRevenue,
          overdue: overdueRevenue,
          collectionRate:
            totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 0,
        },
        governance: {
          criticalRisks,
          highRisks,
          averageRiskScore,
          totalAssessments: governance.length,
        },
      };
    }),

    // ===== Revenue Trend (Last 12 months) =====
    revenueTrend: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const charges = await getChargesByOrg(orgId);

      // Group by month
      const monthlyData: Record<string, number> = {};
      const monthNames = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];

      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData[monthKey] = 0;
      }

      // Add revenue data
      charges.forEach((charge) => {
        if (charge.status === "PAID") {
          const date = new Date(charge.paidDate || charge.dueDate);
          const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          if (monthlyData[monthKey] !== undefined) {
            monthlyData[monthKey] += charge.amount;
          }
        }
      });

      return Object.entries(monthlyData).map(([month, revenue]) => ({
        month,
        revenue: Math.round(revenue / 100), // Convert cents to reais
      }));
    }),

    // ===== Appointment Status Distribution =====
    appointmentDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const appointments = await getAppointmentsByOrg(orgId);

      const distribution = [
        {
          name: "Confirmados",
          value: appointments.filter((a) => a.status === "CONFIRMED").length,
          fill: "#3B82F6",
        },
        {
          name: "Agendados",
          value: appointments.filter((a) => a.status === "SCHEDULED").length,
          fill: "#8B5CF6",
        },
        {
          name: "Concluídos",
          value: appointments.filter((a) => a.status === "DONE").length,
          fill: "#10B981",
        },
      ];

      return distribution.filter((d) => d.value > 0);
    }),

    // ===== Charge Status Distribution =====
    chargeDistribution: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;
      const charges = await getChargesByOrg(orgId);

      const distribution = [
        {
          name: "Pagas",
          value: charges.filter((c) => c.status === "PAID").length,
          fill: "#10B981",
        },
        {
          name: "Pendentes",
          value: charges.filter((c) => c.status === "PENDING").length,
          fill: "#FBBF24",
        },
        {
          name: "Vencidas",
          value: charges.filter((c) => c.status === "OVERDUE").length,
          fill: "#DC2626",
        },
      ];

      return distribution.filter((d) => d.value > 0);
    }),

    // ===== Recent Activities =====
    recentActivities: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;

      const appointments = await getAppointmentsByOrg(orgId);
      const charges = await getChargesByOrg(orgId);
      const serviceOrders = await getServiceOrdersByOrg(orgId);

      const activities = [
        ...appointments.map((a) => ({
          type: "appointment",
          title: `Agendamento #${a.customerId}`,
          status: a.status,
          date: a.startsAt,
          icon: "📅",
        })),
        ...charges.map((c) => ({
          type: "charge",
          title: `Cobrança de R$ ${(c.amount / 100).toFixed(2)}`,
          status: c.status,
          date: c.dueDate,
          icon: "💰",
        })),
        ...serviceOrders.map((s) => ({
          type: "serviceOrder",
          title: `Ordem: ${s.title}`,
          status: s.status,
          date: s.createdAt,
          icon: "🔧",
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      return activities;
    }),

    // ===== Performance Metrics =====
    performanceMetrics: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.user?.id || 1;

      const appointments = await getAppointmentsByOrg(orgId);
      const charges = await getChargesByOrg(orgId);
      const serviceOrders = await getServiceOrdersByOrg(orgId);

      const appointmentCompletionRate =
        appointments.length > 0
          ? Math.round(
              (appointments.filter((a) => a.status === "DONE").length / appointments.length) *
                100
            )
          : 0;

      const chargeCollectionRate =
        charges.length > 0
          ? Math.round(
              (charges.filter((c) => c.status === "PAID").length / charges.length) * 100
            )
          : 0;

      const serviceOrderCompletionRate =
        serviceOrders.length > 0
          ? Math.round(
              (serviceOrders.filter((s) => s.status === "DONE").length / serviceOrders.length) *
                100
            )
          : 0;

      return [
        {
          name: "Taxa de Conclusão de Agendamentos",
          value: appointmentCompletionRate,
          target: 85,
          status:
            appointmentCompletionRate >= 85
              ? "success"
              : appointmentCompletionRate >= 70
              ? "warning"
              : "danger",
        },
        {
          name: "Taxa de Cobrança",
          value: chargeCollectionRate,
          target: 90,
          status:
            chargeCollectionRate >= 90
              ? "success"
              : chargeCollectionRate >= 75
              ? "warning"
              : "danger",
        },
        {
          name: "Taxa de Conclusão de Ordens",
          value: serviceOrderCompletionRate,
          target: 80,
          status:
            serviceOrderCompletionRate >= 80
              ? "success"
              : serviceOrderCompletionRate >= 65
              ? "warning"
              : "danger",
        },
      ];
    }),
  }),
});
