import { trpc } from "./trpc";

// Interfaces de Dados para o Frontend
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
  description: string;
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

/**
 * Cliente de API que abstrai as chamadas tRPC para o proxy do backend NestJS.
 * IMPORTANTE: Para chamadas imperativas fora de componentes (como no AuthContext),
 * usamos a instância direta do client tRPC se disponível, ou fallback.
 * No entanto, o padrão do projeto parece ser usar hooks. 
 * Para manter a compatibilidade com o código legado que usa 'await api.login()',
 * vamos usar o vanilla client do tRPC.
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
// @ts-ignore
import type { AppRouter } from '../../server/routers';

const client = createTRPCProxyClient<AppRouter | any>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});

export const api = {
  // Auth
  login: (data: any) => client.nexo.auth.login.mutate(data),
  logout: () => client.nexo.auth.logout.mutate(),
  me: () => client.nexo.auth.me.query(),
  forgotPassword: (email: string) => client.nexo.auth.forgotPassword.mutate({ email }),
  resetPassword: (data: any) => client.nexo.auth.resetPassword.mutate(data),
  
  // Bootstrap
  register: (data: any) => client.nexo.bootstrap.firstAdmin.mutate(data),
  
  // Admin
  getAdminOverview: () => client.nexo.admin.overview.query(),

  // Customers
  listCustomers: () => client.nexo.customers.list.query(),
  getCustomer: (id: string) => client.nexo.customers.getById.query({ id }),
  getCustomerWorkspace: (id: string) => client.nexo.customers.workspace.query({ id }),
  createCustomer: (data: any) => client.nexo.customers.create.mutate(data),
  updateCustomer: (id: string, data: any) => client.nexo.customers.update.mutate({ id, data }),
  
  // Appointments
  listAppointments: (filters?: any) => client.nexo.appointments.list.query(filters),
  getAppointment: (id: string) => client.nexo.appointments.getById.query({ id }),
  createAppointment: (data: any) => client.nexo.appointments.create.mutate(data),
  updateAppointment: (id: string, data: any) => client.nexo.appointments.update.mutate({ id, data }),
  
  // Service Orders
  listServiceOrders: (filters?: any) => client.nexo.serviceOrders.list.query(filters),
  getServiceOrder: (id: string) => client.nexo.serviceOrders.getById.query({ id }),
  createServiceOrder: (data: any) => client.nexo.serviceOrders.create.mutate(data),
  updateServiceOrder: (id: string, data: any) => client.nexo.serviceOrders.update.mutate({ id, data }),
  
  // People
  listPeople: () => client.nexo.people.list.query(),
  getPerson: (id: string) => client.nexo.people.getById.query({ id }),
  createPerson: (data: any) => client.nexo.people.create.mutate(data),
  updatePerson: (id: string, data: any) => client.nexo.people.update.mutate({ id, data }),
  
  // Finance
  getFinanceOverview: () => client.nexo.finance.overview.query(),
  listCharges: (filters?: any) => client.nexo.finance.charges.list.query(filters),
  getChargeStats: () => client.nexo.finance.charges.stats.query(),
  getRevenueByMonth: () => client.nexo.finance.charges.revenueByMonth.query(),
  createCharge: (data: any) => client.nexo.finance.charges.create.mutate(data),
  updateCharge: (id: string, data: any) => client.nexo.finance.charges.update.mutate({ id, data }),
  deleteCharge: (id: string) => client.nexo.finance.charges.delete.mutate({ id }),
  payCharge: (chargeId: string, data: any) => client.nexo.finance.charges.update.mutate({ id: chargeId, data: { ...data, status: 'PAID', paidAt: new Date().toISOString() } }),
  
  // Governance
  getGovernanceSummary: () => client.nexo.governance.summary.query(),
  listGovernanceRuns: (filters?: any) => client.nexo.governance.runs.query(filters),
  getGovernanceAutoScore: () => client.nexo.governance.autoScore.query(),
  
  // Dashboard
  getDashboardMetrics: () => client.nexo.dashboard.metrics.query(),
  getDashboardRevenue: () => client.nexo.dashboard.revenue.query(),
  getDashboardGrowth: () => client.nexo.dashboard.growth.query(),
  getDashboardServiceOrdersStatus: () => client.nexo.dashboard.serviceOrdersStatus.query(),
  getDashboardChargesStatus: () => client.nexo.dashboard.chargesStatus.query(),
  
  // Reports
  getExecutiveReport: () => client.nexo.reports.executive.query(),
  getExecutiveMetrics: (filters?: any) => client.nexo.reports.metrics.query(filters),
  
  // WhatsApp
  getWhatsAppMessages: (customerId: string) => client.nexo.whatsapp.messages.query({ customerId }),
  sendWhatsAppMessage: (data: any) => client.nexo.whatsapp.send.mutate(data),
  updateWhatsAppStatus: (id: string, status: string) => client.nexo.whatsapp.updateStatus.mutate({ id, status }),

  // Timeline
  getCustomerTimeline: (customerId: string, limit?: number) => client.nexo.timeline.listByCustomer.query({ customerId, limit }),
  
  // Onboarding
  completeOnboarding: () => client.nexo.onboarding.complete.mutate(),
};
