import {
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { Route, Switch, useLocation } from "wouter";
import { Loader } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConsentBanner } from "@/components/ConsentBanner";

import ErrorBoundary from "./components/ErrorBoundary";
import { AppLayout } from "./components/AppLayout";
import { PublicLayout } from "./components/PublicLayout";
import { AuthLayout } from "./components/AuthLayout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { canAny, type Permission } from "./lib/rbac";

import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServiceOrdersPage from "./pages/ServiceOrdersPage";
import PeoplePage from "./pages/PeoplePage";
import GovernancePage from "./pages/GovernancePage";
import FinancesPage from "./pages/FinancesPage";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import WhatsAppPage from "./pages/WhatsAppPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import TimelinePage from "./pages/TimelinePage";
import BillingPage from "./pages/BillingPage";
import Landing from "./pages/Landing";
import About from "./pages/About";
import ProductPage from "./pages/ProductPage";
import FunctionalitiesPage from "./pages/FunctionalitiesPage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import RegisterPage from "./pages/Register";

const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const ConfirmEmailPage = lazy(() => import("./pages/ConfirmEmailPage"));

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEnvelope(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null;

  if (isObject(payload.data) && isObject(payload.data.data)) {
    return payload.data.data;
  }

  return payload;
}

function getRequiresOnboarding(payload: unknown): boolean {
  const env = getEnvelope(payload);
  return Boolean(env?.requiresOnboarding);
}

function FullScreenLoader() {
  return (
    <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="nexo-app-panel-strong flex w-full max-w-md items-center gap-3 p-6">
        <Loader className="h-5 w-5 animate-spin text-orange-500" />
        <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
          Carregando ambiente...
        </p>
      </div>
    </div>
  );
}

function AuthRouteLoader() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex items-start justify-center pt-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-white/90 px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-sm backdrop-blur dark:border-orange-500/20 dark:bg-[var(--surface-base)] dark:text-[var(--text-secondary)]">
        <Loader className="h-3.5 w-3.5 animate-spin text-orange-500" />
        Sincronizando autenticação...
      </div>
    </div>
  );
}

function FullScreenMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="nexo-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="nexo-app-panel-strong w-full max-w-md p-6">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)] dark:text-[var(--text-muted)]">
          {description}
        </p>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LazyPage({
  component: Component,
  fallback = <FullScreenLoader />,
}: {
  component: LazyExoticComponent<ComponentType>;
  fallback?: ReactNode;
}) {
  return <Suspense fallback={fallback}><Component /></Suspense>;
}

function RedirectingScreen({ message }: { message: string }) {
  return <FullScreenMessage title="Redirecionando..." description={message} />;
}

function buildLoginRedirectPath(currentPath: string) {
  const normalizedCurrentPath = currentPath.trim();
  if (!normalizedCurrentPath || normalizedCurrentPath === "/login") {
    return "/login";
  }

  const params = new URLSearchParams();
  params.set("redirect", normalizedCurrentPath);
  return `/login?${params.toString()}`;
}

function readSafeRedirectFromPath(path: string): string | null {
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  if (!query) return null;

  const params = new URLSearchParams(query);
  const raw = (params.get("redirect") ?? "").trim();

  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.startsWith("/login")) return null;
  if (raw.startsWith("/register")) return null;
  if (raw.startsWith("/forgot-password")) return null;
  if (raw.startsWith("/reset-password")) return null;

  return raw;
}

function useOperationalStyleGuard() {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;

    const forbidden = ["shadow-", "ring-", "backdrop-", "blur-"];

    const checkNode = (node: Element) => {
      const className = node.className;
      if (typeof className !== "string") return;

      if (!forbidden.some(token => className.includes(token))) return;
      if (node.tagName !== "BUTTON" && !node.closest("[data-operational='true']")) return;

      // eslint-disable-next-line no-console
      console.warn("[NexoGestao] Classe visual proibida em elemento operacional:", node);
    };

    document.querySelectorAll("button,[data-operational='true']").forEach(checkNode);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          checkNode(mutation.target);
        }
      });
    });

    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
}

function ProtectedRoute({
  component: Component,
  permissions,
  requireCompletedOnboarding = false,
  onboardingOnly = false,
}: {
  component: ComponentType;
  permissions?: Permission[];
  requireCompletedOnboarding?: boolean;
  onboardingOnly?: boolean;
}) {
  useOperationalStyleGuard();
  const { isAuthenticated, isInitializing, payload, role } = useAuth();
  const [location, navigate] = useLocation();

  const requiresOnboarding = getRequiresOnboarding(payload);

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      navigate(buildLoginRedirectPath(location), { replace: true });
      return;
    }

    if (requireCompletedOnboarding && requiresOnboarding) {
      navigate("/onboarding", { replace: true });
      return;
    }

    if (onboardingOnly && !requiresOnboarding) {
      navigate("/executive-dashboard", { replace: true });
    }
  }, [
    isAuthenticated,
    isInitializing,
    navigate,
    onboardingOnly,
    requireCompletedOnboarding,
    requiresOnboarding,
  ]);

  if (isInitializing) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return (
      <RedirectingScreen message="Sua sessão não está ativa. Você será enviado para o login." />
    );
  }

  if (requireCompletedOnboarding && requiresOnboarding) {
    return (
      <RedirectingScreen message="Seu acesso precisa passar pelo onboarding antes de continuar." />
    );
  }

  if (onboardingOnly && !requiresOnboarding) {
    return (
      <RedirectingScreen message="Seu onboarding já foi concluído. Voltando para o dashboard." />
    );
  }

  if (permissions?.length && (!role || !canAny(role, permissions))) {
    return (
      <FullScreenMessage
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta área."
        actionLabel="Voltar ao dashboard"
        onAction={() => navigate("/executive-dashboard")}
      />
    );
  }

  return <Component />;
}

