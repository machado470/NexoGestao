import { useLocation } from "wouter";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  href?: string;
}

const routeBreadcrumbs: Record<string, Breadcrumb[]> = {
  "/dashboard": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Central de decisão" },
  ],

  "/dashboard/operations": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Operação diária" },
  ],

  "/operations": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Workflow" },
  ],

  "/service-orders": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Ordens de Serviço" },
  ],

  "/customers": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Clientes" },
  ],

  "/appointments": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Agendamentos" },
  ],

  "/calendar": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Calendário" },
  ],

  "/timeline": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Histórico" },
  ],

  "/whatsapp": [
    { label: "Operação diária", href: "/dashboard/operations" },
    { label: "Conversa" },
  ],

  "/finances": [{ label: "Financeiro" }],

  "/governance": [{ label: "Governança" }],

  "/people": [
    { label: "Governança", href: "/governance" },
    { label: "Pessoas" },
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
      { label: "Operação diária", href: "/dashboard/operations" },
      { label: "Workflow", href: "/operations" },
      { label: "Detalhe da O.S." },
    ];
  }

  if (pathname === "/customers" && params.get("customerId")) {
    return [
      { label: "Operação diária", href: "/dashboard/operations" },
      { label: "Clientes", href: "/customers" },
      { label: "Workspace do cliente" },
    ];
  }

  if (pathname === "/timeline" && params.get("customerId")) {
    return [
      { label: "Operação diária", href: "/dashboard/operations" },
      { label: "Histórico", href: "/timeline" },
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
