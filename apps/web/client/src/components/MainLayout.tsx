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
  Sparkles,
  Receipt,
  History,
  Building2,
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
  badge?: string;
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

const ROUTE_META: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  "/executive-dashboard": {
    title: "Visão Geral",
    description: "Leitura executiva e panorama institucional da operação.",
  },
  "/dashboard/operations": {
    title: "Dashboard Operacional",
    description: "Leitura diária do ciclo, gargalos e ação rápida.",
  },
  "/operations": {
    title: "Workflow Operacional",
    description: "Fila prática do que está pedindo avanço agora.",
  },
  "/customers": {
    title: "Clientes",
    description: "Base operacional de relacionamento, histórico e contexto.",
  },
  "/appointments": {
    title: "Agendamentos",
    description: "Agenda operacional, confirmações e preparo da execução.",
  },
  "/calendar": {
    title: "Calendário",
    description: "Leitura temporal da agenda e da disponibilidade.",
  },
  "/service-orders": {
    title: "Ordens de Serviço",
    description: "Centro da execução, status operacional e ponte com financeiro.",
  },
  "/timeline": {
    title: "Timeline",
    description: "Rastreabilidade transversal de eventos importantes.",
  },
  "/finances": {
    title: "Financeiro",
    description: "Cobranças, recebimentos, atrasos e fechamento do fluxo.",
  },
  "/invoices": {
    title: "Faturas",
    description: "Leitura documental e gestão administrativa de emissão.",
  },
  "/expenses": {
    title: "Despesas",
    description: "Saídas financeiras e controle administrativo do custo.",
  },
  "/launches": {
    title: "Lançamentos",
    description: "Movimentos financeiros e leitura complementar do ecossistema.",
  },
  "/governance": {
    title: "Governança",
    description: "Risco, regras institucionais e leitura de conformidade.",
  },
  "/people": {
    title: "Pessoas",
    description: "Equipe, estado operacional e gestão dos vínculos humanos.",
  },
  "/referrals": {
    title: "Referências",
    description: "Apoio comercial e leitura de origem de relacionamento.",
  },
  "/whatsapp": {
    title: "WhatsApp",
    description: "Comunicação operacional e comercial com rastreabilidade.",
  },
  "/settings": {
    title: "Configurações",
    description: "Ajustes organizacionais e parâmetros do sistema.",
  },
};

function getRouteMeta(location: string) {
  const exact = ROUTE_META[location];
  if (exact) return exact;

  const matchedEntry = Object.entries(ROUTE_META).find(([route]) => {
    return route !== "/" && location.startsWith(route);
  });

  if (matchedEntry) {
    return matchedEntry[1];
  }

  return {
    title: "NexoGestão",
    description: "Operação, financeiro, governança e execução no mesmo fluxo.",
  };
}

