import axios, { AxiosInstance } from "axios";

const API_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "http://localhost:3001";

// ===== Auth & User =====
export interface LoginResponse {
  access_token: string;
  user: {
    userId: string;
    email: string;
    orgId: string;
    role: "ADMIN" | "COLLABORATOR";
    personId?: string;
  };
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  orgId?: string;
}

export interface ActivateResponse {
  success: boolean;
  access_token?: string;
  user?: LoginResponse["user"];
}

export interface MeResponse {
  userId: string;
  email: string;
  orgId: string;
  role: "ADMIN" | "COLLABORATOR";
  personId?: string;
  org: {
    id: string;
    name: string;
    slug: string;
    requiresOnboarding: boolean;
  };
}

// ===== Organization & Onboarding =====
export interface Organization {
  id: string;
  name: string;
  slug: string;
  requiresOnboarding: boolean;
  createdAt: string;
}

// ===== Admin Overview =====
export interface AdminOverview {
  total: number;
  critical: number;
  warning: number;
  governance: {
    ranAt: string;
    evaluated: number;
    warnings: number;
    correctives: number;
  } | null;
}

// ===== People & Risk =====
export interface Person {
  id: string;
  name: string;
  email?: string;
  role: string;
  active: boolean;
  riskScore: number;
  operationalState: "NORMAL" | "WARNING" | "RESTRICTED" | "SUSPENDED";
  operationalRiskScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskSnapshot {
  id: string;
  personId: string;
  score: number;
  reason: string;
  createdAt: string;
}

// ===== Customer & Appointments =====
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  customer?: Customer;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "CONFIRMED" | "CANCELED" | "DONE" | "NO_SHOW";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Service Orders =====
export interface ServiceOrder {
  id: string;
  customerId: string;
  customer?: Customer;
  appointmentId?: string;
  assignedToPersonId?: string;
  assignedToPerson?: Person;
  title: string;
  description?: string;
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "DONE" | "CANCELED";
  priority: number;
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ===== Finance =====
export interface Charge {
  id: string;
  customerId: string;
  serviceOrderId?: string;
  amount: number;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceOverview {
  totalPending: number;
  totalOverdue: number;
  totalReceived: number;
  pendingAmount: number;
  overdueAmount: number;
}

// ===== Tracks & Learning =====
export interface Track {
  id: string;
  title: string;
  description?: string;
  slug: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

export interface TrackItem {
  id: string;
  trackId: string;
  title: string;
  content?: string;
  type: "READING" | "ACTION" | "CHECKPOINT";
  order: number;
  createdAt: string;
}

export interface Assignment {
  id: string;
  personId: string;
  trackId: string;
  progress: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: string;
  updatedAt: string;
}

// ===== Governance & Compliance =====
export interface GovernanceRun {
  id: string;
  evaluated: number;
  warnings: number;
  correctives: number;
  institutionalRiskScore: number;
  restrictedCount: number;
  suspendedCount: number;
  openCorrectivesCount: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}

export interface GovernanceSummary {
  lastRun?: GovernanceRun;
  totalPeople: number;
  peopleAtRisk: number;
  openCorrectiveActions: number;
  institutionalRiskScore: number;
}

// ===== Reports =====
export interface ExecutiveReport {
  organizationName: string;
  reportDate: string;
  totalPeople: number;
  totalCustomers: number;
  totalAppointments: number;
  totalServiceOrders: number;
  totalRevenue: number;
  pendingCharges: number;
  riskMetrics: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ExecutiveMetrics {
  period: string;
  appointments: number;
  serviceOrders: number;
  revenue: number;
  completionRate: number;
  riskScore: number;
}

class NexoGestaoAPI {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Interceptor para adicionar token em todas as requisições
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("nexo_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Recuperar token do localStorage se existir
    const storedToken = localStorage.getItem("nexo_token");
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("nexo_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("nexo_token");
  }

  getToken(): string | null {
    return this.token || localStorage.getItem("nexo_token");
  }

  // ===== Authentication =====
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await this.client.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      this.setToken(response.data.access_token);
      return response.data;
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      throw error;
    }
  }

  async register(email: string, password: string, orgName: string, adminName: string = "Admin"): Promise<RegisterResponse> {
    try {
      const response = await this.client.post<RegisterResponse>("/bootstrap/first-admin", {
        email,
        password,
        orgName,
        adminName,
      });
      return response.data;
    } catch (error) {
      console.error("Erro ao registrar:", error);
      throw error;
    }
  }

  async activateAccount(token: string, password: string): Promise<ActivateResponse> {
    try {
      const response = await this.client.post<ActivateResponse>("/auth/activate", {
        token,
        password,
      });
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
      }
      return response.data;
    } catch (error) {
      console.error("Erro ao ativar conta:", error);
      throw error;
    }
  }

