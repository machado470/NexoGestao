import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MainLayoutModern as MainLayout } from "./components/MainLayoutModern";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServiceOrdersPage from "./pages/ServiceOrdersPage";
// import FinancesPage from "./pages/FinancesPage"; // Removido
import PeoplePage from "./pages/PeoplePage";
import GovernancePage from "./pages/GovernancePage";
import FinancesPage from "./pages/FinancesPage";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import WhatsAppPage from "./pages/WhatsAppPage";
import LaunchesPage from "./pages/LaunchesPage";
import About from "./pages/About";
import InvoicesPage from "./pages/InvoicesPage";
import ExpensesPage from "./pages/ExpensesPage";
import ReferralsPage from "./pages/ReferralsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Settings from "./pages/Settings";
import Premium from "./pages/Premium";
import WhatsAppIntegration from "./pages/WhatsAppIntegration";
import WhatsAppAutomations from "./pages/WhatsAppAutomations";
import Reports from "./pages/Reports";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import { Loader } from "lucide-react";
import { useEffect } from "react";

// Componente para proteger rotas autenticadas
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

// Componente para redirecionar se já autenticado
function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <Component />;
}
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={() => <PublicRoute component={Landing} />} />
      <Route path="/login" component={() => <PublicRoute component={Login} />} />
      <Route path="/register" component={() => <PublicRoute component={Register} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={Onboarding} />} />
      <Route path="/dashboard" component={() => (
        <ProtectedRoute component={() => <MainLayout><Dashboard /></MainLayout>} />
      )} />
      <Route path="/customers" component={() => (
        <ProtectedRoute component={() => <MainLayout><CustomersPage /></MainLayout>} />
      )} />
      <Route path="/appointments" component={() => (
        <ProtectedRoute component={() => <MainLayout><AppointmentsPage /></MainLayout>} />
      )} />
      <Route path="/service-orders" component={() => (
        <ProtectedRoute component={() => <MainLayout><ServiceOrdersPage /></MainLayout>} />
      )} />
      <Route path="/finances" component={() => (
        <ProtectedRoute component={() => <MainLayout><FinancesPage /></MainLayout>} />
      )} />
      <Route path="/people" component={() => (
        <ProtectedRoute component={() => <MainLayout><PeoplePage /></MainLayout>} />
      )} />
      <Route path="/governance" component={() => (
        <ProtectedRoute component={() => <MainLayout><GovernancePage /></MainLayout>} />
      )} />
      <Route path="/executive-dashboard" component={() => (
        <ProtectedRoute component={() => <MainLayout><ExecutiveDashboard /></MainLayout>} />
      )} />
      <Route path="/whatsapp" component={() => (
        <ProtectedRoute component={() => <MainLayout><WhatsAppPage /></MainLayout>} />
      )} />
      <Route path="/launches" component={() => (
        <ProtectedRoute component={() => <MainLayout><LaunchesPage /></MainLayout>} />
      )} />
      <Route path="/invoices" component={() => (
        <ProtectedRoute component={() => <MainLayout><InvoicesPage /></MainLayout>} />
      )} />
      <Route path="/expenses" component={() => (
        <ProtectedRoute component={() => <MainLayout><ExpensesPage /></MainLayout>} />
      )} />
      <Route path="/referrals" component={() => (
        <ProtectedRoute component={() => <MainLayout><ReferralsPage /></MainLayout>} />
      )} />
      <Route path="/settings" component={() => (
        <ProtectedRoute component={() => <MainLayout><Settings /></MainLayout>} />
      )} />
      <Route path="/forgot-password" component={() => <PublicRoute component={ForgotPasswordPage} />} />
      <Route path="/reset-password" component={() => <PublicRoute component={ResetPasswordPage} />} />
      <Route path="/about" component={() => <About />} />
      <Route path="/premium" component={() => (
        <ProtectedRoute component={() => <MainLayout><Premium /></MainLayout>} />
      )} />
      <Route path="/integrations/whatsapp" component={() => (
        <ProtectedRoute component={() => <MainLayout><WhatsAppIntegration /></MainLayout>} />
      )} />
      <Route path="/whatsapp/automations" component={() => (
        <ProtectedRoute component={() => <MainLayout><WhatsAppAutomations /></MainLayout>} />
      )} />
      <Route path="/reports" component={() => (
        <ProtectedRoute component={() => <MainLayout><Reports /></MainLayout>} />
      )} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
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
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
