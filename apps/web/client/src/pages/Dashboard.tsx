import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { CreateCustomerModal } from "@/components/CreateCustomerModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { CreateServiceOrderModal } from "@/components/CreateServiceOrderModal";

interface KPIs {
  customers: {
    total: number;
    active: number;
    inactive: number;
  };
  appointments: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  serviceOrders: {
    total: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    collectionRate: number;
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateServiceOrder, setShowCreateServiceOrder] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);

  // Queries
  const kpisQuery = trpc.dashboard.dashboard.kpis.useQuery(undefined);
  const customersQuery = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 });

  useEffect(() => {
    if (customersQuery.data) {
      const response = customersQuery.data as any;
      setCustomers(response.data || []);
    }
  }, [customersQuery.data]);

  useEffect(() => {
    if (kpisQuery.data) {
      setKpis(kpisQuery.data as KPIs);
    }
  }, [kpisQuery.data]);

  // Proteger acesso a user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Carregando...
          </h1>
          <Loader className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Bem-vindo ao NexoGestão
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Bem-vindo, {user?.email}
        </p>
      </div>

      {/* KPIs Grid - Responsivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Clientes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Total de Clientes
              </p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {kpisQuery.isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  kpis?.customers.total || 0
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {kpis?.customers.active || 0} ativos
              </p>
            </div>
          </div>
        </div>

        {/* Agendamentos */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Agendamentos
              </p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {kpisQuery.isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  kpis?.appointments.total || 0
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {kpis?.appointments.completed || 0} concluídos
              </p>
            </div>
          </div>
        </div>

        {/* Ordens de Serviço */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Ordens de Serviço
              </p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {kpisQuery.isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  kpis?.serviceOrders.total || 0
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {kpis?.serviceOrders.completed || 0} concluídas
              </p>
            </div>
          </div>
        </div>

        {/* Receita Total */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Receita Total
              </p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {kpisQuery.isLoading ? (
                  <Loader className="w-6 h-6 animate-spin" />
                ) : (
                  `R$ ${(kpis?.revenue.total || 0).toFixed(2)}`
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {kpis?.revenue.collectionRate || 0}% coletado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button
          onClick={() => setShowCreateCustomer(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white h-12 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Cliente
        </Button>
        <Button
          onClick={() => setShowCreateAppointment(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white h-12 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Agendamento
        </Button>
        <Button
          onClick={() => setShowCreateServiceOrder(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white h-12 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Ordem de Serviço
        </Button>
      </div>

      {/* Receita Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Receita Paga
              </p>
              <h3 className="text-2xl font-bold text-green-600 mt-2">
                R$ {(kpis?.revenue.paid || 0).toFixed(2)}
              </h3>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Receita Pendente
              </p>
              <h3 className="text-2xl font-bold text-yellow-600 mt-2">
                R$ {(kpis?.revenue.pending || 0).toFixed(2)}
              </h3>
            </div>
            <TrendingDown className="w-10 h-10 text-yellow-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Receita Vencida
              </p>
              <h3 className="text-2xl font-bold text-red-600 mt-2">
                R$ {(kpis?.revenue.overdue || 0).toFixed(2)}
              </h3>
            </div>
            <TrendingDown className="w-10 h-10 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Modais */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onSuccess={() => {
          customersQuery.refetch();
          kpisQuery.refetch();
        }}
      />
      <CreateAppointmentModal
        isOpen={showCreateAppointment}
        onClose={() => setShowCreateAppointment(false)}
        onSuccess={() => {
          kpisQuery.refetch();
        }}
        customers={customers}
      />
      <CreateServiceOrderModal
        isOpen={showCreateServiceOrder}
        onClose={() => setShowCreateServiceOrder(false)}
        onSuccess={() => {
          kpisQuery.refetch();
        }}
        customers={customers}
      />
    </div>
  );
}
