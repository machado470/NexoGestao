import { useEffect } from "react";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Loader className="w-8 h-8 animate-spin text-orange-500" />
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
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
  component: React.ComponentType;
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
      return;
    }
  }, [
    isAuthenticated,
    isInitializing,
    navigate,
    requireCompletedOnboarding,
    onboardingOnly,
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

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isInitializing, redirectTo } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(redirectTo || "/dashboard");
    }
  }, [isAuthenticated, isInitializing, redirectTo, navigate]);

  if (isInitializing) {
    return <FullScreenLoader />;
  }

  if (isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicRoute component={Landing} />} />
      <Route path="/login" component={() => <PublicRoute component={Login} />} />
      <Route path="/register" component={() => <PublicRoute component={Register} />} />
      <Route
        path="/forgot-password"
        component={() => <PublicRoute component={ForgotPasswordPage} />}
      />
      <Route
        path="/reset-password"
        component={() => <PublicRoute component={ResetPasswordPage} />}
      />

      <Route
        path="/onboarding"
        component={() => <ProtectedRoute onboardingOnly component={Onboarding} />}
      />

      <Route
        path="/dashboard"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            component={() => (
              <MainLayout>
                <Dashboard />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/customers"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["customers:read"]}
            component={() => (
              <MainLayout>
                <CustomersPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/appointments"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["appointments:read"]}
            component={() => (
              <MainLayout>
                <AppointmentsPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/service-orders"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["orders:read"]}
            component={() => (
              <MainLayout>
                <ServiceOrdersPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/finances"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["finance:read"]}
            component={() => (
              <MainLayout>
                <FinancesPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/people"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER"]}
            component={() => (
              <MainLayout>
                <PeoplePage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/governance"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "VIEWER"]}
            component={() => (
              <MainLayout>
                <GovernancePage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/executive-dashboard"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "VIEWER"]}
            component={() => (
              <MainLayout>
                <ExecutiveDashboard />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/executive-dashboard-new"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "VIEWER"]}
            component={() => (
              <MainLayout>
                <ExecutiveDashboardNew />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/whatsapp"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "STAFF"]}
            component={() => (
              <MainLayout>
                <WhatsAppPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/launches"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER"]}
            component={() => (
              <MainLayout>
                <LaunchesPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/invoices"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER"]}
            component={() => (
              <MainLayout>
                <InvoicesPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/expenses"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER"]}
            component={() => (
              <MainLayout>
                <ExpensesPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/referrals"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER"]}
            component={() => (
              <MainLayout>
                <ReferralsPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/calendar"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["appointments:read"]}
            component={() => (
              <MainLayout>
                <CalendarPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/settings"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            permissions={["settings:manage"]}
            component={() => (
              <MainLayout>
                <SettingsPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/timeline"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "VIEWER"]}
            component={() => (
              <MainLayout>
                <TimelinePage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/operations"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "STAFF"]}
            component={() => (
              <MainLayout>
                <OperationalWorkflowPage />
              </MainLayout>
            )}
          />
        )}
      />
      <Route
        path="/dashboard/operations"
        component={() => (
          <ProtectedRoute
            requireCompletedOnboarding
            allowedRoles={["ADMIN", "MANAGER", "STAFF"]}
            component={() => (
              <MainLayout>
                <OperationsDashboardPage />
              </MainLayout>
            )}
          />
        )}
      />

      <Route path="/about" component={() => <About />} />
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
