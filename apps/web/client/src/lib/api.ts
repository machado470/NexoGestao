import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
// @ts-ignore
import type { AppRouter } from "../../server/routers";

export interface AdminOverview {
  totalOrganizations: number;
  totalUsers: number;
  activeOrganizations: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes?: string | null;
  customer?: Customer;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: number;
  scheduledFor?: string | null;
  assignedToPersonId?: string | null;
  customer?: Customer;
}

export interface Charge {
  id: string;
  customerId: string;
  description?: string;
  amountCents: number;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  customer?: Customer;
}

export interface FinanceOverview {
  totalRevenueInCents: number;
  paidRevenueInCents: number;
  pendingRevenueInCents: number;
  overdueRevenueInCents: number;
}

export interface DashboardMetrics {
  totalCustomers: number;
  openServiceOrders: number;
  overdueServiceOrders: number;
  weeklyRevenueInCents: number;
  pendingPaymentsInCents: number;
  totalServiceOrders: number;
  inProgressOrders: number;
  completedOrders: number;
  delayedOrders: number;
  riskTickets: number;
  totalRevenueInCents: number;
  paidRevenueInCents: number;
  pendingRevenueInCents: number;
}

export interface RevenueData {
  month: string;
  revenue: number;
}

export interface CustomerGrowthData {
  month: string;
  newCustomers: number;
  totalCustomers: number;
}

export interface ServiceOrdersStatus {
  open: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  onHold?: number;
}

export interface ChargesStatus {
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
  refunded?: number;
  partial?: number;
}

export interface ExecutiveReport {
  title: string;
  description: string;
  date: string;
  content: string;
}

export interface ExecutiveMetrics {
  name: string;
  value: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

const client = createTRPCProxyClient<AppRouter | any>({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

export const api = {
  login: (data: any) => client.nexo.auth.login.mutate(data),
  logout: () => client.nexo.auth.logout.mutate(),
  me: () => client.nexo.auth.me.query(),
  forgotPassword: (email: string) =>
    client.nexo.auth.forgotPassword.mutate({ email }),
  resetPassword: (data: any) => client.nexo.auth.resetPassword.mutate(data),

  register: (data: any) => client.nexo.bootstrap.firstAdmin.mutate(data),

  listCustomers: () => client.nexo.customers.list.query(),
  getCustomer: (id: string) => client.nexo.customers.getById.query({ id }),
  getCustomerWorkspace: (id: string) =>
    client.nexo.customers.workspace.query({ id }),
  createCustomer: (data: any) => client.nexo.customers.create.mutate(data),
  updateCustomer: (id: string, data: any) =>
    client.nexo.customers.update.mutate({ id, data }),

  listAppointments: (filters?: any) =>
    client.nexo.appointments.list.query(filters),
  getAppointment: (id: string) =>
    client.nexo.appointments.getById.query({ id }),
  createAppointment: (data: any) =>
    client.nexo.appointments.create.mutate(data),
  updateAppointment: (id: string, data: any) =>
    client.nexo.appointments.update.mutate({ id, data }),

  listServiceOrders: (filters?: any) =>
    client.nexo.serviceOrders.list.query(filters),
  getServiceOrder: (id: string) =>
    client.nexo.serviceOrders.getById.query({ id }),
  createServiceOrder: (data: any) =>
    client.nexo.serviceOrders.create.mutate(data),
  updateServiceOrder: (id: string, data: any) =>
    client.nexo.serviceOrders.update.mutate({ id, data }),

  listPeople: () => client.nexo.people.list.query(),
  getPerson: (id: string) => client.nexo.people.getById.query({ id }),
  createPerson: (data: any) => client.nexo.people.create.mutate(data),
  updatePerson: (id: string, data: any) =>
    client.nexo.people.update.mutate({ id, data }),

  getFinanceOverview: () => client.nexo.finance.overview.query(),
  listCharges: (filters?: any) => client.nexo.finance.charges.list.query(filters),
  getChargeStats: () => client.nexo.finance.charges.stats.query(),
  getRevenueByMonth: () => client.nexo.finance.charges.revenueByMonth.query(),
  createCharge: (data: any) => client.nexo.finance.charges.create.mutate(data),
  updateCharge: (id: string, data: any) =>
    client.nexo.finance.charges.update.mutate({ id, data }),
  deleteCharge: (id: string) =>
    client.nexo.finance.charges.delete.mutate({ id }),
  payCharge: (
    chargeId: string,
    data: { method?: string; amountCents?: number }
  ) =>
    client.nexo.finance.charges.pay.mutate({
      id: chargeId,
      method: data?.method,
      amountCents: data?.amountCents,
    }),

  getGovernanceSummary: () => client.nexo.governance.summary.query(),
  listGovernanceRuns: (filters?: any) =>
    client.nexo.governance.runs.query(filters),
  getGovernanceAutoScore: () => client.nexo.governance.autoScore.query(),

  getDashboardMetrics: () => client.nexo.dashboard.metrics.query(),
  getDashboardRevenue: () => client.nexo.dashboard.revenue.query(),
  getDashboardGrowth: () => client.nexo.dashboard.growth.query(),
  getDashboardServiceOrdersStatus: () =>
    client.nexo.dashboard.serviceOrdersStatus.query(),
  getDashboardChargesStatus: () =>
    client.nexo.dashboard.chargesStatus.query(),
  getDashboardAlerts: () => client.nexo.dashboard.alerts.query(),

  getExecutiveReport: () => client.nexo.reports.executive.query(),
  getExecutiveMetrics: (filters?: any) =>
    client.nexo.reports.metrics.query(filters),

  getWhatsAppMessages: (customerId: string) =>
    client.nexo.whatsapp.messages.query({ customerId }),
  sendWhatsAppMessage: (data: any) =>
    client.nexo.whatsapp.send.mutate(data),
  updateWhatsAppStatus: (id: string, status: string) =>
    client.nexo.whatsapp.updateStatus.mutate({ id, status }),

  getCustomerTimeline: (customerId: string, limit?: number) =>
    client.nexo.timeline.listByCustomer.query({ customerId, limit }),

  completeOnboarding: () => client.nexo.onboarding.complete.mutate(),

  getSettings: () => client.nexo.settings.get.query(),
  updateSettings: (data: any) => client.nexo.settings.update.mutate(data),
};
