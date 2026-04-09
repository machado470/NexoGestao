import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { canAny, type Permission } from "@/lib/rbac";
import { useIsMobile } from "@/hooks/useMobile";
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
  ChevronLeft,
  ChevronRight,
  Settings,
  History,
  MessageCircle,
  CreditCard,
  Menu,
  X,
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
    "/executive-dashboard": "Dashboard Executivo",
    "/customers": "Clientes",
    "/appointments": "Agendamentos",
    "/calendar": "Calendário",
    "/service-orders": "Ordens de Serviço",
    "/timeline": "Timeline",
    "/finances": "Financeiro",
    "/people": "Pessoas",
    "/governance": "Governança",
    "/whatsapp": "WhatsApp",
    "/settings": "Configurações",
    "/billing": "Billing",
    "/onboarding": "Jornada de Demonstração",
  };

  const exact = titles[location];
  if (exact) return exact;

  const matched = Object.entries(titles).find(
    ([route]) => location === route || location.startsWith(`${route}/`)
  );

  return matched?.[1] ?? "NexoGestão";
}

function getPageDescription(location: string) {
  const descriptions: Record<string, string> = {
    "/executive-dashboard":
      "Visão consolidada de métricas, crescimento e operação.",
    "/customers": "Base operacional de clientes e relacionamento.",
    "/appointments": "Agenda operacional e preparação da execução.",
    "/calendar": "Visão temporal da agenda e da disponibilidade.",
    "/service-orders":
      "Centro da execução e origem de todo o fluxo financeiro.",
    "/timeline": "Rastreabilidade transversal dos eventos.",
    "/finances": "Cobranças, recebimentos e fluxo financeiro.",
    "/people": "Gestão de equipe e distribuição de execução.",
    "/governance": "Regras, risco e leitura institucional.",
    "/whatsapp": "Conversa contextual vinculada à operação.",
    "/settings": "Parâmetros e ajustes do sistema.",
    "/billing": "Assinatura, quotas e monetização da organização.",
    "/onboarding": "Fluxo guiado para mostrar valor: operação, receita e governança.",
  };

  const exact = descriptions[location];
  if (exact) return exact;

  const matched = Object.entries(descriptions).find(
    ([route]) => location === route || location.startsWith(`${route}/`)
  );

  return matched?.[1] ?? "Operação, financeiro e governança no mesmo fluxo.";
}

