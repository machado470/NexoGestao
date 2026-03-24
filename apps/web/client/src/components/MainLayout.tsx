import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { canAny, type Permission } from "@/lib/rbac";
import { Breadcrumbs } from "./Breadcrumbs";
import {
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
  ChevronLeft,
  Settings,
  Workflow,
  Sparkles,
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
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

function isRouteActive(location: string, route: string) {
  return location === route || location.startsWith(`${route}/`);
}

function getPageTitle(location: string) {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/executive-dashboard": "Dashboard Executivo",
    "/executive-dashboard-new": "Dashboard Executivo",
    "/dashboard/operations": "Dashboard Operacional",
    "/operations": "Workflow Operacional",
    "/customers": "Clientes",
    "/appointments": "Agendamentos",
    "/calendar": "Calendário",
    "/service-orders": "Ordens de Serviço",
    "/timeline": "Timeline",
    "/finances": "Financeiro",
    "/governance": "Governança",
    "/people": "Pessoas",
    "/whatsapp": "WhatsApp",
    "/settings": "Configurações",
  };

  const exact = titles[location];
  if (exact) return exact;

  const matched = Object.entries(titles).find(([route]) =>
    location === route || location.startsWith(`${route}/`)
  );

  return matched?.[1] ?? "NexoGestão";
}

function getPageDescription(location: string) {
  const descriptions: Record<string, string> = {
    "/dashboard": "Visão geral da operação.",
    "/executive-dashboard": "Visão consolidada de métricas, crescimento e operação.",
    "/executive-dashboard-new": "Visão consolidada de métricas, crescimento e operação.",
    "/dashboard/operations": "Leitura diária do ciclo operacional e dos gargalos.",
    "/operations": "Fila prática do que precisa avançar agora.",
    "/customers": "Base operacional de clientes e relacionamento.",
    "/appointments": "Agenda operacional e preparação da execução.",
    "/calendar": "Visão temporal da agenda e da disponibilidade.",
    "/service-orders": "Centro da execução operacional.",
    "/timeline": "Rastreabilidade transversal dos eventos.",
    "/finances": "Cobranças, recebimentos e fluxo financeiro.",
    "/governance": "Regras, risco e leitura institucional.",
    "/people": "Gestão da equipe e dos vínculos.",
    "/whatsapp": "Comunicação operacional com contexto.",
    "/settings": "Parâmetros e ajustes do sistema.",
  };

  const exact = descriptions[location];
  if (exact) return exact;

  const matched = Object.entries(descriptions).find(([route]) =>
    location === route || location.startsWith(`${route}/`)
  );

  return matched?.[1] ?? "Operação, financeiro e governança no mesmo fluxo.";
}

export function MainLayout({ children }: MainLayoutProps) {
  const [location, navigate] = useLocation();
  const { role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        },
        {
          id: "operations-dashboard",
          label: "Dashboard Operacional",
          icon: Sparkles,
          route: "/dashboard/operations",
        },
        {
          id: "operations",
          label: "Workflow Operacional",
          icon: Workflow,
          route: "/operations",
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
          permissions: ["reports:read"],
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
          permissions: ["governance:read"],
        },
        {
          id: "people",
          label: "Pessoas",
          icon: Building2,
          route: "/people",
          permissions: ["people:manage"],
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
          if (item.permissions?.length) {
            return canAny(role, item.permissions);
          }
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  const pageTitle = useMemo(() => getPageTitle(location), [location]);
  const pageDescription = useMemo(() => getPageDescription(location), [location]);

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <aside
        className={`flex shrink-0 flex-col border-r border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-[#111113] ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            {!sidebarCollapsed ? (
              <>
                <p className="truncate text-base font-semibold text-zinc-950 dark:text-white">
                  NexoGestão
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  Operação com contexto
                </p>
              </>
            ) : (
              <p className="text-base font-semibold text-zinc-950 dark:text-white">N</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {visibleSections.map((section) => (
              <div key={section.id}>
                {!sidebarCollapsed && (
                  <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {section.label}
                  </p>
                )}

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(location, item.route);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.route)}
                        title={item.label}
                        className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${
                          sidebarCollapsed ? "justify-center" : "gap-3"
                        } ${
                          active
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="space-y-1">
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white ${
                sidebarCollapsed ? "justify-center" : "gap-3"
              }`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 shrink-0" />
              ) : (
                <Moon className="h-4 w-4 shrink-0" />
              )}
              {!sidebarCollapsed && (
                <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 ${
                sidebarCollapsed ? "justify-center" : "gap-3"
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-[#09090b]/85 md:px-6">
          <div className="flex flex-col gap-3">
            <Breadcrumbs />

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {pageDescription}
              </p>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-auto bg-zinc-50 p-4 dark:bg-[#09090b] md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
