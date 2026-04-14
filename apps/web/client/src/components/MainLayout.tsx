import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  Shield,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { canAny, type Permission } from "@/lib/rbac";
import { useIsMobile } from "@/hooks/useMobile";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAutomationRunner } from "@/hooks/useAutomationRunner";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  NexoAppShell,
  NexoMainContainer,
  NexoSidebar,
  NexoTopbar,
} from "@/components/design-system";
import { BrandSignature } from "@/components/BrandSignature";
import { AppShell } from "@/components/AppShell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MenuItem = {
  id: string;
  label: string;
  route: string;
  icon: React.ComponentType<{ className?: string }>;
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

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/executive-dashboard": {
    title: "Dashboard",
    subtitle: "",
  },
  "/customers": {
    title: "Clientes",
    subtitle: "Relacionamento, contexto e próxima ação por cliente.",
  },
  "/appointments": {
    title: "Agendamentos",
    subtitle: "Confirmação, pontualidade e entrada do fluxo operacional.",
  },
  "/calendar": {
    title: "Calendário",
    subtitle: "Visão temporal para distribuir capacidade de execução.",
  },
  "/service-orders": {
    title: "Ordens de Serviço",
    subtitle: "Pipeline operacional com prioridade, estágio e ação.",
  },
  "/finances": {
    title: "Financeiro",
    subtitle: "Cobrança, recebimento e risco financeiro operacional.",
  },
  "/whatsapp": {
    title: "WhatsApp",
    subtitle: "Canal de execução conectado ao contexto de operação.",
  },
  "/timeline": {
    title: "Timeline",
    subtitle: "Rastreabilidade completa dos eventos críticos.",
  },
  "/governance": {
    title: "Governança",
    subtitle: "Leitura de risco, políticas e estado institucional.",
  },
  "/people": {
    title: "Pessoas",
    subtitle: "Times, distribuição de carga e capacidade operacional.",
  },
  "/billing": {
    title: "Billing",
    subtitle: "Plano, limites e saúde comercial da conta.",
  },
  "/settings": {
    title: "Configurações",
    subtitle: "Parâmetros globais da organização e preferências.",
  },
  "/profile": {
    title: "Perfil",
    subtitle: "Identidade, permissões e contexto operacional do usuário.",
  },
};

