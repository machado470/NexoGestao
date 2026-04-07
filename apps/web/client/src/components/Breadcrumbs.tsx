import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/dashboard": [{ label: "Dashboard Executivo (alias)" }],
  "/executive-dashboard": [{ label: "Dashboard Executivo" }],
  "/executive-dashboard-new": [{ label: "Dashboard Executivo (alias)" }],
  "/dashboard/operations": [{ label: "Operação diária (legado)" }],
  "/operations": [{ label: "Ordens de Serviço (alias legado)" }],

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
      { label: "Alias legado /operations", href: "/operations" },
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
    <nav className="flex items-center gap-2 text-xs">
      {all.map((crumb, index) => {
        const isLast = index === all.length - 1;

        return (
          <div key={`${crumb.label}-${index}`} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}

            {crumb.href && !isLast ? (
              <button onClick={() => navigate(crumb.href!)}>
                {index === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
              </button>
            ) : (
              <span>{crumb.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
