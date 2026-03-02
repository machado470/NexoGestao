import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Breadcrumbs } from "./Breadcrumbs";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
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
  ChevronRight,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
  ] as const;

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>
      {/* SIDEBAR - FIXA */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
          <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            N
          </div>
          {sidebarOpen && (
            <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
              NexoGestão
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.route)}
                className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 group"
                title={item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="ml-3 text-sm font-medium flex-1 text-left">{item.label}</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-1">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Alternar tema"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 flex-shrink-0" />
            )}
            {sidebarOpen && (
              <span className="ml-3 text-sm font-medium">
                {theme === "dark" ? "Claro" : "Escuro"}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Sair"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="ml-3 text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-64" : "ml-20"} transition-all duration-300`}>
        {/* HEADER - FIXO */}
        <header className="h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 fixed top-0 right-0 left-0 z-30 transition-all duration-300"
          style={{ left: sidebarOpen ? "16rem" : "5rem" }}
        >
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
            <div className="hidden md:block">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block w-64">
              <GlobalSearch />
            </div>
            <NotificationBell />
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
              {user?.email || "Usuário"}
            </span>
            <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* CONTENT - SCROLLÁVEL */}
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-6 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
