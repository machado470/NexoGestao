import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Loader } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import ErrorBoundary from "./components/ErrorBoundary";
import { MainLayout } from "./components/MainLayout";
import { NotificationCenter } from "./components/NotificationCenter";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import TimelinePage from "./pages/TimelinePage";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

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
      <div className="nexo-app-panel-strong flex w-full max-w-md items-center justify-center p-10">
        <Loader className="h-8 w-8 animate-spin text-orange-500" />
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
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
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
}: {
  component: LazyExoticComponent<ComponentType>;
}) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Component />
    </Suspense>
  );
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

function PublicRoute({ component: Component }: { component: ComponentType }) {
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

  if (isInitializing) return <FullScreenLoader />;

  if (isAuthenticated) {
    return (
      <RedirectingScreen message="Sua sessão já está ativa. Redirecionando para a área interna." />
    );
  }

  return <Component />;
}

function withMainLayout(Page: ComponentType) {
  return function LayoutWrappedPage() {
    return (
      <MainLayout>
        <Page />
      </MainLayout>
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

function publicPage(Page: LazyExoticComponent<ComponentType>) {
  return function PublicPageRoute() {
    return <PublicRoute component={() => <LazyPage component={Page} />} />;
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
  permissions: ["settings:manage"],
  requireCompletedOnboarding: true,
});

const TimelineRoute = protectedPage(TimelinePage, {
  permissions: ["reports:read"],
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
    const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";
    navigate(`${targetPath}${query}`, { replace: true });
  }, [location, navigate, targetPath]);

  return <RedirectingScreen message={message} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        {publicPage(Landing)()}
      </Route>

      <Route path="/login">
        {publicPage(Login)()}
      </Route>

      <Route path="/register">
        {publicPage(Register)()}
      </Route>

      <Route path="/forgot-password">
        {publicPage(ForgotPasswordPage)()}
      </Route>

      <Route path="/reset-password">
        {publicPage(ResetPasswordPage)()}
      </Route>

      <Route path="/onboarding">
        {onboardingPage(Onboarding)()}
      </Route>

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
      <Route path="/timeline" component={TimelineRoute} />
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

      <Route path="/about" component={() => <LazyPage component={About} />} />
      <Route path="/privacy" component={() => <LazyPage component={PrivacyPolicy} />} />
      <Route path="/terms" component={() => <LazyPage component={TermsOfService} />} />
      <Route path="/404" component={() => <LazyPage component={NotFound} />} />
      <Route component={() => <LazyPage component={NotFound} />} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
            <NotificationCenter />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
