import { NotificationCenter } from "@/components/NotificationCenter";
import { useNotificationStore } from "@/stores/notificationStore";
import { requestAppNavigation } from "@/lib/navigation-guard";
import { MobileAppNavigation } from "@/components/MobileAppNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  isPremiumSkinEnabled,
  premiumSkinAttribute,
  useDocumentPremiumSkin,
} from "@/theme/premium/flag";
import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  ReceiptText,
  HeartPulse,
  CreditCard,
  DollarSign,
  History,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
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
import { canAny, type Permission, type Role } from "@/lib/rbac";
import { useIsMobile } from "@/hooks/useMobile";
import {
  MAIN_CONTENT_ID,
  SIDEBAR_MOBILE_BREAKPOINT,
  SIDEBAR_NAV_ID,
  SIDEBAR_PUSH_BREAKPOINT,
  resolveInitialSidebarCollapsed,
  resolveSidebarLayout,
  resolveSidebarMode,
  resolveSidebarToggleA11y,
  type SidebarMode,
} from "@/components/sidebarLayout";
import { trpc } from "@/lib/trpc";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BrandSignature } from "@/components/BrandSignature";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { isSafeNotificationRouteHint } from "../../../../../packages/common/src/notification-route";
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
  requiredRoles?: Role[];
};

type MenuSection = {
  id: string;
  label: string;
  items: MenuItem[];
};

function isRouteActive(location: string, route: string) {
  return location === route || location.startsWith(`${route}/`);
}

interface MainLayoutProps {
  children: React.ReactNode;
}

// In-memory only (not persisted): survives the per-route MainLayout remount,
// resets on reload.
let rememberedPushSidebarExpanded = false;

function useViewportSidebarMode(): SidebarMode {
  const [mode, setMode] = useState<SidebarMode>(() =>
    typeof window === "undefined" ? "overlay" : resolveSidebarMode(window.innerWidth)
  );

  useEffect(() => {
    const queries = [SIDEBAR_MOBILE_BREAKPOINT, SIDEBAR_PUSH_BREAKPOINT].map(width =>
      window.matchMedia(`(min-width: ${width}px)`)
    );
    const update = () => setMode(resolveSidebarMode(window.innerWidth));
    update();
    queries.forEach(query => query.addEventListener("change", update));
    return () => queries.forEach(query => query.removeEventListener("change", update));
  }, []);

  return mode;
}