export function MainLayout({ children }: MainLayoutProps) {
  const [location, navigate] = useLocation();
  const { role, logout, isLoggingOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuSections: MenuSection[] = [
    {
      id: "main",
      label: "Fluxo principal",
      items: [
        {
          id: "executive-dashboard",
          label: "Dashboard Executivo",
          icon: BarChart3,
          route: "/executive-dashboard",
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
          id: "finance",
          label: "Financeiro",
          icon: DollarSign,
          route: "/finances",
          permissions: ["finance:read"],
        },
        {
          id: "whatsapp",
          label: "WhatsApp",
          icon: MessageCircle,
          route: "/whatsapp",
        },
        {
          id: "timeline",
          label: "Timeline",
          icon: History,
          route: "/timeline",
          permissions: ["reports:read"],
        },
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
          icon: Users,
          route: "/people",
          permissions: ["people:manage"],
        },
        {
          id: "billing",
          label: "Billing",
          icon: CreditCard,
          route: "/billing",
          permissions: ["settings:manage"],
        },
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
    return menuSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.permissions?.length) {
            return true;
          }

          if (!role) {
            return false;
          }

          return canAny(role, item.permissions);
        }),
      }))
      .filter(section => section.items.length > 0);
  }, [role]);

  const pageTitle = useMemo(() => getPageTitle(location), [location]);
  const pageDescription = useMemo(
    () => getPageDescription(location),
    [location]
  );
  const compactContextRoutes = useMemo(
    () =>
      new Set([
        "/executive-dashboard",
        "/customers",
        "/appointments",
        "/calendar",
        "/service-orders",
        "/timeline",
        "/finances",
        "/people",
        "/governance",
        "/whatsapp",
        "/settings",
        "/billing",
      ]),
    []
  );
  const pathname = location.split("?")[0];
  const useCompactHeader =
    Array.from(compactContextRoutes).some(route => isRouteActive(pathname, route));

  useEffect(() => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile, location]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMobile) return;

    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileMenuOpen]);

  const handleNavigate = (route: string) => {
    navigate(route);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await Promise.race([
        logout(),
        new Promise((_, reject) =>
          window.setTimeout(() => reject(new Error("logout-timeout")), 5000)
        ),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "logout-timeout") {
        window.location.replace(`/login?logoutFallback=${Date.now()}`);
        return;
      }

      const message = error instanceof Error ? error.message : "Não foi possível sair agora.";
      toast.error(message);
    }
  };

  return (
    <div className="nexo-app-shell min-h-screen text-zinc-900 dark:text-zinc-100">
      <div className="flex min-h-screen w-full gap-3 p-2 md:gap-4 md:p-4">
        {isMobile && mobileMenuOpen ? (
          <button
            type="button"
            aria-label="Fechar menu lateral"
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <aside
          className={`nexo-app-panel-strong ${
            isMobile
              ? `fixed inset-y-2 left-2 z-40 h-[calc(100vh-1rem)] ${
                  mobileMenuOpen ? "translate-x-0" : "-translate-x-[110%]"
                }`
              : "sticky top-2 h-[calc(100vh-1rem)] md:top-3 md:h-[calc(100vh-1.5rem)]"
          } flex shrink-0 flex-col overflow-hidden transition-all duration-300 ${
            sidebarCollapsed && !isMobile
              ? "w-[76px]"
              : "w-[min(248px,calc(100vw-1rem))]"
          }`}
        >
          <div className="border-b border-slate-200/70 px-3 py-3 dark:border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                {!sidebarCollapsed ? (
                  <>
                    <p className="truncate text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                      NexoGestão
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      Operação com contexto
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    N
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSidebarCollapsed(prev => !prev)}
                disabled={isMobile}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <div className="flex min-h-full flex-col gap-4">
              {visibleSections.map(section => (
                <div key={section.id}>
                  {!sidebarCollapsed && (
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                      {section.label}
                    </p>
                  )}

                  <div className="space-y-1">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const active = isRouteActive(location, item.route);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.route)}
                          title={item.label}
                          className={`flex w-full items-center rounded-xl px-2.5 py-2 text-[13px] transition-colors ${
                            sidebarCollapsed ? "justify-center" : "gap-2.5"
                          } ${
                            active
                              ? "border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300"
                              : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:hover:text-white"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && (
                            <span className="truncate font-medium">
                              {item.label}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="mt-2 border-t border-slate-200/70 pt-3 dark:border-white/10">
                {!sidebarCollapsed && (
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                    Interface
                  </p>
                )}

                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`flex w-full items-center rounded-xl px-2.5 py-2 text-[13px] text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:hover:text-white ${
                    sidebarCollapsed ? "justify-center" : "gap-2.5"
                  }`}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 shrink-0" />
                  ) : (
                    <Moon className="h-4 w-4 shrink-0" />
                  )}

                  {!sidebarCollapsed && (
                    <>
                      <span className="truncate font-medium">
                        {theme === "dark" ? "Tema claro" : "Tema escuro"}
                      </span>
                      <span
                        className={`ml-auto inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                          theme === "dark" ? "bg-orange-500/80" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                            theme === "dark" ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </nav>

          <div className="border-t border-slate-200/70 p-2 dark:border-white/6">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className={`flex w-full items-center rounded-xl px-2.5 py-2 text-[13px] text-red-600 transition-colors hover:bg-red-50/90 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300 dark:focus-visible:ring-offset-[#0d1015] ${
                  sidebarCollapsed ? "justify-center" : "gap-2.5"
                }`}
                aria-busy={isLoggingOut}
              >
                <LogOut className="h-4 w-4 shrink-0" />

                {!sidebarCollapsed && (
                  <span className="truncate font-medium">Sair</span>
                )}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">
          <header className="nexo-app-panel-strong px-4 py-2.5 md:px-5 md:py-3">
            <div className="flex flex-col gap-2">
              {isMobile ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(prev => !prev)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white/85 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
                    aria-label={
                      mobileMenuOpen ? "Fechar menu lateral" : "Abrir menu lateral"
                    }
                    aria-expanded={mobileMenuOpen}
                  >
                    {mobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </button>
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    NexoGestão
                  </span>
                </div>
              ) : null}

              <Breadcrumbs />

              <div className="flex flex-col gap-0.5">
                {useCompactHeader ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
                    {pageTitle}
                  </p>
                ) : (
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-2xl">
                    {pageTitle}
                  </h1>
                )}
                <p className="max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400 md:text-sm">
                  {pageDescription}
                </p>
              </div>
            </div>
          </header>

          <main
            data-scrollbar="nexo"
            className="nexo-app-content min-h-0 flex-1 overflow-auto p-2 md:p-3"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
