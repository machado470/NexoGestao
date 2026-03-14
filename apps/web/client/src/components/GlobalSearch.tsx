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

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: false,
  });

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    { page: 1, limit: 1000 },
    { enabled: false }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 1000 },
    { enabled: false }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 1000 },
    { enabled: false }
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchTerm = query.trim().toLowerCase();

    void Promise.all([
      customersQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
    ])
      .then(([customers, appointments, serviceOrders, charges]) => {
        const foundResults: SearchResult[] = [];

        const customersList = Array.isArray((customers.data as any)?.data)
          ? (customers.data as any).data
          : Array.isArray(customers.data)
            ? customers.data
            : [];

        const appointmentsList = Array.isArray((appointments.data as any)?.data)
          ? (appointments.data as any).data
          : Array.isArray(appointments.data)
            ? appointments.data
            : [];

        const serviceOrdersList = Array.isArray(
          (serviceOrders.data as any)?.data
        )
          ? (serviceOrders.data as any).data
          : Array.isArray(serviceOrders.data)
            ? serviceOrders.data
            : [];

        const chargesList = Array.isArray((charges.data as any)?.data)
          ? (charges.data as any).data
          : Array.isArray(charges.data)
            ? charges.data
            : [];

        customersList.forEach((customer: any) => {
          const name = String(customer?.name ?? "").toLowerCase();
          const email = String(customer?.email ?? "").toLowerCase();
          const phone = String(customer?.phone ?? "");

          if (
            name.includes(searchTerm) ||
            email.includes(searchTerm) ||
            phone.includes(searchTerm)
          ) {
            foundResults.push({
              id: customer.id,
              type: "customer",
              title: customer.name,
              subtitle: customer.email || customer.phone || "Cliente",
              icon: <Users className="w-4 h-4" />,
              route: "/customers",
            });
          }
        });

        appointmentsList.forEach((appointment: any) => {
          const title = String(appointment?.title ?? "").toLowerCase();

          if (title.includes(searchTerm)) {
            foundResults.push({
              id: appointment.id,
              type: "appointment",
              title: appointment.title || "Agendamento",
              subtitle: appointment.startsAt
                ? new Date(appointment.startsAt).toLocaleDateString("pt-BR")
                : "Sem data",
              icon: <Calendar className="w-4 h-4" />,
              route: "/appointments",
            });
          }
        });

        serviceOrdersList.forEach((serviceOrder: any) => {
          const title = String(serviceOrder?.title ?? "").toLowerCase();

          if (title.includes(searchTerm)) {
            foundResults.push({
              id: serviceOrder.id,
              type: "serviceOrder",
              title: serviceOrder.title || "Ordem de serviço",
              subtitle: serviceOrder.status || "Sem status",
              icon: <Briefcase className="w-4 h-4" />,
              route: "/service-orders",
            });
          }
        });

        chargesList.forEach((charge: any) => {
          const description = String(charge?.description ?? "").toLowerCase();

          if (description.includes(searchTerm)) {
            foundResults.push({
              id: charge.id,
              type: "charge",
              title: charge.description || "Cobrança",
              subtitle: formatCurrencyFromCharge(charge),
              icon: <DollarSign className="w-4 h-4" />,
              route: "/finances",
            });
          }
        });

        setResults(foundResults.slice(0, 8));
        setIsSearching(false);
      })
      .catch((error) => {
        console.error("Erro ao buscar resultados de pesquisa:", error);
        setResults([]);
        setIsSearching(false);
      });
  }, [query]);

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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400 pointer-events-none dark:text-gray-600" />

        <input
          type="text"
          placeholder="Buscar clientes, agendamentos..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />

        {query && (
          <button
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

      {isOpen && (
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