function isRouteActive(location: string, route: string) {
  if (location === route) return true;
  if (route === "/") return location === "/";
  return location.startsWith(route);
}

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

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
    }
  }, [isMobile]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      // mantém o usuário na tela atual se o logout falhar
    }
  };

  const menuSections: MenuSection[] = [
    {
      id: "vision",
      label: "Visão",
      items: [
        {
          id: "overview",
          label: "Visão Geral",
          icon: BarChart3,
          route: "/executive-dashboard",
          allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
        },
        {
          id: "operations-dashboard",
          label: "Dashboard Operacional",
          icon: Sparkles,
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
      ],
    },
    {
      id: "operation",
      label: "Operação",
      items: [
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
          id: "calendar",
          label: "Calendário",
          icon: CalendarDays,
          route: "/calendar",
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
          id: "timeline",
          label: "Timeline",
          icon: History,
          route: "/timeline",
          allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
        },
      ],
    },
    {
      id: "finance",
      label: "Financeiro",
      items: [
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
          icon: Receipt,
          route: "/launches",
          allowedRoles: ["ADMIN", "MANAGER"],
        },
      ],
    },
    {
      id: "governance",
      label: "Governança",
      items: [
        {
          id: "governance",
          label: "Governança",
          icon: Shield,
          route: "/governance",
          allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
        },
        {
          id: "people",
          label: "Pessoas",
          icon: Building2,
          route: "/people",
          allowedRoles: ["ADMIN", "MANAGER"],
        },
        {
          id: "referrals",
          label: "Referências",
          icon: Users,
          route: "/referrals",
          allowedRoles: ["ADMIN", "MANAGER"],
        },
      ],
    },
    {
      id: "communication",
      label: "Comunicação",
      items: [
        {
          id: "whatsapp",
          label: "WhatsApp",
          icon: MessageCircle,
          route: "/whatsapp",
          allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
        },
      ],
    },
    {
      id: "system",
      label: "Sistema",
      items: [
        {
          id: "settings",
          label: "Configurações",
          icon: Settings,
          route: "/settings",
          permissions: ["settings:manage"],
        },
      ],
    },
  ];

  const visibleSections = useMemo(() => {
    if (!role) return [];

    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.allowedRoles?.length) {
            return item.allowedRoles.includes(role);
          }

          if (item.permissions?.length) {
            return canAny(role, item.permissions);
          }

          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  const currentMeta = useMemo(() => getRouteMeta(location), [location]);

  const handleNavigate = (route: string) => {
    navigate(route);

    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const userName = user?.person?.name || user?.email || "Usuário";
  const userRole = role || "Sem papel";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div
      className={`flex h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100 ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-200/80 bg-white/95 shadow-2xl backdrop-blur dark:border-zinc-800 dark:bg-[#111113]/95 md:relative ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } transition-all duration-300 ${
          sidebarCollapsed ? "md:w-24" : "w-72 md:w-72"
        }`}
      >
        <div className="border-b border-zinc-200/80 px-4 py-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div
              className={`flex items-center ${
                sidebarCollapsed ? "w-full justify-center" : ""
              }`}
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 text-base font-bold text-white shadow-lg shadow-orange-500/20">
                N
              </div>

              {!sidebarCollapsed && (
                <div className="ml-3 min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-950 dark:text-white">
                    NexoGestão
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Operação com contexto
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white md:hidden"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {visibleSections.map((section) => (
              <div key={section.id}>
                {!sidebarCollapsed && (
                  <div className="mb-2 px-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      {section.label}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(location, item.route);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={item.label}
                        onClick={() => handleNavigate(item.route)}
                        className={`group flex w-full items-center rounded-2xl transition-all ${
                          sidebarCollapsed ? "justify-center px-2 py-3" : "px-3 py-3"
                        } ${
                          active
                            ? "bg-orange-50 text-orange-700 shadow-sm dark:bg-orange-500/10 dark:text-orange-300"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 flex-shrink-0 ${
                            active
                              ? "text-orange-600 dark:text-orange-300"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        />

                        {!sidebarCollapsed && (
                          <>
                            <span className="ml-3 flex-1 text-left text-sm font-medium">
                              {item.label}
                            </span>

                            <ChevronRight
                              className={`h-4 w-4 transition-all ${
                                active
                                  ? "translate-x-0 opacity-100"
                                  : "opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100"
                              }`}
                            />
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-zinc-200/80 p-3 dark:border-zinc-800">
          {!sidebarCollapsed && (
            <div className="mb-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                {userName}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {userRole}
              </p>
            </div>
          )}

          <div className="space-y-1">
            <button
              onClick={toggleTheme}
              className={`flex w-full items-center rounded-2xl text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white ${
                sidebarCollapsed ? "justify-center px-2 py-3" : "px-3 py-3"
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
                  {theme === "dark" ? "Tema claro" : "Tema escuro"}
                </span>
              )}
            </button>

            <button
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
              className={`flex w-full items-center rounded-2xl text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 ${
                sidebarCollapsed ? "justify-center px-2 py-3" : "px-3 py-3"
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
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-[#09090b]/85">
          <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => {
                  if (isMobile) {
                    setSidebarOpen((prev) => !prev);
                  } else {
                    setSidebarCollapsed((prev) => !prev);
                  }
                }}
                className="flex-shrink-0 rounded-2xl border border-zinc-200 bg-white p-2.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                type="button"
              >
                {isMobile ? (
                  <Menu className="h-5 w-5" />
                ) : sidebarCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </button>

              <div className="hidden min-w-0 md:block">
                <Breadcrumbs />
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2 md:gap-3">
              <div className="hidden w-56 lg:block xl:w-72">
                <GlobalSearch />
              </div>

              <NotificationBell />

              <div className="hidden h-10 items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-2 py-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold text-white">
                  {userInitial}
                </div>

                <div className="max-w-[160px] text-right">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {userName}
                  </div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {userRole}
                  </div>
                </div>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-bold text-white sm:hidden">
                {userInitial}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200/70 px-4 py-4 dark:border-zinc-800 md:px-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white md:text-2xl">
                {currentMeta.title}
              </h1>
              <p className="max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
                {currentMeta.description}
              </p>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6 md:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
