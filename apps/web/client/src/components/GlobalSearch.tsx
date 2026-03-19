import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search,
  X,
  Users,
  Calendar,
  Briefcase,
  DollarSign,
  Loader,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

interface SearchResult {
  id: string | number;
  type: "customer" | "appointment" | "serviceOrder" | "charge";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  route: string;
}

function formatCurrencyFromCharge(charge: any) {
  const cents = Number(charge?.amountCents ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function normalizeArrayPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function includesTerm(value: unknown, searchTerm: string) {
  return String(value ?? "").toLowerCase().includes(searchTerm);
}

export function GlobalSearch() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    {
      enabled: false,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 100 },
    {
      enabled: false,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!canQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const searchTerm = trimmed.toLowerCase();

    setIsSearching(true);

    void Promise.all([
      customersQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
    ])
      .then(([customers, appointments, serviceOrders, charges]) => {
        if (cancelled) return;

        const foundResults: SearchResult[] = [];
        const seen = new Set<string>();

        const customersList = normalizeArrayPayload(customers.data);
        const appointmentsList = normalizeArrayPayload(appointments.data);
        const serviceOrdersList = normalizeArrayPayload(serviceOrders.data);
        const chargesList = normalizeArrayPayload(charges.data);

        customersList.forEach((customer: any) => {
          const matches =
            includesTerm(customer?.name, searchTerm) ||
            includesTerm(customer?.email, searchTerm) ||
            includesTerm(customer?.phone, searchTerm) ||
            includesTerm(customer?.notes, searchTerm);

          if (!matches) return;

          const key = `customer-${customer.id}`;
          if (seen.has(key)) return;
          seen.add(key);

          foundResults.push({
            id: customer.id,
            type: "customer",
            title: customer.name || "Cliente",
            subtitle: customer.email || customer.phone || "Cliente",
            icon: <Users className="h-4 w-4" />,
            route: `/customers?customerId=${customer.id}`,
          });
        });

        appointmentsList.forEach((appointment: any) => {
          const matches =
            includesTerm(appointment?.customer?.name, searchTerm) ||
            includesTerm(appointment?.customer?.phone, searchTerm) ||
            includesTerm(appointment?.notes, searchTerm) ||
            includesTerm(appointment?.status, searchTerm);

          if (!matches) return;

          const key = `appointment-${appointment.id}`;
          if (seen.has(key)) return;
          seen.add(key);

          foundResults.push({
            id: appointment.id,
            type: "appointment",
            title: appointment?.customer?.name || "Agendamento",
            subtitle: appointment?.startsAt
              ? new Date(appointment.startsAt).toLocaleDateString("pt-BR")
              : appointment?.status || "Sem data",
            icon: <Calendar className="h-4 w-4" />,
            route: `/appointments?appointmentId=${appointment.id}`,
          });
        });

        serviceOrdersList.forEach((serviceOrder: any) => {
          const matches =
            includesTerm(serviceOrder?.title, searchTerm) ||
            includesTerm(serviceOrder?.status, searchTerm) ||
            includesTerm(serviceOrder?.customer?.name, searchTerm) ||
            includesTerm(serviceOrder?.notes, searchTerm);

          if (!matches) return;

          const key = `serviceOrder-${serviceOrder.id}`;
          if (seen.has(key)) return;
          seen.add(key);

          foundResults.push({
            id: serviceOrder.id,
            type: "serviceOrder",
            title: serviceOrder.title || "Ordem de serviço",
            subtitle:
              serviceOrder?.customer?.name ||
              serviceOrder?.status ||
              "Sem status",
            icon: <Briefcase className="h-4 w-4" />,
            route: `/service-orders?serviceOrderId=${serviceOrder.id}`,
          });
        });

        chargesList.forEach((charge: any) => {
          const matches =
            includesTerm(charge?.notes, searchTerm) ||
            includesTerm(charge?.status, searchTerm) ||
            includesTerm(charge?.customer?.name, searchTerm) ||
            includesTerm(charge?.customer?.phone, searchTerm) ||
            includesTerm(charge?.serviceOrder?.title, searchTerm) ||
            includesTerm(charge?.id, searchTerm);

          if (!matches) return;

          const key = `charge-${charge.id}`;
          if (seen.has(key)) return;
          seen.add(key);

          foundResults.push({
            id: charge.id,
            type: "charge",
            title:
              charge?.serviceOrder?.title ||
              charge?.customer?.name ||
              "Cobrança",
            subtitle: `${formatCurrencyFromCharge(charge)} • ${
              charge?.status || "Sem status"
            }`,
            icon: <DollarSign className="h-4 w-4" />,
            route: `/finances?chargeId=${charge.id}`,
          });
        });

        setResults(foundResults.slice(0, 8));
        setIsSearching(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Erro ao buscar resultados de pesquisa:", error);
        setResults([]);
        setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canQuery, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    navigate(result.route);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400 dark:text-gray-600" />

        <input
          type="text"
          placeholder={
            canQuery
              ? "Buscar clientes, agendamentos..."
              : "Faça login para buscar"
          }
          value={query}
          disabled={!canQuery}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && canQuery && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 p-4 text-gray-600 dark:text-gray-400">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Buscando...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 last:border-b-0 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <div className="flex-shrink-0 text-gray-400 dark:text-gray-600">
                    {result.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {result.title}
                    </p>

                    {result.subtitle && (
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum resultado encontrado
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
