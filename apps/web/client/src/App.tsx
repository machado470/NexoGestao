import { useEffect, type ComponentType, type ReactNode } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Loader } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import ErrorBoundary from "./components/ErrorBoundary";
import { MainLayout } from "./components/MainLayout";
import { NotificationCenter } from "./components/NotificationCenter";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { canAny, type Permission, type Role } from "./lib/rbac";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServiceOrdersPage from "./pages/ServiceOrdersPage";
import PeoplePage from "./pages/PeoplePage";
import GovernancePage from "./pages/GovernancePage";
import FinancesPage from "./pages/FinancesPage";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import ExecutiveDashboardNew from "./pages/ExecutiveDashboardNew";
import WhatsAppPage from "./pages/WhatsAppPage";
import LaunchesPage from "./pages/LaunchesPage";
import About from "./pages/About";
import InvoicesPage from "./pages/InvoicesPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReferralsPage from "./pages/ReferralsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import TimelinePage from "./pages/TimelinePage";
import OperationalWorkflowPage from "./pages/OperationalWorkflowPage";
import OperationsDashboardPage from "./pages/OperationsDashboardPage";

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
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProtectedRoute({
  component: Component,
  allowedRoles,
  permissions,
  requireCompletedOnboarding = false,
  onboardingOnly = false,
}: {
  component: ComponentType;
  allowedRoles?: Role[];
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

  if (isInitializing) {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireCompletedOnboarding && requiresOnboarding) {
    return null;
  }

  if (onboardingOnly && !requiresOnboarding) {
    return null;
  }

  if (allowedRoles?.length && (!role || !allowedRoles.includes(role))) {
    return (
      <FullScreenMessage
        title="Acesso restrito"
        description="Seu perfil não tem permissão para acessar esta área."
        actionLabel="Voltar ao dashboard"
        onAction={() => navigate("/dashboard")}
      />
    );
  }

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

  if (isInitializing) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return null;
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
    allowedRoles?: Role[];
    permissions?: Permission[];
    requireCompletedOnboarding?: boolean;
    onboardingOnly?: boolean;
  }
) {
  const WrappedPage = withMainLayout(Page);

  return function ProtectedPageRoute() {
    return (
      <ProtectedRoute
        component={WrappedPage}
        allowedRoles={options?.allowedRoles}
        permissions={options?.permissions}
        requireCompletedOnboarding={options?.requireCompletedOnboarding}
        onboardingOnly={options?.onboardingOnly}
      />
    );
  };
}

function publicPage(Page: ComponentType) {
  return function PublicPageRoute() {
    return <PublicRoute component={Page} />;
  };
}

function onboardingPage(Page: ComponentType) {
  return function OnboardingPageRoute() {
    return <ProtectedRoute onboardingOnly component={Page} />;
  };
}

function RouteShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

const DashboardRoute = protectedPage(Dashboard, {
  requireCompletedOnboarding: true,
});

const CustomersRoute = protectedPage(CustomersPage, {
  requireCompletedOnboarding: true,
  permissions: ["customers:read"],
});

const AppointmentsRoute = protectedPage(AppointmentsPage, {
  requireCompletedOnboarding: true,
  permissions: ["appointments:read"],
});

const ServiceOrdersRoute = protectedPage(ServiceOrdersPage, {
  requireCompletedOnboarding: true,
  permissions: ["orders:read"],
});

const FinancesRoute = protectedPage(FinancesPage, {
  requireCompletedOnboarding: true,
  permissions: ["finance:read"],
});

const PeopleRoute = protectedPage(PeoplePage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN"],
});

const GovernanceRoute = protectedPage(GovernancePage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
});

const ExecutiveDashboardRoute = protectedPage(ExecutiveDashboard, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
});

const ExecutiveDashboardNewRoute = protectedPage(ExecutiveDashboardNew, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
});

const WhatsAppRoute = protectedPage(WhatsAppPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
});

const LaunchesRoute = protectedPage(LaunchesPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER"],
});

const InvoicesRoute = protectedPage(InvoicesPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER"],
});

const ExpensesRoute = protectedPage(ExpensesPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER"],
});

const ReferralsRoute = protectedPage(ReferralsPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER"],
});

const CalendarRoute = protectedPage(CalendarPage, {
  requireCompletedOnboarding: true,
  permissions: ["appointments:read"],
});

const SettingsRoute = protectedPage(SettingsPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN"],
});

const TimelineRoute = protectedPage(TimelinePage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "VIEWER"],
});

const OperationsRoute = protectedPage(OperationalWorkflowPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
});

const OperationsDashboardRoute = protectedPage(OperationsDashboardPage, {
  requireCompletedOnboarding: true,
  allowedRoles: ["ADMIN", "MANAGER", "STAFF"],
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

      <Route path="/about" component={About} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
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