export function MainLayout({ children }: MainLayoutProps) {
  // KPI/top-metrics são definidos por página (dashboard forte, módulos contextuais).
  // O layout principal não deve injetar cards globais para evitar regressão estrutural.
  const [location, navigate] = useLocation();
  const { role, user, logout, isLoggingOut, loading, isAuthenticated } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
  const premiumSkin = isPremiumSkinEnabled();
  useDocumentPremiumSkin(premiumSkin);
  const trpcUtils = trpc.useUtils();
  const notificationQuery = trpc.dashboard.notificationCenter.list.useQuery(
    { page: 1, limit: 6, category: "all" },
    { enabled: isAuthenticated, retry: false },
  );
  const readingNotifications = useRef(new Set<string>());
  const [notificationReadState, setNotificationReadState] = useState<Record<string, "pending" | "error">>({});
  const clearNotificationReadState = (id: string) => setNotificationReadState(previous => {
    const next = { ...previous };
    delete next[id];
    return next;
  });
  const markNotificationRead = trpc.dashboard.notificationCenter.markAsRead.useMutation({
    onSuccess: (_result, input) => {
      clearNotificationReadState(input.id);
      void Promise.allSettled([
        trpcUtils.dashboard.notificationCenter.list.invalidate(),
        trpcUtils.dashboard.notificationCenter.unreadCount.invalidate(),
        trpcUtils.dashboard.notifications.invalidate(),
      ]);
    },
    onError: (_error, input) => {
      setNotificationReadState(previous => ({ ...previous, [input.id]: "error" }));
    },
    onSettled: (_result, _error, input) => {
      readingNotifications.current.delete(input.id);
    },
  });
  const markRead = (id: string) => {
    if (readingNotifications.current.has(id)) return;
    readingNotifications.current.add(id);
    setNotificationReadState(previous => ({ ...previous, [id]: "pending" }));
    markNotificationRead.mutate({ id });
  };
  const persistentNotifications = notificationQuery.data?.items ?? [];
  const unreadCount = notificationQuery.data?.unreadCount;
  const localNotificationCount = useNotificationStore(state => state.notifications.length);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const notificationStreamStatus = useNotificationStream(isAuthenticated, () => {
    void Promise.all([
      trpcUtils.dashboard.notificationCenter.list.invalidate(),
      trpcUtils.dashboard.notificationCenter.unreadCount.invalidate(),
      trpcUtils.dashboard.notifications.invalidate(),
    ]);
  });

  const isMobile = useIsMobile();
  const viewportSidebarMode = useViewportSidebarMode();
  // Starts collapsed on load; only in push mode (>=1280px) an expanded sidebar
  // is kept across navigation. Nothing is restored across reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    resolveInitialSidebarCollapsed(
      typeof window === "undefined" ? "overlay" : resolveSidebarMode(window.innerWidth),
      rememberedPushSidebarExpanded
    )
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  if (import.meta.env.DEV && import.meta.env.VITE_BOOT_DIAGNOSTICS === "true") {
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
    if (
      !import.meta.env.DEV ||
      import.meta.env.VITE_BOOT_DIAGNOSTICS !== "true"
    )
      return;
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
          id: "quotes", label: "Orçamentos", route: "/quotes", icon: ClipboardList, permissions: ["catalog:read"],
        },
        {
          id: "service-catalog", label: "Catálogo de serviços", route: "/service-catalog", icon: BookOpen, permissions: ["catalog:read"],
        },
        {
          id: "service-orders",
          label: "Ordens de Serviço",
          route: "/service-orders",
          icon: Briefcase,
          permissions: ["orders:read"],
        },
      ],
    },
    {
      id: "controle",
      label: "Controle",
      items: [
        {
          id: "finances",
          label: "Financeiro",
          route: "/finances",
          icon: DollarSign,
          permissions: ["finance:read"],
        },
        {
          id: "inventory", label: "Estoque", route: "/inventory", icon: Package, permissions: ["inventory:manage"],
        },
        {
          id: "fiscal", label: "Notas fiscais", route: "/fiscal", icon: ReceiptText, permissions: ["fiscal:manage"],
        },
        {
          id: "financial-health", label: "Saúde financeira", route: "/financial-health", icon: HeartPulse, permissions: ["financial-health:read"],
        },
        {
          id: "whatsapp",
          label: "WhatsApp",
          route: "/whatsapp",
          icon: MessageCircle,
        },
        {
          id: "timeline",
          label: "Timeline",
          route: "/timeline",
          icon: History,
          permissions: ["reports:read"],
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
          id: "governance",
          label: "Governança",
          route: "/governance",
          icon: Shield,
          permissions: ["governance:read"],
        },
        {
          id: "people",
          label: "Pessoas",
          route: "/people",
          icon: Building2,
          permissions: ["people:manage"],
        },
      ],
    },
    {
      id: "sistema",
      label: "Sistema",
      items: [
        {
          id: "billing",
          label: "Planos",
          route: "/billing",
          icon: CreditCard,
          permissions: ["settings:manage"],
        },
        {
          id: "audit",
          label: "Auditoria",
          route: "/audit",
          icon: ClipboardList,
          requiredRoles: ["ADMIN"],
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
            if (
              item.requiredRoles?.length &&
              (!role || !item.requiredRoles.includes(role))
            )
              return false;
            if (!item.permissions?.length) return true;
            if (!role) return false;
            return canAny(role, item.permissions);
          }),
        }))
        .filter(section => section.items.length > 0),
    [role]
  );

  const isWhatsAppRoute = isRouteActive(location, "/whatsapp");
  // Mobile keeps being decided by useIsMobile so its behaviour is unchanged;
  // desktop widths pick between overlay (768-1279px) and push (>=1280px).
  const sidebarMode: SidebarMode = isMobile
    ? "mobile"
    : viewportSidebarMode === "push"
      ? "push"
      : "overlay";
  const sidebarLayout = resolveSidebarLayout(sidebarMode, sidebarCollapsed);
  const desktopSidebarWidth = sidebarLayout.sidebarWidth;
  const isDesktopCollapsedSidebar = sidebarCollapsed && !isMobile;

  useEffect(() => {
    if (!isMobile) return;
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [isMobile, location]);

  useEffect(() => {
    rememberedPushSidebarExpanded = sidebarMode === "push" && !sidebarCollapsed;
  }, [sidebarMode, sidebarCollapsed]);

  useEffect(() => {
    if (!sidebarLayout.collapseOnNavigate) return;
    setSidebarCollapsed(true);
  }, [sidebarLayout.collapseOnNavigate, location]);

  useEffect(() => {
    if (!sidebarLayout.collapseOnEscape || sidebarCollapsed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSidebarCollapsed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarLayout.collapseOnEscape, sidebarCollapsed]);

  const handleNavigate = (route: string) => {
    navigate(route);
    if (isMobile) setMobileMenuOpen(false);
    else if (sidebarLayout.collapseOnNavigate) setSidebarCollapsed(true);
  };

  const performLogout = async () => {
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

  const handleLogout = () =>
    requestAppNavigation(() => {
      void performLogout();
    });

  return (
    <AppShell>
      <div
        className={`nexo-app-shell nexo-app app-root ${theme === "dark" ? "dark" : ""} min-h-screen text-[var(--text-primary)]`}
        data-theme={theme}
        data-skin={premiumSkinAttribute(premiumSkin)}
      >
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="nexo-skip-link sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-[var(--accent-primary)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
          onClick={event => {
            event.preventDefault();
            const target = document.getElementById(MAIN_CONTENT_ID);
            target?.focus();
            target?.scrollIntoView({ block: "start" });
          }}
        >
          Pular para o conteúdo
        </a>

        {sidebarLayout.showBackdrop ? (
          // Pointer-only affordance: keyboard users close with Esc or the
          // sidebar toggle, so the backdrop stays out of the Tab order.
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="fixed inset-0 z-30 bg-slate-950/20 nexo-state-transition nexo-sidebar-backdrop"
            onClick={() => setSidebarCollapsed(true)}
          />
        ) : null}

        <div className="flex min-h-screen w-full">
          {!isMobile ? <aside
            aria-label="Menu lateral"
            className={`nexo-sidebar z-40 flex shrink-0 flex-col overflow-hidden shadow-lg transition-[width,transform] duration-200 ease-out ${
              isMobile
                ? `fixed inset-y-0 left-0 w-[304px] ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`
                : "fixed inset-y-0 left-0"
            }`}
            style={{
              width: !isMobile ? `${desktopSidebarWidth}px` : undefined,
              backgroundColor: "var(--app-sidebar-surface, var(--app-sidebar))",
            }}
          >
            <div
              className={`nexo-sidebar-header border-b border-[var(--border)] py-2 ${
                isDesktopCollapsedSidebar ? "px-2" : "px-3.5"
              }`}
            >
              <div
                className={`flex items-center gap-2 ${
                  isDesktopCollapsedSidebar
                    ? "relative min-h-10 w-full justify-start"
                    : "justify-between"
                }`}
              >
                <button
                  type="button"
                  aria-label="NexoGestão, ir para o Dashboard"
                  onClick={() => handleNavigate("/executive-dashboard")}
                  className={`flex min-w-0 items-center ${
                    isDesktopCollapsedSidebar ? "justify-start" : ""
                  }`}
                >
                  <BrandSignature compact={isDesktopCollapsedSidebar} />
                </button>

                {!isMobile ? (
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(prev => !prev)}
                    {...resolveSidebarToggleA11y(sidebarCollapsed)}
                    className={`rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/35 ${
                      isDesktopCollapsedSidebar
                        ? "absolute right-0 top-1/2 -translate-y-1/2 p-1"
                        : "p-1.5"
                    }`}
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
                    className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/35"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <nav
              id={SIDEBAR_NAV_ID}
              aria-label="Navegação principal"
              className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3"
            >
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
                            aria-label={item.label}
                            aria-current={active ? "page" : undefined}
                            onClick={() => handleNavigate(item.route)}
                            className={`nexo-sidebar-item group nexo-state-transition ${active ? "nexo-sidebar-item-active" : ""} ${
                              sidebarCollapsed && !isMobile
                                ? "h-11 justify-center px-0"
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
                title={
                  theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
                }
                aria-label={
                  theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
                }
                className={`nexo-sidebar-item w-full ${sidebarCollapsed && !isMobile ? "h-11 justify-center px-0" : ""}`}
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
          </aside> : null}

          <div
            data-sidebar-collapsed={
              !isMobile && sidebarCollapsed ? "true" : "false"
            }
            data-sidebar-expanded={
              !isMobile && !sidebarCollapsed ? "true" : "false"
            }
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              !isMobile &&
                "transition-[margin-left] duration-200 ease-out motion-reduce:transition-none"
            )}
            style={
              !isMobile
                ? { marginLeft: `${sidebarLayout.contentOffset}px` }
                : undefined
            }
          >
            <header className="nexo-topbar z-20 nexo-state-transition" data-mobile-header={isMobile || undefined}>
              <div className="nexo-topbar-grid">
                <div className="nexo-topbar-content-grid">
                  <div className="flex min-w-0 items-center gap-2 md:gap-2.5">
                    {isMobile ? <>
                      <button type="button" onClick={() => handleNavigate("/executive-dashboard")} className="min-h-11 min-w-0 flex-1 truncate text-left text-base font-semibold tracking-tight" aria-label="NexoGestão, início">NexoGestão<span className="text-[var(--accent-primary)]">.</span></button>
                      <button type="button" className="nexo-topbar-control" aria-label="Buscar" onClick={() => setMobileSearchOpen(true)}><Search className="h-5 w-5" /></button>
                    </> : <div className="nexo-topbar-search-slot min-w-0 self-center"><GlobalSearch /></div>}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 md:gap-2">
                    <DropdownMenu open={notificationMenuOpen} onOpenChange={setNotificationMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="nexo-topbar-control relative"
                          aria-label="Notificações"
                        >
                          <Bell className="h-4 w-4" />
                          {(unreadCount ?? 0) + (isMobile ? localNotificationCount : 0) > 0 ? (
                            <span className="nexo-notification-count absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--text-primary)]">
                              {Math.min((unreadCount ?? 0) + (isMobile ? localNotificationCount : 0), 9)}
                            </span>
                          ) : null}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[70dvh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto nexo-floating-panel"
                      >
                        <DropdownMenuLabel className="flex flex-col items-start gap-1 whitespace-normal px-3 py-2">
                          <span>Notificações</span>
                          <span className="text-xs font-normal text-[var(--text-muted)]">
                            {notificationStreamStatus === "connected" ? "Atualização em tempo real ativa" :
                              notificationStreamStatus === "reconnecting" || notificationStreamStatus === "connecting" ? "Reconectando atualizações…" :
                                "Dados disponíveis por consulta"}
                          </span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isMobile && localNotificationCount > 0 ? (
                          <NotificationCenter inline onAction={() => setNotificationMenuOpen(false)} />
                        ) : null}
                        {notificationQuery.isLoading ? (
                          <div className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">Carregando notificações…</div>
                        ) : notificationQuery.isError ? (
                          <div className="px-3 py-8 text-center">
                            <p className="text-sm text-[var(--danger)]">Não foi possível carregar as notificações.</p>
                            <button type="button" onClick={() => notificationQuery.refetch()} className="mt-2 min-h-11 px-2 text-sm font-medium text-[var(--accent)]">Tentar novamente</button>
                          </div>
                        ) : persistentNotifications.length === 0 ? (
                          <div className="px-3 py-8 text-center">
                            <Bell className="mx-auto h-5 w-5 text-[var(--text-muted)]" />
                            <p className="mt-2 text-sm text-[var(--text-muted)]">{isMobile && localNotificationCount > 0 ? "Nenhuma outra notificação." : "Nenhuma notificação no momento."}</p>
                          </div>
                        ) : persistentNotifications.map(item => {
                          const safeRouteHint = isSafeNotificationRouteHint(item.routeHint) ? item.routeHint : null;
                          return (
                          <div key={item.id} className="min-w-0">
                          <DropdownMenuItem
                            className={cn("flex min-h-11 min-w-0 flex-col items-start gap-1 whitespace-normal rounded-xl px-3 py-2", safeRouteHint && "cursor-pointer", !item.read && "bg-[var(--surface-subtle)]")}
                            onSelect={evt => {
                              evt.preventDefault();
                              if (!item.read) markRead(item.id);
                              if (safeRouteHint) { setNotificationMenuOpen(false); navigate(safeRouteHint); }
                            }}
                          >
                            <p className="w-full break-words text-sm font-medium text-[var(--app-overlay-text)]">{item.title}</p>
                            <p className="w-full break-words text-xs text-[var(--text-muted)]">{item.message}</p>
                          </DropdownMenuItem>
                          {!item.read && notificationReadState[item.id] === "pending" ? (
                            <p role="status" className="px-3 py-2 text-xs text-[var(--text-muted)]">Marcando como lida…</p>
                          ) : null}
                          {!item.read && notificationReadState[item.id] === "error" ? (
                            <div className="px-3 py-2 text-sm">
                              <p role="alert">Não foi possível marcar esta notificação como lida.</p>
                              <DropdownMenuItem className="min-h-11 cursor-pointer text-[var(--app-overlay-text)] focus:text-[var(--app-overlay-text)] underline underline-offset-4" aria-label={`Tentar marcar como lida: ${item.title}`} onSelect={event => { event.preventDefault(); markRead(item.id); }}>
                                Tentar novamente
                              </DropdownMenuItem>
                            </div>
                          ) : null}
                          </div>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="nexo-topbar-control h-9 px-2.5"
                          aria-label="Minha conta"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)]">
                            <User className="h-4 w-4" />
                          </div>
                          <span className="hidden max-w-28 truncate md:block">
                            {user?.name ?? "Usuário"}
                          </span>
                          <ChevronDown className="hidden h-4 w-4 text-[var(--text-muted)] md:block" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 p-1">
                        <DropdownMenuLabel className="px-2 py-1.5">
                          <p className="truncate text-xs font-semibold text-[var(--app-overlay-text)]">
                            {user?.name ?? "Usuário"}
                          </p>
                          <p className="truncate text-[11px] text-[var(--text-muted)]">
                            {user?.email ?? "Sem e-mail"}
                          </p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="min-h-11 rounded-md px-2 text-sm text-[var(--app-overlay-text)] focus:text-[var(--app-overlay-text)]"
                          onClick={() => navigate("/profile")}
                        >
                          <User className="mr-2 h-4 w-4" /> Perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="min-h-11 rounded-md px-2 text-sm text-[var(--app-overlay-text)] focus:text-[var(--app-overlay-text)]"
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
                          className="min-h-11 rounded-md px-2 text-sm text-[var(--app-overlay-text)] focus:text-[var(--app-overlay-text)]"
                        >
                          <LogOut className="mr-2 h-4 w-4" /> Sair
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </header>

            <main
              id={MAIN_CONTENT_ID}
              tabIndex={-1}
              data-scrollbar="nexo"
              style={isMobile ? { paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" } : undefined}
              className={cn(
                "nexo-app-content nexo-section-reveal focus:outline-none mt-0 min-h-0 flex-1 overflow-auto px-3 pb-4 md:mt-0 md:px-4 md:pb-5",
                isWhatsAppRoute
                  ? "mt-0 overflow-hidden px-3 pb-0 pt-0 md:mt-0 md:px-4 md:pb-0"
                  : undefined
              )}
            >
              {children}
            </main>
          </div>
        </div>

        {isMobile ? <MobileAppNavigation
          sections={visibleSections} location={location}
          financeAllowed={Boolean(role && canAny(role,["finance:read"]))}
          onNavigate={handleNavigate} menuOpen={mobileMenuOpen} onMenuChange={setMobileMenuOpen}
          searchOpen={mobileSearchOpen} onSearchChange={setMobileSearchOpen}
          theme={theme} onThemeToggle={() => toggleTheme?.()}
        /> : null}
      </div>
    </AppShell>
  );
}
