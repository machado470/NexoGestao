import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, X, Users, Calendar, Briefcase, DollarSign, Loader } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SearchResult {
  id: number;
  type: "customer" | "appointment" | "serviceOrder" | "charge";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  route: string;
}

export function GlobalSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const customersQuery = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 }, { enabled: false });
  const appointmentsQuery = trpc.data.appointments.list.useQuery({ page: 1, limit: 1000 }, { enabled: false });
  const serviceOrdersQuery = trpc.data.serviceOrders.list.useQuery({ page: 1, limit: 1000 }, { enabled: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 1000 }, { enabled: false });

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const searchTerm = query.toLowerCase();

    // Refetch all data
    Promise.all([
      customersQuery.refetch(),
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
    ]).then(([customers, appointments, serviceOrders, charges]) => {
      const foundResults: SearchResult[] = [];

      // Search in customers
      if (customers.data) {
        const customersList = (customers.data as any).data || customers.data || [];
        customersList.forEach((customer: any) => {
          if (
            customer.name.toLowerCase().includes(searchTerm) ||
            customer.email?.toLowerCase().includes(searchTerm) ||
            customer.phone?.includes(searchTerm)
          ) {
            foundResults.push({
              id: customer.id,
              type: "customer",
              title: customer.name,
              subtitle: customer.email || customer.phone,
              icon: <Users className="w-4 h-4" />,
              route: `/customers`,
            });
          }
        });
      }

      // Search in appointments
      if (appointments.data) {
        const appointmentsList = (appointments.data as any).data || appointments.data || [];
        appointmentsList.forEach((apt: any) => {
          if (apt.title?.toLowerCase().includes(searchTerm)) {
            foundResults.push({
              id: apt.id,
              type: "appointment",
              title: apt.title,
              subtitle: new Date(apt.startsAt).toLocaleDateString("pt-BR"),
              icon: <Calendar className="w-4 h-4" />,
              route: `/appointments`,
            });
          }
        });
      }

      // Search in service orders
      if (serviceOrders.data) {
        const serviceOrdersList = (serviceOrders.data as any).data || serviceOrders.data || [];
        serviceOrdersList.forEach((order: any) => {
          if (order.title.toLowerCase().includes(searchTerm)) {
            foundResults.push({
              id: order.id,
              type: "serviceOrder",
              title: order.title,
              subtitle: order.status,
              icon: <Briefcase className="w-4 h-4" />,
              route: `/service-orders`,
            });
          }
        });
      }

      // Search in charges
      if (charges.data) {
        const chargesList = (charges.data as any).data || charges.data || [];
        chargesList.forEach((charge: any) => {
          if (charge.description?.toLowerCase().includes(searchTerm)) {
            foundResults.push({
              id: charge.id,
              type: "charge",
              title: charge.description,
              subtitle: `R$ ${(charge.amount / 100).toFixed(2)}`,
              icon: <DollarSign className="w-4 h-4" />,
              route: `/finances`,
            });
          }
        });
      }

      setResults(foundResults.slice(0, 8)); // Limit to 8 results
      setIsSearching(false);
    });
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    navigate(result.route);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar clientes, agendamentos..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {isSearching ? (
            <div className="p-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Buscando...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors text-left"
                >
                  <div className="text-gray-400 dark:text-gray-600 flex-shrink-0">{result.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.title}
                    </p>
                    {result.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum resultado encontrado
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
