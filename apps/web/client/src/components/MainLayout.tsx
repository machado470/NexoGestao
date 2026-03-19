import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { canAny, type Permission, type Role } from "@/lib/rbac";
import { Breadcrumbs } from "./Breadcrumbs";
import { GlobalSearch } from "./GlobalSearch";
import NotificationBell from "./NotificationBell";

import {
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Users,
  Calendar,
  CalendarDays,
  Briefcase,
  DollarSign,
  BarChart3,
  Shield,
  ChevronRight,
  MessageCircle,
  FileText,
  TrendingDown,
  ChevronLeft,
  Settings,
  Workflow,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  permissions?: Permission[];
  allowedRoles?: Role[];
};

export function MainLayout({ children }: MainLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, role, logout, isSubmitting } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 768);
    };

    update();
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      // mantém o usuário na tela atual se o logout falhar
    }
  };

  const menuItems: MenuItem[] = [
    {
      id: "overview",
      label: "Visão Geral",
      icon: BarChart3,
      route: "/executive-dashboard",
      allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
    },
    {
      id: "customers",
      label: "Clientes",
      icon: Users,
      route: "/customers",
      permissions: ["customers:read"],
    },
    {
      id: "appointments",
      label: "Agendamentos",
      icon: Calendar,
      route: "/appointments",
      permissions: ["appointments:read"],
    },
    {
      id: "service-orders",
      label: "Ordens de Serviço",
      icon: Briefcase,
      route: "/service-orders",
      permissions: ["orders:read"],
    },
    {
      id: "finance",
      label: "Financeiro",
      icon: DollarSign,
      route: "/finances",
      permissions: ["finance:read"],
    },
    {
      id: "invoices",
      label: "Faturas",
      icon: FileText,
      route: "/invoices",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      id: "expenses",
      label: "Despesas",
      icon: TrendingDown,
      route: "/expenses",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      id: "launches",
      label: "Lançamentos",
      icon: TrendingDown,
      route: "/launches",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      id: "referrals",
      label: "Referências",
      icon: Users,
      route: "/referrals",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      route: "/whatsapp",
      allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
    },
    {
      id: "people",
      label: "Pessoas",
      icon: Users,
      route: "/people",
      allowedRoles: ["ADMIN", "MANAGER"],
    },
    {
      id: "governance",
      label: "Governança",
      icon: Shield,
      route: "/governance",
      allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
    },
    {
      id: "calendar",
      label: "Calendário",
      icon: CalendarDays,
      route: "/calendar",
      permissions: ["appointments:read"],
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: BarChart3,
      route: "/timeline",
      allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
    },
    {
      id: "operations-dashboard",
      label: "Dashboard Operacional",
      icon: Workflow,
      route: "/dashboard/operations",
      allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
    },
    {
      id: "operations",
      label: "Workflow Operacional",
      icon: Workflow,
      route: "/operations",
      allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
    },
    {
      id: "settings",
      label: "Configurações",
      icon: Settings,
      route: "/settings",
      permissions: ["settings:manage"],
    },
  ];

  const visibleMenuItems = useMemo(() => {
    if (!role) return [];

    return menuItems.filter((item) => {
      if (item.allowedRoles?.length) {
        return item.allowedRoles.includes(role);
      }

      if (item.permissions?.length) {
        return canAny(role, item.permissions);
      }

      return true;
    });
  }, [role]);

  const handleNavigate = (route: string) => {
    navigate(route);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${theme === "dark" ? "dark" : ""}`}>
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-200 bg-white shadow-lg transition-all duration-300 dark:border-gray-700 dark:bg-gray-800 md:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${sidebarCollapsed ? "md:w-20" : "w-64 md:w-64"}`}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div className={`flex items-center ${sidebarCollapsed ? "w-full justify-center" : ""}`}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500 text-xl font-bold text-white">
              N
            </div>

            {!sidebarCollapsed && (
              <span className="ml-3 whitespace-nowrap text-lg font-bold text-gray-900 dark:text-white">
                NexoGestão
              </span>
            )}
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
            type="button"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location === item.route ||
              (item.route !== "/dashboard" && location.startsWith(item.route));

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.route)}
                className={`group flex w-full items-center rounded-lg transition-colors ${
                  sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
                } ${
                  isActive
                    ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                    : "text-gray-600 hover:bg-orange-50 hover:text-orange-600 dark:text-gray-300 dark:hover:bg-orange-900/20 dark:hover:text-orange-400"
                }`}
                title={item.label}
                type="button"
              >
                <Icon className="h-5 w-5 flex-shrink-0" />

                {!sidebarCollapsed && (
                  <>
                    <span className="ml-3 flex-1 text-left text-sm font-medium">
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-gray-200 p-2 dark:border-gray-700">
          <button
            onClick={toggleTheme}
            className={`flex w-full items-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
            type="button"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 flex-shrink-0" />
            ) : (
              <Moon className="h-5 w-5 flex-shrink-0" />
            )}

            {!sidebarCollapsed && (
              <span className="ml-3 text-sm font-medium">
                {theme === "dark" ? "Claro" : "Escuro"}
              </span>
            )}
          </button>

          <button
            onClick={() => void handleLogout()}
            disabled={isSubmitting}
            className={`flex w-full items-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20 ${
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-2"
            }`}
            type="button"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />

            {!sidebarCollapsed && (
              <span className="ml-3 text-sm font-medium">
                {isSubmitting ? "Saindo..." : "Sair"}
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
            <button
              onClick={() => {
                if (isMobile) {
                  setSidebarOpen(!sidebarOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              type="button"
            >
              {isMobile ? (
                <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            <div className="hidden min-w-0 md:block">
              <Breadcrumbs />
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 md:gap-4">
            <div className="hidden w-48 lg:block xl:w-64">
              <GlobalSearch />
            </div>

            <NotificationBell />

            <div className="hidden text-right sm:block">
              <div className="max-w-[150px] truncate text-sm text-gray-700 dark:text-gray-300">
                {user?.person?.name || user?.email || "Usuário"}
              </div>
              <div className="max-w-[150px] truncate text-xs text-gray-500 dark:text-gray-400">
                {role || "Sem papel"}
              </div>
            </div>

            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
              {(user?.person?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-hidden p-3 md:flex-row md:p-8">
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-3 md:px-4">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
