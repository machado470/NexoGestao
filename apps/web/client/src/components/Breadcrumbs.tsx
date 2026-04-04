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
  "/executive-dashboard": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Visão Geral" },
  ],
  "/executive-dashboard-new": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Visão Geral" },
  ],
  "/dashboard/operations": [
    { label: "Visão", href: "/executive-dashboard" },
    { label: "Operação diária" },
  ],
  "/operations": [
    { label: "Operação", href: "/operations" },
    { label: "Workflow" },
  ],
  "/customers": [
    { label: "Operação", href: "/operations" },
    { label: "Clientes" },
  ],
  "/appointments": [
    { label: "Operação", href: "/operations" },
    { label: "Agendamentos" },
  ],
  "/calendar": [
    { label: "Operação", href: "/operations" },
    { label: "Calendário" },
  ],
  "/service-orders": [
    { label: "Operação", href: "/operations" },
    { label: "Ordens de Serviço" },
  ],
  "/timeline": [
    { label: "Operação", href: "/operations" },
    { label: "Histórico" },
  ],
  "/finances": [{ label: "Financeiro" }],
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
  "/governance": [{ label: "Governança" }],
  "/people": [
    { label: "Governança", href: "/governance" },
    { label: "Pessoas" },
  ],
  "/referrals": [
    { label: "Governança", href: "/governance" },
    { label: "Referências" },
  ],
  "/whatsapp": [
    { label: "Operação", href: "/service-orders" },
    { label: "Conversa contextual" },
  ],
  "/settings": [{ label: "Sistema" }, { label: "Configurações" }],
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

  if (pathname === "/service-orders" && params.get("os")) {
    return [
      { label: "Operação", href: "/operations" },
      { label: "Ordens de Serviço", href: "/service-orders" },
      { label: "Detalhe da O.S." },
    ];
  }

  if (pathname === "/customers" && params.get("customerId")) {
    return [
      { label: "Operação", href: "/operations" },
      { label: "Clientes", href: "/customers" },
      { label: "Workspace do cliente" },
    ];
  }

  if (pathname === "/timeline" && params.get("customerId")) {
    return [
      { label: "Operação", href: "/operations" },
      { label: "Histórico", href: "/timeline" },
      { label: "Timeline do cliente" },
    ];
  }

  if (pathname === "/finances" && params.get("chargeId")) {
    return [
      { label: "Financeiro", href: "/finances" },
      { label: "Cobrança em foco" },
    ];
  }

  if (pathname === "/finances" && params.get("paymentId")) {
    return [
      { label: "Financeiro", href: "/finances" },
      { label: "Pagamento em foco" },
    ];
  }

  if (pathname === "/appointments" && params.get("id")) {
    return [
      { label: "Operação", href: "/operations" },
      { label: "Agendamentos", href: "/appointments" },
      { label: "Agendamento em foco" },
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
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
            )}

            {crumb.href && !isLast ? (
              <button
                onClick={() => navigate(crumb.href!)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-zinc-500 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400"
              >
                {index === 0 ? <Home className="h-3.5 w-3.5" /> : crumb.label}
              </button>
            ) : (
              <span className="rounded-md px-1.5 py-0.5 font-semibold text-zinc-900 dark:text-white">
                {crumb.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