  async getMe(): Promise<MeResponse> {
    try {
      const response = await this.client.get<{ success: boolean; data: MeResponse }>("/me");
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      throw error;
    }
  }

  async logout() {
    this.clearToken();
  }

  // ===== Onboarding =====
  async completeOnboarding(): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post<{ success: boolean }>("/onboarding/complete");
      return response.data;
    } catch (error) {
      console.error("Erro ao completar onboarding:", error);
      throw error;
    }
  }

  // ===== Admin Overview =====
  async getAdminOverview(): Promise<AdminOverview> {
    try {
      const response = await this.client.get<{ success: boolean; data: AdminOverview }>(
        "/admin/overview"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar admin overview:", error);
      throw error;
    }
  }

  // ===== People Management =====
  async listPeople(): Promise<Person[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: Person[] }>("/people");
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar pessoas:", error);
      throw error;
    }
  }

  async getPerson(id: string): Promise<Person> {
    try {
      const response = await this.client.get<{ success: boolean; data: Person }>(
        `/people/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar pessoa:", error);
      throw error;
    }
  }

  async createPerson(data: { name: string; role: string; email?: string }): Promise<Person> {
    try {
      const response = await this.client.post<{ success: boolean; data: Person }>("/people", data);
      return response.data.data;
    } catch (error) {
      console.error("Erro ao criar pessoa:", error);
      throw error;
    }
  }

  async getRiskHistory(personId: string): Promise<RiskSnapshot[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: RiskSnapshot[] }>(
        `/people/${personId}/risk-history`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar histórico de risco:", error);
      throw error;
    }
  }

  // ===== Customers =====
  async listCustomers(): Promise<Customer[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: Customer[] }>(
        "/customers"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar clientes:", error);
      throw error;
    }
  }

  async getCustomer(id: string): Promise<Customer> {
    try {
      const response = await this.client.get<{ success: boolean; data: Customer }>(
        `/customers/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar cliente:", error);
      throw error;
    }
  }

  async createCustomer(data: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
  }): Promise<Customer> {
    try {
      const response = await this.client.post<{ success: boolean; data: Customer }>(
        "/customers",
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      throw error;
    }
  }

  async updateCustomer(
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      email: string;
      notes: string;
      active: boolean;
    }>
  ): Promise<Customer> {
    try {
      const response = await this.client.patch<{ success: boolean; data: Customer }>(
        `/customers/${id}`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      throw error;
    }
  }

  // ===== Appointments =====
  async listAppointments(filters?: {
    from?: string;
    to?: string;
    status?: string;
    customerId?: string;
  }): Promise<Appointment[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: Appointment[] }>(
        "/appointments",
        { params: filters }
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar agendamentos:", error);
      throw error;
    }
  }

