import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Users,
  Calendar,
  Briefcase,
  DollarSign,
  BarChart3,
  Shield,
  Settings,
  ChevronDown,
  Plus,
  Loader,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

import { CreateCustomerModal } from "@/components/CreateCustomerModal";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { CreateServiceOrderModal } from "@/components/CreateServiceOrderModal";
import { useTheme } from "@/contexts/ThemeContext";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [showCreateServiceOrder, setShowCreateServiceOrder] = useState(false);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);

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

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuItems = [
    { id: "overview", label: "Visão Geral", icon: BarChart3, route: "/executive-dashboard" },
    { id: "customers", label: "Clientes", icon: Users, route: "/customers" },
    { id: "appointments", label: "Agendamentos", icon: Calendar, route: "/appointments" },
    { id: "service-orders", label: "Ordens de Serviço", icon: Briefcase, route: "/service-orders" },
    { id: "finance", label: "Financeiro", icon: DollarSign, route: "/finances" },
    { id: "people", label: "Pessoas", icon: Users, route: "/people" },
    { id: "governance", label: "Governança", icon: Shield, route: "/governance" },
    { id: "settings", label: "Configurações", icon: Settings, route: "#" },
  ] as const;

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-center md:justify-start border-b border-gray-200 dark:border-gray-700">
          <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
            N
          </div>
          {sidebarOpen && <span className="ml-3 text-lg font-bold">NexoGestão</span>}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4">
          <ul className="space-y-2 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      if (item.route && item.route !== "#") {
                        navigate(item.route);
                      } else {
                        setActiveTab(item.id);
                      }
                    }}
                    className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? "bg-orange-500 text-white"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5" />
                    {sidebarOpen && <span className="ml-3">{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Version */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">v1.0.0</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
              <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Bem-vindo ao NexoGestão
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Bem-vindo, {user?.email}
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Clientes
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        0
                      </p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500 opacity-20" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Agendamentos
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        0
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-orange-500 opacity-20" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Ordens de Serviço
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        0
                      </p>
                    </div>
                    <Briefcase className="w-8 h-8 text-green-500 opacity-20" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Receita
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        R$ 0
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-purple-500 opacity-20" />
                  </div>
                </div>
              </div>

              {/* Welcome Card */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow p-8 text-white">
                <h3 className="text-2xl font-bold mb-2">
                  Comece a usar o NexoGestão
                </h3>
                <p className="mb-4 opacity-90">
                  Centralize clientes, agendamentos, ordens de serviço e finanças em uma única plataforma.
                </p>
                <Button 
                  onClick={() => setShowCreateCustomer(true)}
                  className="bg-white text-orange-600 hover:bg-gray-100"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Cliente
                </Button>
              </div>
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === "customers" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Clientes
                </h2>
                <Button 
                  onClick={() => setShowCreateCustomer(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cliente
                </Button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum cliente cadastrado ainda.
                </p>
              </div>
            </div>
          )}

          {/* Appointments Tab */}
          {activeTab === "appointments" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Agendamentos
                </h2>
                <Button 
                  onClick={() => setShowCreateAppointment(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Agendamento
                </Button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum agendamento cadastrado ainda.
                </p>
              </div>
            </div>
          )}

          {/* Service Orders Tab */}
          {activeTab === "service-orders" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Ordens de Serviço
                </h2>
                <Button 
                  onClick={() => setShowCreateServiceOrder(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Ordem
                </Button>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhuma ordem de serviço cadastrada ainda.
                </p>
              </div>
            </div>
          )}

          {/* Finance Tab */}
          {activeTab === "finance" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Financeiro
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhuma cobrança cadastrada ainda.
                </p>
              </div>
            </div>
          )}

          {/* People Tab */}
          {activeTab === "people" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Pessoas
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhuma pessoa cadastrada ainda.
                </p>
              </div>
            </div>
          )}

          {/* Governance Tab */}
          {activeTab === "governance" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Governança
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <p className="text-gray-600 dark:text-gray-400">
                  Nenhum dado de governança disponível.
                </p>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Configurações
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Informações da Organização
                    </h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Organização: {user?.name || "Sem nome"}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          ID: {user?.id || "N/A"}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          Usuário: {user?.email}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Email: {user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Preferências
                    </h3>
                    <div className="flex items-center justify-between">
                      <label className="text-gray-700 dark:text-gray-300">
                        Tema Escuro
                      </label>
                      <button
                        onClick={toggleTheme}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          theme === "dark" ? "bg-orange-500" : "bg-gray-300"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            theme === "dark" ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        onSuccess={() => {
          // Refresh customers list
        }}
      />

      <CreateAppointmentModal
        isOpen={showCreateAppointment}
        onClose={() => setShowCreateAppointment(false)}
        onSuccess={() => {
          // Refresh appointments list
        }}
        customers={customers}
      />

      <CreateServiceOrderModal
        isOpen={showCreateServiceOrder}
        onClose={() => setShowCreateServiceOrder(false)}
        onSuccess={() => {
          // Refresh service orders list
        }}
        customers={customers}
      />
    </div>
  );
}