function AuthRoute({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isInitializing, redirectTo } = useAuth();
  const [location, navigate] = useLocation();
  const redirectParam = readSafeRedirectFromPath(location);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(redirectParam || redirectTo || "/executive-dashboard", {
        replace: true,
      });
    }
  }, [isAuthenticated, isInitializing, navigate, redirectParam, redirectTo]);

  if (isInitializing) return <Component />;

  if (isAuthenticated) {
    return (
      <RedirectingScreen message="Sua sessão já está ativa. Redirecionando para a área interna." />
    );
  }

  return (
    <AuthLayout>
      <Component />
    </AuthLayout>
  );
}

function MarketingRoute({
  component: Component,
}: {
  component: ComponentType;
}) {
  return (
    <PublicLayout>
      <Component />
    </PublicLayout>
  );
}

function withMainLayout(Page: ComponentType) {
  return function LayoutWrappedPage() {
    return (
      <AppLayout>
        <Page />
      </AppLayout>
    );
  };
}

function protectedPage(
  Page: ComponentType,
  options?: {
    permissions?: Permission[];
    requireCompletedOnboarding?: boolean;
    onboardingOnly?: boolean;
  }
) {
  const Wrapped = withMainLayout(Page);

  return function ProtectedPageRoute() {
    return (
      <ProtectedRoute
        component={Wrapped}
        permissions={options?.permissions}
        requireCompletedOnboarding={options?.requireCompletedOnboarding}
        onboardingOnly={options?.onboardingOnly}
      />
    );
  };
}

function publicPage(Page: ComponentType) {
  return function PublicPageRoute() {
    return <MarketingRoute component={Page} />;
  };
}

function authPage(Page: LazyExoticComponent<ComponentType>) {
  return function AuthPageRoute() {
    return (
      <AuthRoute
        component={() => <LazyPage component={Page} fallback={<AuthRouteLoader />} />}
      />
    );
  };
}

function onboardingPage(Page: LazyExoticComponent<ComponentType>) {
  return function OnboardingPageRoute() {
    return (
      <ProtectedRoute
        onboardingOnly
        component={() => <LazyPage component={Page} />}
      />
    );
  };
}

function directAuthPage(Page: ComponentType) {
  return function DirectAuthPageRoute() {
    return <AuthRoute component={Page} />;
  };
}

const CustomersRoute = protectedPage(CustomersPage, {
  permissions: ["customers:read"],
  requireCompletedOnboarding: true,
});

const AppointmentsRoute = protectedPage(AppointmentsPage, {
  permissions: ["appointments:read"],
  requireCompletedOnboarding: true,
});

const ServiceOrdersRoute = protectedPage(ServiceOrdersPage, {
  permissions: ["orders:read"],
  requireCompletedOnboarding: true,
});

const FinancesRoute = protectedPage(FinancesPage, {
  permissions: ["finance:read"],
  requireCompletedOnboarding: true,
});

const PeopleRoute = protectedPage(PeoplePage, {
  permissions: ["people:manage"],
  requireCompletedOnboarding: true,
});

const GovernanceRoute = protectedPage(GovernancePage, {
  permissions: ["governance:read"],
  requireCompletedOnboarding: true,
});

const ExecutiveDashboardRoute = protectedPage(ExecutiveDashboard, {
  requireCompletedOnboarding: true,
});

const WhatsAppRoute = protectedPage(WhatsAppPage, {
  requireCompletedOnboarding: true,
});

const CalendarRoute = protectedPage(CalendarPage, {
  permissions: ["appointments:read"],
  requireCompletedOnboarding: true,
});

const SettingsRoute = protectedPage(SettingsPage, {
  requireCompletedOnboarding: true,
});
const ProfileRoute = protectedPage(ProfilePage, {
  requireCompletedOnboarding: true,
});

const TimelineRoute = protectedPage(TimelinePage, {
  permissions: ["reports:read"],
  requireCompletedOnboarding: true,
});

const BillingRoute = protectedPage(BillingPage, {
  permissions: ["settings:manage"],
  requireCompletedOnboarding: true,
});

