import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
} from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const isDarkMode = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/");
    }
  };

  const menuItems = [
    { id: "overview", label: "Visão Geral", icon: BarChart3 },
    { id: "customers", label: "Clientes", icon: Users },
    { id: "appointments", label: "Agendamentos", icon: Calendar },
    { id: "service-orders", label: "Ordens de Serviço", icon: Briefcase },
    { id: "finance", label: "Financeiro", icon: DollarSign },
    { id: "governance", label: "Governança", icon: Shield },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen bg-gray-50 dark:bg-gray-900`}>
      <div
        className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold">
                N
              </div>
              <span className="font-bold text-gray-900 dark:text-white">NexoGestão</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            {sidebarOpen && <span className="text-sm font-medium">Tema</span>}
          </button>
          <button
            onClick={() => void handleLogout()}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-20"}`}>
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Bem-vindo, {user?.email}</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Novo</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Plataforma Ativa</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">✓</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Backend</p>
                  <p className="text-3xl font-bold text-blue-600">Pronto</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Proxy API</p>
                  <p className="text-3xl font-bold text-green-600">Configurando</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</p>
                  <p className="text-3xl font-bold text-purple-600">Online</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                      Plataforma em Desenvolvimento
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                      O proxy de API está sendo configurado para conectar com a API do NexoGestao.
                      Todas as funcionalidades estarão disponíveis em breve!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab !== "overview" && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="text-center py-12">
                <Loader className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Carregando dados da API...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
