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

import ErrorBoundary from "./components/ErrorBoundary";
import { MainLayout } from "./components/MainLayout";
import { NotificationCenter } from "./components/NotificationCenter";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { canAny, type Permission } from "./lib/rbac";

// pages
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));

const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"));
const ServiceOrdersPage = lazy(() => import("./pages/ServiceOrdersPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const GovernancePage = lazy(() => import("./pages/GovernancePage"));
const FinancesPage = lazy(() => import("./pages/FinancesPage"));

const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const ExecutiveDashboardNew = lazy(() => import("./pages/ExecutiveDashboardNew"));

const WhatsAppPage = lazy(() => import("./pages/WhatsAppPage"));
const LaunchesPage = lazy(() => import("./pages/LaunchesPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));

const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TimelinePage = lazy(() => import("./pages/TimelinePage"));

const OperationalWorkflowPage = lazy(
  () => import("./pages/OperationalWorkflowPage")
);
const OperationsDashboardPage = lazy(
  () => import("./pages/OperationsDashboardPage")
);

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Loader className="h-8 w-8 animate-spin text-orange-500" />
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
  const [, navigate] = useLocation();

  const requiresOnboarding = Boolean(payload?.data?.requiresOnboarding);

  useEffect(() => {
    if (isInitializing) return;

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (requireCompletedOnboarding && requiresOnboarding) {
      navigate("/onboarding");
      return;
    }

    if (onboardingOnly && !requiresOnboarding) {
      navigate("/dashboard");
    }
  }, [
    isAuthenticated,
    isInitializing,
    navigate,
    onboardingOnly,
    requireCompletedOnboarding,
    requiresOnboarding,
  ]);

  if (isInitializing) return <FullScreenLoader />;
  if (!isAuthenticated) return null;

  if (requireCompletedOnboarding && requiresOnboarding) return null;
  if (onboardingOnly && !requiresOnboarding) return null;

  if (permissions?.length && (!role || !canAny(role, permissions))) {
    return (
      <FullScreenMessage
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta área."
        actionLabel="Voltar ao dashboard"
        onAction={() => navigate("/dashboard")}
      />
    );
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isInitializing, redirectTo } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(redirectTo || "/dashboard");
    }
  }, [isAuthenticated, isInitializing, navigate, redirectTo]);

  if (isInitializing) return <FullScreenLoader />;
  if (isAuthenticated) return null;

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
  Page: LazyExoticComponent<ComponentType>,
  options?: {
    permissions?: Permission[];
    requireCompletedOnboarding?: boolean;
    onboardingOnly?: boolean;
  }
) {
  const Wrapped = withMainLayout(() => <LazyPage component={Page} />);

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

function RouteShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// ROUTES

const DashboardRoute = protectedPage(Dashboard, {
  requireCompletedOnboarding: true,
});

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

const ExecutiveDashboardNewRoute = protectedPage(ExecutiveDashboardNew, {
  requireCompletedOnboarding: true,
});

const WhatsAppRoute = protectedPage(WhatsAppPage, {
  requireCompletedOnboarding: true,
});

const LaunchesRoute = protectedPage(LaunchesPage, {
  permissions: ["finance:read"],
  requireCompletedOnboarding: true,
});

const InvoicesRoute = protectedPage(InvoicesPage, {
  permissions: ["finance:read"],
  requireCompletedOnboarding: true,
});

const ExpensesRoute = protectedPage(ExpensesPage, {
  permissions: ["finance:read"],
  requireCompletedOnboarding: true,
});

const ReferralsRoute = protectedPage(ReferralsPage, {
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

const OperationsRoute = protectedPage(OperationalWorkflowPage, {
  requireCompletedOnboarding: true,
});

const OperationsDashboardRoute = protectedPage(OperationsDashboardPage, {
  requireCompletedOnboarding: true,
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <RouteShell>{publicPage(Landing)()}</RouteShell>
      </Route>

      <Route path="/login">
        <RouteShell>{publicPage(Login)()}</RouteShell>
      </Route>

      <Route path="/register">
        <RouteShell>{publicPage(Register)()}</RouteShell>
      </Route>

      <Route path="/forgot-password">
        <RouteShell>{publicPage(ForgotPasswordPage)()}</RouteShell>
      </Route>

      <Route path="/reset-password">
        <RouteShell>{publicPage(ResetPasswordPage)()}</RouteShell>
      </Route>

      <Route path="/onboarding">
        <RouteShell>{onboardingPage(Onboarding)()}</RouteShell>
      </Route>

      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/customers" component={CustomersRoute} />
      <Route path="/appointments" component={AppointmentsRoute} />
      <Route path="/service-orders" component={ServiceOrdersRoute} />
      <Route path="/finances" component={FinancesRoute} />
      <Route path="/people" component={PeopleRoute} />
      <Route path="/governance" component={GovernanceRoute} />
      <Route path="/executive-dashboard" component={ExecutiveDashboardRoute} />
      <Route
        path="/executive-dashboard-new"
        component={ExecutiveDashboardNewRoute}
      />
      <Route path="/whatsapp" component={WhatsAppRoute} />
      <Route path="/launches" component={LaunchesRoute} />
      <Route path="/invoices" component={InvoicesRoute} />
      <Route path="/expenses" component={ExpensesRoute} />
      <Route path="/referrals" component={ReferralsRoute} />
      <Route path="/calendar" component={CalendarRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/timeline" component={TimelineRoute} />
      <Route path="/operations" component={OperationsRoute} />
      <Route path="/dashboard/operations" component={OperationsDashboardRoute} />

      <Route path="/about" component={() => <LazyPage component={About} />} />
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
