import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/executive-dashboard": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Visão Geral" },
  ],
  "/dashboard/operations": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Dashboard Operacional" },
  ],
  "/operations": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Workflow Operacional" },
  ],
  "/customers": [
    { label: "Operação", href: "/customers" },
    { label: "Clientes" },
  ],
  "/appointments": [
    { label: "Operação", href: "/customers" },
    { label: "Agendamentos" },
  ],
  "/calendar": [
    { label: "Operação", href: "/customers" },
    { label: "Calendário" },
  ],
  "/service-orders": [
    { label: "Operação", href: "/customers" },
    { label: "Ordens de Serviço" },
  ],
  "/timeline": [
    { label: "Operação", href: "/customers" },
    { label: "Timeline" },
  ],
  "/finances": [
    { label: "Financeiro", href: "/finances" },
    { label: "Financeiro" },
  ],
  "/invoices": [
    { label: "Financeiro", href: "/finances" },
    { label: "Faturas" },
  ],
  "/expenses": [
    { label: "Financeiro", href: "/finances" },
    { label: "Despesas" },
  ],
  "/launches": [
    { label: "Financeiro", href: "/finances" },
    { label: "Lançamentos" },
  ],
  "/governance": [
    { label: "Governança", href: "/governance" },
    { label: "Governança" },
  ],
  "/people": [
    { label: "Governança", href: "/governance" },
    { label: "Pessoas" },
  ],
  "/referrals": [
    { label: "Governança", href: "/governance" },
    { label: "Referências" },
  ],
  "/whatsapp": [
    { label: "Comunicação", href: "/whatsapp" },
    { label: "WhatsApp" },
  ],
  "/settings": [
    { label: "Sistema", href: "/settings" },
    { label: "Configurações" },
  ],
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
    calendar: "Calendário",
    "service-orders": "Ordens de Serviço",
    timeline: "Timeline",
    finances: "Financeiro",
    invoices: "Faturas",
    expenses: "Despesas",
    launches: "Lançamentos",
    governance: "Governança",
    people: "Pessoas",
    referrals: "Referências",
    whatsapp: "WhatsApp",
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

function getBreadcrumbs(location: string) {
  const exact = routeBreadcrumbs[location];
  if (exact) return exact;

  const matchedEntry = Object.entries(routeBreadcrumbs).find(([route]) => {
    return route !== "/" && location.startsWith(route);
  });

  if (matchedEntry) {
    return matchedEntry[1];
  }

  return [{ label: humanizeSegment(location) }];
}

export function Breadcrumbs() {
  const [location, navigate] = useLocation();

  const breadcrumbs = getBreadcrumbs(location);
  const allBreadcrumbs = [{ label: "Início", href: "/executive-dashboard" }, ...breadcrumbs];

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      {allBreadcrumbs.map((crumb, index) => (
        <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
          )}

          {crumb.href ? (
            <button
              type="button"
              onClick={() => navigate(crumb.href!)}
              className={`transition-colors hover:text-orange-600 dark:hover:text-orange-400 ${
                index === 0
                  ? "flex items-center"
                  : "font-medium"
              }`}
            >
              {index === 0 ? <Home className="h-4 w-4" /> : crumb.label}
            </button>
          ) : (
            <span className="font-medium text-zinc-900 dark:text-white">
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
