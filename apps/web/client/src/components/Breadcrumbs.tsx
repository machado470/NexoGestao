import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/executive-dashboard": [{ label: "Visão Geral", href: "/executive-dashboard" }],
  "/customers": [{ label: "Clientes", href: "/customers" }],
  "/appointments": [{ label: "Agendamentos", href: "/appointments" }],
  "/service-orders": [{ label: "Ordens de Serviço", href: "/service-orders" }],
  "/finances": [{ label: "Financeiro", href: "/finances" }],
  "/invoices": [{ label: "Faturas", href: "/invoices" }],
  "/expenses": [{ label: "Despesas", href: "/expenses" }],
  "/launches": [{ label: "Lançamentos", href: "/launches" }],
  "/referrals": [{ label: "Referências", href: "/referrals" }],
  "/whatsapp": [{ label: "WhatsApp", href: "/whatsapp" }],
  "/people": [{ label: "Pessoas", href: "/people" }],
  "/governance": [{ label: "Governança", href: "/governance" }],
  "/calendar": [{ label: "Calendário", href: "/calendar" }],
  "/timeline": [{ label: "Timeline", href: "/timeline" }],
  "/dashboard/operations": [{ label: "Dashboard Operacional", href: "/dashboard/operations" }],
  "/operations": [{ label: "Workflow Operacional", href: "/operations" }],
  "/settings": [{ label: "Configurações", href: "/settings" }],
};

function humanizeSegment(path: string) {
  const clean = path
    .replace(/^\/+|\/+$/g, "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .pop();

  if (!clean) return "Início";

  const mapped: Record<string, string> = {
    "executive-dashboard": "Visão Geral",
    customers: "Clientes",
    appointments: "Agendamentos",
    "service-orders": "Ordens de Serviço",
    finances: "Financeiro",
    invoices: "Faturas",
    expenses: "Despesas",
    launches: "Lançamentos",
    referrals: "Referências",
    whatsapp: "WhatsApp",
    people: "Pessoas",
    governance: "Governança",
    calendar: "Calendário",
    timeline: "Timeline",
    operations: "Workflow Operacional",
    settings: "Configurações",
  };

  return (
    mapped[clean] ??
    clean
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function Breadcrumbs() {
  const [location, navigate] = useLocation();

  const breadcrumbs = routeBreadcrumbs[location] || [{ label: humanizeSegment(location) }];
  const allBreadcrumbs = [{ label: "Início", href: "/executive-dashboard" }, ...breadcrumbs];

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      {allBreadcrumbs.map((crumb, index) => (
        <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-600" />
          )}
          {crumb.href ? (
            <button
              onClick={() => navigate(crumb.href!)}
              className="transition-colors hover:text-orange-600 hover:underline dark:hover:text-orange-400"
              type="button"
            >
              {index === 0 ? <Home className="h-4 w-4" /> : crumb.label}
            </button>
          ) : (
            <span className="font-medium text-gray-900 dark:text-white">
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
