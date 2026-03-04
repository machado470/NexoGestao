import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/executive-dashboard": [{ label: "Dashboard", href: "/executive-dashboard" }],
  "/customers": [{ label: "Clientes", href: "/customers" }],
  "/appointments": [{ label: "Agendamentos", href: "/appointments" }],
  "/service-orders": [{ label: "Ordens de Serviço", href: "/service-orders" }],
  "/finances": [{ label: "Financeiro", href: "/finances" }],
  "/people": [{ label: "Pessoas", href: "/people" }],
  "/governance": [{ label: "Governança", href: "/governance" }],
};

export function Breadcrumbs() {
  const [location, navigate] = useLocation();

  const breadcrumbs = routeBreadcrumbs[location] || [{ label: "Página" }];
  const allBreadcrumbs = [{ label: "Início", href: "/executive-dashboard" }, ...breadcrumbs];

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      {allBreadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />}
          {crumb.href ? (
            <button
              onClick={() => navigate(crumb.href!)}
              className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors hover:underline"
            >
              {index === 0 ? <Home className="w-4 h-4" /> : crumb.label}
            </button>
          ) : (
            <span className="text-gray-900 dark:text-white font-medium">{crumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
