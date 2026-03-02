import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MainLayout } from "./components/MainLayout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import CustomersPage from "./pages/CustomersPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ServiceOrdersPage from "./pages/ServiceOrdersPage";
import FinancesPage from "./pages/FinancesPage";
import PeoplePage from "./pages/PeoplePage";
import GovernancePage from "./pages/GovernancePage";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import { Loader } from "lucide-react";

// Componente para proteger rotas autenticadas
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  return <Component />;
}

// Componente para redirecionar se já autenticado
function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    navigate("/dashboard");
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
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
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
