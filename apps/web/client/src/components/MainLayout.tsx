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
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Shield,
  Sparkles,
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
import { GlobalSearch } from "@/components/GlobalSearch";
import { Breadcrumbs } from "./Breadcrumbs";
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
    title: "Centro Operacional",
    subtitle: "Prioridades, alertas e execução do dia em um único fluxo.",
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
};

function getPageMeta(location: string) {
  const exact = pageMeta[location];
  if (exact) return exact;

  const matched = Object.entries(pageMeta).find(([route]) =>
    isRouteActive(location, route)
  );

  return matched?.[1] ?? {
    title: "NexoGestão",
    subtitle: "Sistema operacional para execução, cobrança e governança.",
  };
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [location, navigate] = useLocation();
  const { role, user, logout, isLoggingOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const notifications = useNotificationStore((state) => state.notifications);
  const clearNotifications = useNotificationStore((state) => state.clear);
  const removeNotification = useNotificationStore((state) => state.remove);

  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sections: MenuSection[] = [
    {
      id: "operacao",
      label: "Operação",
      items: [
        { id: "dashboard", label: "Dashboard", route: "/executive-dashboard", icon: LayoutDashboard },
        { id: "customers", label: "Clientes", route: "/customers", icon: Users, permissions: ["customers:read"] },
        { id: "appointments", label: "Agendamentos", route: "/appointments", icon: Calendar, permissions: ["appointments:read"] },
        { id: "service-orders", label: "Ordens de Serviço", route: "/service-orders", icon: Briefcase, permissions: ["orders:read"] },
        { id: "whatsapp", label: "WhatsApp", route: "/whatsapp", icon: MessageCircle },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      items: [
        { id: "finances", label: "Financeiro", route: "/finances", icon: DollarSign, permissions: ["finance:read"] },
        { id: "billing", label: "Billing", route: "/billing", icon: CreditCard, permissions: ["settings:manage"] },
      ],
    },
    {
      id: "inteligencia",
      label: "Inteligência",
      items: [
        { id: "calendar", label: "Calendário", route: "/calendar", icon: CalendarDays, permissions: ["appointments:read"] },
        { id: "timeline", label: "Timeline", route: "/timeline", icon: History, permissions: ["reports:read"] },
        { id: "governance", label: "Governança", route: "/governance", icon: Shield, permissions: ["governance:read"] },
      ],
    },
    {
      id: "administracao",
      label: "Administração",
      items: [
        { id: "people", label: "Pessoas", route: "/people", icon: Building2, permissions: ["people:manage"] },
        { id: "settings", label: "Configurações", route: "/settings", icon: Settings, permissions: ["settings:manage"] },
      ],
    },
  ];

  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (!item.permissions?.length) return true;
            if (!role) return false;
            return canAny(role, item.permissions);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [role]
  );

  const currentMeta = useMemo(() => getPageMeta(location), [location]);

  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(false);
      setMobileMenuOpen(false);
    }
  }, [isMobile, location]);

  useEffect(() => {
    if (typeof document === "undefined" || !isMobile) return;
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileMenuOpen]);

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

      toast.error(error instanceof Error ? error.message : "Falha ao encerrar sessão.");
    }
  };

  return (
    <div className="nexo-app-shell min-h-screen text-zinc-900 dark:text-zinc-100">
      {isMobile && mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-zinc-950/45"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <div className="flex min-h-screen w-full">
        <aside
          data-scrollbar="nexo"
          className={`nexo-sidebar z-40 flex shrink-0 flex-col overflow-hidden transition-all duration-300 ${
            isMobile
              ? `fixed inset-y-0 left-0 w-[300px] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
              : sidebarCollapsed
                ? "w-[86px]"
                : "w-[280px]"
          }`}
        >
          <div className="border-b border-white/10 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleNavigate("/executive-dashboard")}
                className={`flex min-w-0 items-center ${sidebarCollapsed && !isMobile ? "justify-center" : "gap-3"}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                {!sidebarCollapsed || isMobile ? (
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-semibold text-white">NexoGestão</p>
                    <p className="truncate text-xs text-zinc-400">Workspace Operacional</p>
                  </div>
                ) : null}
              </button>

              {!isMobile ? (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((prev) => !prev)}
                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-6">
              {visibleSections.map((section) => (
                <section key={section.id} className="space-y-2">
                  {!sidebarCollapsed || isMobile ? (
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {section.label}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const active = isRouteActive(location, item.route);
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={item.label}
                          onClick={() => handleNavigate(item.route)}
                          className={`nexo-sidebar-item ${active ? "nexo-sidebar-item-active" : ""} ${
                            sidebarCollapsed && !isMobile ? "justify-center px-2" : ""
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed || isMobile ? (
                            <span className="truncate text-sm font-medium">{item.label}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={`nexo-sidebar-item w-full ${sidebarCollapsed && !isMobile ? "justify-center px-2" : ""}`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!sidebarCollapsed || isMobile ? (
                <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
              ) : null}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="nexo-topbar sticky top-0 z-20">
            <div className="flex flex-col gap-3 px-4 py-3 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen((prev) => !prev)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  ) : null}
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
                      {currentMeta.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentMeta.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                        aria-label="Notificações"
                      >
                        <Bell className="h-4 w-4" />
                        {notifications.length > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                            {Math.min(notifications.length, 9)}
                          </span>
                        ) : null}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[340px]">
                      <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Notificações</span>
                        {notifications.length > 0 ? (
                          <button
                            type="button"
                            onClick={clearNotifications}
                            className="text-xs font-medium text-orange-600 hover:text-orange-700"
                          >
                            Limpar
                          </button>
                        ) : null}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {notifications.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                          <Bell className="mx-auto h-5 w-5 text-zinc-400" />
                          <p className="mt-2 text-sm text-zinc-500">Nenhuma notificação no momento.</p>
                        </div>
                      ) : (
                        notifications.slice().reverse().slice(0, 6).map((item) => (
                          <DropdownMenuItem
                            key={item.id}
                            className="flex cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2"
                            onSelect={(evt) => {
                              evt.preventDefault();
                              item.action?.onClick();
                              removeNotification(item.id);
                            }}
                          >
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                            {item.description ? (
                              <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
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
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="hidden max-w-28 truncate md:block">{user?.name ?? "Usuário"}</span>
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <p className="text-sm font-semibold">{user?.name ?? "Usuário"}</p>
                        <p className="text-xs text-zinc-500">{user?.email ?? "Sem e-mail"}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/settings")}> 
                        <User className="mr-2 h-4 w-4" /> Perfil
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/billing")}>
                        <CreditCard className="mr-2 h-4 w-4" /> Conta e plano
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleTheme}>
                        {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />} Tema
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/contact")}> 
                        <HelpCircle className="mr-2 h-4 w-4" /> Suporte
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void handleLogout()}
                        disabled={isLoggingOut}
                        className="text-red-600 focus:text-red-600"
                      >
                        <LogOut className="mr-2 h-4 w-4" /> Sair
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Breadcrumbs />
                <div className="hidden min-w-0 flex-1 justify-end md:flex">
                  <div className="w-full max-w-lg">
                    <GlobalSearch />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/service-orders")}
                  className="hidden h-10 items-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-medium text-white hover:bg-orange-600 md:inline-flex"
                >
                  <Search className="h-4 w-4" /> Executar agora
                </button>
              </div>

              <div className="md:hidden">
                <GlobalSearch />
              </div>
            </div>
          </header>

          <main data-scrollbar="nexo" className="nexo-app-content m-3 mt-0 min-h-0 flex-1 overflow-auto md:m-4 md:mt-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