  async getAppointment(id: string): Promise<Appointment> {
    try {
      const response = await this.client.get<{ success: boolean; data: Appointment }>(
        `/appointments/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar agendamento:", error);
      throw error;
    }
  }

  async createAppointment(data: {
    customerId: string;
    startsAt: string;
    endsAt: string;
    status?: string;
    notes?: string;
  }): Promise<Appointment> {
    try {
      const response = await this.client.post<{ success: boolean; data: Appointment }>(
        "/appointments",
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      throw error;
    }
  }

  async updateAppointment(
    id: string,
    data: Partial<{
      startsAt: string;
      endsAt: string;
      status: string;
      notes: string;
    }>
  ): Promise<Appointment> {
    try {
      const response = await this.client.patch<{ success: boolean; data: Appointment }>(
        `/appointments/${id}`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao atualizar agendamento:", error);
      throw error;
    }
  }

  // ===== Service Orders =====
  async listServiceOrders(filters?: {
    status?: string;
    customerId?: string;
    assignedToPersonId?: string;
  }): Promise<ServiceOrder[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: ServiceOrder[] }>(
        "/service-orders",
        { params: filters }
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar ordens de serviço:", error);
      throw error;
    }
  }

  async getServiceOrder(id: string): Promise<ServiceOrder> {
    try {
      const response = await this.client.get<{ success: boolean; data: ServiceOrder }>(
        `/service-orders/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar ordem de serviço:", error);
      throw error;
    }
  }

  async createServiceOrder(data: {
    customerId: string;
    title: string;
    description?: string;
    priority?: number;
    scheduledFor?: string;
    appointmentId?: string;
    assignedToPersonId?: string;
  }): Promise<ServiceOrder> {
    try {
      const response = await this.client.post<{ success: boolean; data: ServiceOrder }>(
        "/service-orders",
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao criar ordem de serviço:", error);
      throw error;
    }
  }

  async updateServiceOrder(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: string;
      priority: number;
      assignedToPersonId: string;
    }>
  ): Promise<ServiceOrder> {
    try {
      const response = await this.client.patch<{ success: boolean; data: ServiceOrder }>(
        `/service-orders/${id}`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao atualizar ordem de serviço:", error);
      throw error;
    }
  }

  // ===== Finance =====
  async getFinanceOverview(): Promise<FinanceOverview> {
    try {
      const response = await this.client.get<{ ok: boolean; data: FinanceOverview }>(
        "/finance/overview"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar overview financeiro:", error);
      throw error;
    }
  }

  async listCharges(filters?: {
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Charge[]; meta: { total: number; page: number; limit: number } }> {
    try {
      const response = await this.client.get<{
        ok: boolean;
        data: { items: Charge[]; meta: { total: number; page: number; limit: number } };
      }>("/finance/charges", { params: filters });
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar cobranças:", error);
      throw error;
    }
  }

  async getCharge(id: string): Promise<Charge> {
    try {
      const response = await this.client.get<{ ok: boolean; data: Charge }>(
        `/finance/charges/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar cobrança:", error);
      throw error;
    }
  }

  async payCharge(chargeId: string, data: { method: string; amountCents: number }): Promise<Charge> {
    try {
      const response = await this.client.post<{ ok: boolean; data: Charge }>(
        `/finance/charges/${chargeId}/pay`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      throw error;
    }
  }

  // ===== Tracks & Learning =====
  async listTracks(): Promise<Track[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: Track[] }>("/tracks");
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar trilhas:", error);
      throw error;
    }
  }

  async getTrack(id: string): Promise<Track & { items: TrackItem[] }> {
    try {
      const response = await this.client.get<{ success: boolean; data: Track & { items: TrackItem[] } }>(
        `/tracks/${id}`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar trilha:", error);
      throw error;
    }
  }

  async createTrack(data: { title: string; description?: string }): Promise<Track> {
    try {
      const response = await this.client.post<{ success: boolean; data: Track }>("/tracks", data);
      return response.data.data;
    } catch (error) {
      console.error("Erro ao criar trilha:", error);
      throw error;
    }
  }

  async addTrackItem(trackId: string, data: {
    type: "READING" | "ACTION" | "CHECKPOINT";
    title: string;
    content: string;
  }): Promise<TrackItem> {
    try {
      const response = await this.client.post<{ success: boolean; data: TrackItem }>(
        `/tracks/${trackId}/items`,
        data
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao adicionar item à trilha:", error);
      throw error;
    }
  }

  async publishTrack(trackId: string): Promise<Track> {
    try {
      const response = await this.client.post<{ success: boolean; data: Track }>(
        `/tracks/${trackId}/publish`
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao publicar trilha:", error);
      throw error;
    }
  }

  async assignTrackToPeople(trackId: string, personIds: string[]): Promise<{ success: boolean }> {
    try {
      const response = await this.client.post<{ success: boolean }>(
        `/tracks/${trackId}/assign`,
        { personIds }
      );
      return response.data;
    } catch (error) {
      console.error("Erro ao atribuir trilha:", error);
      throw error;
    }
  }

  // ===== Governance =====
  async getGovernanceSummary(): Promise<GovernanceSummary> {
    try {
      const response = await this.client.get<{ success: boolean; data: GovernanceSummary }>(
        "/governance/summary"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar sumário de governança:", error);
      throw error;
    }
  }

  async listGovernanceRuns(limit: number = 20): Promise<GovernanceRun[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: GovernanceRun[] }>(
        "/governance/runs",
        { params: { limit } }
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao listar execuções de governança:", error);
      throw error;
    }
  }

  async getLatestGovernanceRun(): Promise<GovernanceRun | null> {
    try {
      const response = await this.client.get<{ success: boolean; data: GovernanceRun | null }>(
        "/governance/runs/latest"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar última execução de governança:", error);
      throw error;
    }
  }

  // ===== Reports =====
  async getExecutiveReport(): Promise<ExecutiveReport> {
    try {
      const response = await this.client.get<{ success: boolean; data: ExecutiveReport }>(
        "/reports/executive-report"
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar relatório executivo:", error);
      throw error;
    }
  }

  async getExecutiveMetrics(days?: number): Promise<ExecutiveMetrics[]> {
    try {
      const response = await this.client.get<{ success: boolean; data: ExecutiveMetrics[] }>(
        "/reports/metrics",
        { params: days ? { days } : {} }
      );
      return response.data.data;
    } catch (error) {
      console.error("Erro ao buscar métricas executivas:", error);
      throw error;
    }
  }
}

export const api = new NexoGestaoAPI();