function LegacyAliasRoute({
  targetPath,
  message,
}: {
  targetPath: string;
  message: string;
}) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const query = location.includes("?")
      ? location.slice(location.indexOf("?"))
      : "";
    navigate(`${targetPath}${query}`, { replace: true });
  }, [location, navigate, targetPath]);

  return <RedirectingScreen message={message} />;
}

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const appPrefixes = [
      "/executive-dashboard",
      "/customers",
      "/appointments",
      "/service-orders",
      "/finances",
      "/people",
      "/governance",
      "/whatsapp",
      "/calendar",
      "/settings",
      "/timeline",
      "/billing",
      "/onboarding",
    ];
    const isAppRoute = appPrefixes.some(
      prefix => location === prefix || location.startsWith(`${prefix}/`)
    );
    document.body.dataset.visualContext = isAppRoute ? "app" : "landing";
    document.documentElement.dataset.visualContext = isAppRoute
      ? "app"
      : "landing";

  }, [location]);

  return (
    <Switch>
      <Route path="/">{publicPage(Landing)()}</Route>

      <Route path="/login">{authPage(Login)()}</Route>

      <Route path="/register" component={directAuthPage(RegisterPage)} />

      <Route path="/forgot-password">{authPage(ForgotPasswordPage)()}</Route>

      <Route path="/reset-password">{authPage(ResetPasswordPage)()}</Route>

      <Route path="/auth/accept-invite">{authPage(AcceptInvitePage)()}</Route>

      <Route path="/auth/callback">{authPage(AuthCallbackPage)()}</Route>

      <Route path="/auth/confirm-email">{authPage(ConfirmEmailPage)()}</Route>

      <Route path="/onboarding">{onboardingPage(Onboarding)()}</Route>

      <Route
        path="/dashboard"
        component={() => (
          <LegacyAliasRoute
            targetPath="/executive-dashboard"
            message="Dashboard executivo oficial em /executive-dashboard. Redirecionando..."
          />
        )}
      />
      <Route path="/customers" component={CustomersRoute} />
      <Route path="/appointments" component={AppointmentsRoute} />
      <Route path="/service-orders" component={ServiceOrdersRoute} />
      <Route path="/finances" component={FinancesRoute} />
      <Route path="/people" component={PeopleRoute} />
      <Route path="/governance" component={GovernanceRoute} />
      <Route path="/executive-dashboard" component={ExecutiveDashboardRoute} />
      <Route
        path="/executive-dashboard-new"
        component={() => (
          <LegacyAliasRoute
            targetPath="/executive-dashboard"
            message="Versão consolidada no dashboard executivo oficial. Redirecionando..."
          />
        )}
      />
      <Route path="/whatsapp" component={WhatsAppRoute} />
      <Route
        path="/launches"
        component={() => (
          <LegacyAliasRoute
            targetPath="/finances"
            message="Lançamentos foram consolidados em Financeiro. Redirecionando..."
          />
        )}
      />
      <Route
        path="/invoices"
        component={() => (
          <LegacyAliasRoute
            targetPath="/finances"
            message="Faturas foram consolidadas em Financeiro. Redirecionando..."
          />
        )}
      />
      <Route
        path="/expenses"
        component={() => (
          <LegacyAliasRoute
            targetPath="/finances"
            message="Despesas foram consolidadas em Financeiro. Redirecionando..."
          />
        )}
      />
      <Route
        path="/referrals"
        component={() => (
          <LegacyAliasRoute
            targetPath="/customers"
            message="Indicações foram consolidadas em Clientes. Redirecionando..."
          />
        )}
      />
      <Route path="/calendar" component={CalendarRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/profile" component={ProfileRoute} />
      <Route path="/timeline" component={TimelineRoute} />
      <Route path="/billing" component={BillingRoute} />
      <Route
        path="/operations"
        component={() => (
          <LegacyAliasRoute
            targetPath="/service-orders"
            message="Workflow legado consolidado em Ordens de Serviço. Redirecionando..."
          />
        )}
      />
      <Route
        path="/dashboard/operations"
        component={() => (
          <LegacyAliasRoute
            targetPath="/service-orders"
            message="Operações foram consolidadas em Ordens de Serviço. Redirecionando..."
          />
        )}
      />

      <Route path="/about" component={publicPage(About)} />
      <Route path="/sobre" component={publicPage(About)} />
      <Route path="/produto" component={publicPage(ProductPage)} />
      <Route path="/precos" component={publicPage(PricingPage)} />
      <Route
        path="/funcionalidades"
        component={publicPage(FunctionalitiesPage)}
      />
      <Route path="/contato" component={publicPage(ContactPage)} />
      <Route path="/privacy" component={publicPage(PrivacyPolicy)} />
      <Route path="/privacidade" component={publicPage(PrivacyPolicy)} />
      <Route path="/terms" component={publicPage(TermsOfService)} />
      <Route path="/termos" component={publicPage(TermsOfService)} />
      <Route path="/404" component={() => <LazyPage component={NotFound} />} />
      <Route component={() => <LazyPage component={NotFound} />} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ConsentBanner />
        </TooltipProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
