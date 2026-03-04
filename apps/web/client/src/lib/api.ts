import axios, { AxiosInstance } from "axios";

// Tipos básicos para a API
export interface DashboardMetrics {
  totalCustomers: number;
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
}

export interface ChargesStatus {
  pending: number;
  paid: number;
  overdue: number;
  cancelled: number;
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

class NexoGestaoAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "/api",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Interceptor para adicionar token se necessário
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // ===== Reports =====
  async getExecutiveReport(): Promise<ExecutiveReport> {
    try {
      const response = await this.client.get<{ success: boolean; data: ExecutiveReport }>("/reports/executive");
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

  // ===== Dashboard =====
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const response = await this.client.get<DashboardMetrics>("/dashboard/metrics");
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar métricas do dashboard:", error);
      throw error;
    }
  }

  async getDashboardRevenue(): Promise<RevenueData[]> {
    try {
      const response = await this.client.get<RevenueData[]>("/dashboard/revenue");
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar dados de faturamento:", error);
      throw error;
    }
  }

  async getDashboardGrowth(): Promise<CustomerGrowthData[]> {
    try {
      const response = await this.client.get<CustomerGrowthData[]>("/dashboard/growth");
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar dados de crescimento:", error);
      throw error;
    }
  }

  async getDashboardServiceOrdersStatus(): Promise<ServiceOrdersStatus> {
    try {
      const response = await this.client.get<ServiceOrdersStatus>("/dashboard/service-orders-status");
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar status das ordens de serviço:", error);
      throw error;
    }
  }

  async getDashboardChargesStatus(): Promise<ChargesStatus> {
    try {
      const response = await this.client.get<ChargesStatus>("/dashboard/charges-status");
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar status das cobranças:", error);
      throw error;
    }
  }
}

export const api = new NexoGestaoAPI();
