import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/dashboard": [{ label: "Dashboard Executivo" }],
  "/executive-dashboard": [{ label: "Dashboard Executivo" }],
  "/executive-dashboard-new": [{ label: "Dashboard Executivo" }],
  "/dashboard/operations": [{ label: "Operação diária" }],
  "/operations": [{ label: "Ordens de Serviço" }],

  "/customers": [{ label: "Clientes" }],

  "/appointments": [
    { label: "Clientes", href: "/customers" },
    { label: "Agendamentos" },
  ],

  "/calendar": [
    { label: "Agendamentos", href: "/appointments" },
    { label: "Calendário" },
  ],

  "/service-orders": [{ label: "Ordens de Serviço" }],

  "/finances": [{ label: "Financeiro" }],

  "/whatsapp": [{ label: "WhatsApp" }],

  "/timeline": [{ label: "Timeline" }],

  "/governance": [{ label: "Governança" }],

  "/people": [
    { label: "Governança", href: "/governance" },
    { label: "Pessoas" },
  ],

  "/settings": [{ label: "Configurações" }],
  "/billing": [{ label: "Planos" }],
  "/onboarding": [{ label: "Jornada de Demonstração" }],
};

function humanizeSegment(path: string) {
  const clean = path
    .replace(/^\/+|\/+$/g, "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .pop();

  if (!clean) return "Início";

  return clean
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function startsWithSegment(location: string, route: string) {
  return location === route || location.startsWith(`${route}/`);
}

function buildDynamicBreadcrumbs(location: string): Breadcrumb[] | null {
  const [pathname, query = ""] = location.split("?");
  const params = new URLSearchParams(query);

  if (pathname === "/operations" && params.get("os")) {
    return [
      { label: "Ordens de Serviço", href: "/service-orders" },
      { label: "Ordens de Serviço", href: "/operations" },
      { label: "Detalhe da O.S." },
    ];
  }

  if (pathname === "/customers" && params.get("customerId")) {
    return [
      { label: "Clientes", href: "/customers" },
      { label: "Workspace do cliente" },
    ];
  }

  if (pathname === "/service-orders" && params.get("os")) {
    return [
      { label: "Ordens de Serviço", href: "/service-orders" },
      { label: "Detalhe da O.S." },
    ];
  }

  if (pathname === "/timeline" && params.get("customerId")) {
    return [
      { label: "Clientes", href: "/customers" },
      { label: "Workspace do cliente" },
      { label: "Timeline do cliente" },
    ];
  }

  return null;
}

function getBreadcrumbs(location: string) {
  const dynamic = buildDynamicBreadcrumbs(location);
  if (dynamic) return dynamic;

  const pathname = location.split("?")[0];
  const exact = routeBreadcrumbs[pathname];
  if (exact) return exact;

  const matched = Object.entries(routeBreadcrumbs).find(([route]) =>
    startsWithSegment(pathname, route)
  );

  if (matched) return matched[1];

  return [{ label: humanizeSegment(pathname) }];
}

export function Breadcrumbs() {
  const [location, navigate] = useLocation();

  const breadcrumbs = getBreadcrumbs(location);
  const all = [{ label: "Início", href: "/executive-dashboard" }, ...breadcrumbs];

  return (
    <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
      {all.map((crumb, index) => {
        const isLast = index === all.length - 1;

        return (
          <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}

            {crumb.href && !isLast ? (
              <button
                type="button"
                onClick={() => navigate(crumb.href!)}
                className="transition-colors hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]"
              >
                {index === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
              </button>
            ) : (
              <span
                className={
                  isLast ? "font-medium text-[var(--text-secondary)] dark:text-[var(--text-primary)]" : undefined
                }
              >
                {crumb.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