function getPageMeta(location: string) {
  const exact = pageMeta[location];
  if (exact) return exact;

  const matched = Object.entries(pageMeta).find(([route]) =>
    isRouteActive(location, route)
  );

  return (
    matched?.[1] ?? {
      title: "NexoGestão",
      subtitle: "Sistema operacional para execução, cobrança e governança.",
    }
  );
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // KPI/top-metrics são definidos por página (dashboard forte, módulos contextuais).
  // O layout principal não deve injetar cards globais para evitar regressão estrutural.
  const [location, navigate] = useLocation();
  const { role, user, logout, isLoggingOut, loading, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const notifications = useNotificationStore(state => state.notifications);
  const clearNotifications = useNotificationStore(state => state.clear);
  const removeNotification = useNotificationStore(state => state.remove);

  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useAutomationRunner({ navigate, enabled: isAuthenticated });

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info("[LAYOUT] MainLayout mounted", {
      pathname: location,
      hasChildren: Boolean(children),
      loading,
      isAuthenticated,
      userId: user?.id ?? null,
    });
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.log("[boot] MainLayout mounted");
    return () => {
      // eslint-disable-next-line no-console
      console.log("[boot] MainLayout unmounted");
    };
  }, []);

  const sections: MenuSection[] = [
    {
      id: "operacao",
      label: "Operação",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          route: "/executive-dashboard",
          icon: LayoutDashboard,
        },
        {
          id: "customers",
          label: "Clientes",
          route: "/customers",
          icon: Users,
          permissions: ["customers:read"],
        },
        {
          id: "appointments",
          label: "Agendamentos",
          route: "/appointments",
          icon: Calendar,
          permissions: ["appointments:read"],
        },
        {
          id: "service-orders",
          label: "Ordens de Serviço",
          route: "/service-orders",
          icon: Briefcase,
          permissions: ["orders:read"],
        },
        {
          id: "whatsapp",
          label: "WhatsApp",
          route: "/whatsapp",
          icon: MessageCircle,
        },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      items: [
        {
          id: "finances",
          label: "Financeiro",
          route: "/finances",
          icon: DollarSign,
          permissions: ["finance:read"],
        },
        {
          id: "billing",
          label: "Billing",
          route: "/billing",
          icon: CreditCard,
          permissions: ["settings:manage"],
        },
      ],
    },
    {
      id: "inteligencia",
      label: "Inteligência",
      items: [
        {
          id: "calendar",
          label: "Calendário",
          route: "/calendar",
          icon: CalendarDays,
          permissions: ["appointments:read"],
        },
        {
          id: "timeline",
          label: "Timeline",
          route: "/timeline",
          icon: History,
          permissions: ["reports:read"],
        },
        {
          id: "governance",
          label: "Governança",
          route: "/governance",
          icon: Shield,
          permissions: ["governance:read"],
        },
      ],
    },
    {
      id: "administracao",
      label: "Administração",
      items: [
        {
          id: "people",
          label: "Pessoas",
          route: "/people",
          icon: Building2,
          permissions: ["people:manage"],
        },
        {
          id: "profile",
          label: "Perfil",
          route: "/profile",
          icon: User,
        },
        {
          id: "settings",
          label: "Configurações",
          route: "/settings",
          icon: Settings,
        },
      ],
    },
  ];

  const visibleSections = useMemo(
    () =>
      sections
        .map(section => ({
          ...section,
          items: section.items.filter(item => {
            if (!item.permissions?.length) return true;
            if (!role) return false;
            return canAny(role, item.permissions);
          }),
        }))
        .filter(section => section.items.length > 0),
    [role]
  );

  const currentMeta = useMemo(() => getPageMeta(location), [location]);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
      setMobileMenuOpen(false);
    }
  }, [isMobile, location]);

  const handleNavigate = (route: string) => {
    navigate(route);
    if (isMobile) setMobileMenuOpen(false);
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

      toast.error(
        error instanceof Error ? error.message : "Falha ao encerrar sessão."
      );
    }
  };

  return (
    <AppShell>
      <NexoAppShell
        className={`nexo-app app-root ${theme === "dark" ? "dark" : ""} min-h-screen text-[var(--text-primary)]`}
        data-theme={theme}
      >
        {isMobile && mobileMenuOpen ? (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--background-base)_84%,black)]/70 backdrop-blur-sm nexo-state-transition"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <div className="flex min-h-screen w-full">
          <NexoSidebar
            data-scrollbar="nexo"
            className={`nexo-sidebar z-40 flex shrink-0 flex-col overflow-hidden nexo-state-transition ${
              isMobile
                ? `fixed inset-y-0 left-0 w-[304px] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
                : `fixed inset-y-0 left-0 ${sidebarCollapsed ? "w-[92px]" : "w-[286px]"}`
            }`}
          >
            <div className="nexo-sidebar-header border-b border-[var(--border)] px-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleNavigate("/executive-dashboard")}
                  className={`flex min-w-0 items-center ${sidebarCollapsed && !isMobile ? "justify-center" : ""}`}
                >
                  <BrandSignature compact={sidebarCollapsed && !isMobile} />
                </button>

                {!isMobile ? (
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                  >
                    {sidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronLeft className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-5">
                {visibleSections.map(section => (
                  <section key={section.id} className="space-y-2">
                    {!sidebarCollapsed || isMobile ? (
                      <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                        {section.label}
                      </p>
                    ) : null}
                    <div className="space-y-1">
                      {section.items.map(item => {
                        const active = isRouteActive(location, item.route);
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            onClick={() => handleNavigate(item.route)}
                            className={`nexo-sidebar-item group nexo-state-transition ${active ? "nexo-sidebar-item-active" : ""} ${
                              sidebarCollapsed && !isMobile
                                ? "justify-center px-2"
                                : ""
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                active
                                  ? "text-[var(--text-primary)]"
                                  : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                              }`}
                            />
                            {!sidebarCollapsed || isMobile ? (
                              <span className="truncate text-sm font-medium">
                                {item.label}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </nav>

            <div className="border-t border-[var(--border)] p-3">
              <button
                type="button"
                onClick={toggleTheme}
                className={`nexo-sidebar-item w-full ${sidebarCollapsed && !isMobile ? "justify-center px-2" : ""}`}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {!sidebarCollapsed || isMobile ? (
                  <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
                ) : null}
              </button>
            </div>
          </NexoSidebar>

          <div
            className={`flex min-w-0 flex-1 flex-col ${!isMobile ? (sidebarCollapsed ? "md:ml-[92px]" : "md:ml-[286px]") : ""}`}
          >
            <NexoTopbar className="z-20 nexo-state-transition">
              <div className="nexo-topbar-grid">
                <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-3">
                  <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
                    {isMobile ? (
                      <button
                        type="button"
                        onClick={() => setMobileMenuOpen(prev => !prev)}
                        className="nexo-topbar-control"
                      >
                        <Menu className="h-5 w-5" />
                      </button>
                    ) : null}
                    <div className="nexo-topbar-meta min-w-0">
                      <p className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)] md:text-lg">
                        {currentMeta.title}
                      </p>
                      {currentMeta.subtitle ? (
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {currentMeta.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0 md:px-1">
                    <GlobalSearch />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="nexo-topbar-control relative"
                          aria-label="Notificações"
                        >
                          <Bell className="h-4 w-4" />
                          {notifications.length > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--text-primary)]">
                              {Math.min(notifications.length, 9)}
                            </span>
                          ) : null}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[360px] nexo-floating-panel"
                      >
                        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
                          <span>Notificações</span>
                          {notifications.length > 0 ? (
                            <button
                              type="button"
                              onClick={clearNotifications}
                              className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
                            >
                              Limpar
                            </button>
                          ) : null}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notifications.length === 0 ? (
                          <div className="px-3 py-8 text-center">
                            <Bell className="mx-auto h-5 w-5 text-[var(--text-muted)]" />
                            <p className="mt-2 text-sm text-[var(--text-muted)]">
                              Nenhuma notificação no momento.
                            </p>
                          </div>
                        ) : (
                          notifications
                            .slice()
                            .reverse()
                            .slice(0, 6)
                            .map(item => (
                              <DropdownMenuItem
                                key={item.id}
                                className="flex cursor-pointer flex-col items-start gap-1 rounded-xl px-3 py-2"
                                onSelect={evt => {
                                  evt.preventDefault();
                                  item.action?.onClick();
                                  removeNotification(item.id);
                                }}
                              >
                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                  {item.title}
                                </p>
                                {item.description ? (
                                  <p className="line-clamp-2 text-xs text-[var(--text-muted)]">
                                    {item.description}
                                  </p>
                                ) : null}
                              </DropdownMenuItem>
                            ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="nexo-topbar-control h-9 px-2"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)]">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="hidden max-w-28 truncate md:block">
                            {user?.name ?? "Usuário"}
                          </span>
                          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 p-1">
                        <DropdownMenuLabel className="px-2 py-1.5">
                          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {user?.name ?? "Usuário"}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {user?.email ?? "Sem e-mail"}
                          </p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="h-8 rounded-md px-2 text-sm text-[var(--text-secondary)] focus:text-[var(--text-primary)]"
                          onClick={() => navigate("/profile")}
                        >
                          <User className="mr-2 h-4 w-4" /> Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="h-8 rounded-md px-2 text-sm text-[var(--text-secondary)] focus:text-[var(--text-primary)]"
                          onClick={toggleTheme}
                        >
                          {theme === "dark" ? (
                            <Sun className="mr-2 h-4 w-4" />
                          ) : (
                            <Moon className="mr-2 h-4 w-4" />
                          )}{" "}
                          Tema
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void handleLogout()}
                          disabled={isLoggingOut}
                          className="h-8 rounded-md px-2 text-sm text-[var(--danger)] focus:text-[var(--danger)]"
                        >
                          <LogOut className="mr-2 h-4 w-4" /> Sair
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </NexoTopbar>

            <NexoMainContainer>
              {children}
            </NexoMainContainer>
          </div>
        </div>
      </NexoAppShell>
    </AppShell>
  );
}
