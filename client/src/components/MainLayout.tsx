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
  MessageCircle,
  FileText,
  TrendingDown,
  ChevronLeft,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop: aberto por padrão
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // Desktop: colapso visual

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
    { id: "invoices", label: "Notas Fiscais", icon: FileText, route: "/invoices" },
    { id: "expenses", label: "Despesas", icon: TrendingDown, route: "/expenses" },
    { id: "launches", label: "Lançamentos", icon: TrendingDown, route: "/launches" },
    { id: "referrals", label: "Referências", icon: Users, route: "/referrals" },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, route: "/whatsapp" },
    { id: "people", label: "Pessoas", icon: Users, route: "/people" },
    { id: "governance", label: "Governança", icon: Shield, route: "/governance" },
  ] as const;

  const handleNavigate = (route: string) => {
    navigate(route);
    // Fechar sidebar em mobile após navegação
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>
      {/* OVERLAY - Mobile */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR - Responsivo com Colapso */}
      <aside
        className={`fixed md:relative left-0 top-0 h-screen z-40 bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-20" : "w-64 md:w-64"}`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 min-h-16">
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center w-full" : ""}`}>
            <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              N
            </div>
            {!sidebarCollapsed && (
              <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">
                NexoGestão
              </span>
            )}
          </div>
          {/* Close button - Mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className={`w-full flex items-center rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 group ${
                  sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
                }`}
                title={item.label}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
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
            className={`w-full flex items-center rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
            title="Alternar tema"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Moon className="w-5 h-5 flex-shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span className="ml-3 text-sm font-medium">
                {theme === "dark" ? "Claro" : "Escuro"}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-lg transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
            title="Sair"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="ml-3 text-sm font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        {/* HEADER - Responsivo */}
        <header className="h-16 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            >
              {sidebarOpen && window.innerWidth < 768 ? (
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : sidebarCollapsed && window.innerWidth >= 768 ? (
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <>
                  {window.innerWidth < 768 ? (
                    <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                </>
              )}
            </button>
            <div className="hidden md:block min-w-0">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <div className="hidden lg:block w-48 xl:w-64">
              <GlobalSearch />
            </div>
            <NotificationBell />
            <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden sm:block truncate max-w-[150px]">
              {user?.email || "Usuário"}
            </span>
            <div className="h-8 w-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* CONTENT AREA - Com espaço para ads */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6 md:p-8">
          {/* MAIN CONTENT - Com scroll */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto w-full px-2 md:px-4">
              {children}
            </div>
          </main>

          {/* ADS SIDEBAR - Responsivo */}
          <aside className="hidden lg:flex flex-col gap-4 w-full lg:w-80 flex-shrink-0">
            {/* Ads Banner - Vertical */}
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg shadow-lg p-6 text-white min-h-96 flex flex-col items-center justify-center text-center">
              <div className="text-sm font-semibold opacity-90 mb-2">PUBLICIDADE</div>
              <div className="text-3xl font-bold mb-4">Seu Anúncio Aqui</div>
              <p className="text-sm opacity-80">
                Espaço premium para publicidade direcionada aos seus clientes
              </p>
            </div>

            {/* Secondary Ads */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
                PROMOÇÕES
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-300">
                    Dica: Organize suas cobranças
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <p className="text-xs font-medium text-green-900 dark:text-green-300">
                    Novo: Relatórios em PDF
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* ADS BANNER - Mobile/Tablet (Horizontal) */}
        <div className="lg:hidden bg-gradient-to-r from-orange-400 to-orange-600 text-white p-4 text-center">
          <div className="text-xs font-semibold opacity-90 mb-1">PUBLICIDADE</div>
          <div className="text-sm font-bold">Seu Anúncio Aqui</div>
        </div>
      </div>
    </div>
  );
}
