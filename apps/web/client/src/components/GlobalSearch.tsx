import { useEffect, useRef, useState } from "react";
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
  route: string;
}

function getResultIcon(type: SearchResult["type"]) {
  switch (type) {
    case "customer":
      return <Users className="h-4 w-4" />;
    case "appointment":
      return <Calendar className="h-4 w-4" />;
    case "serviceOrder":
      return <Briefcase className="h-4 w-4" />;
    case "charge":
      return <DollarSign className="h-4 w-4" />;
    default:
      return <Search className="h-4 w-4" />;
  }
}

export function GlobalSearch() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const globalSearchQuery = trpc.nexo.globalSearch.search.useQuery(
    {
      query: debouncedQuery,
    },
    {
      enabled: canQuery && debouncedQuery.trim().length >= 2,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!canQuery) {
      setDebouncedQuery("");
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setDebouncedQuery("");
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
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

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const results = Array.isArray(globalSearchQuery.data)
    ? globalSearchQuery.data
    : [];

  const isSearching =
    canQuery &&
    query.trim().length >= 2 &&
    (globalSearchQuery.isLoading || globalSearchQuery.isFetching);

  const handleSelectResult = (result: SearchResult) => {
    navigate(result.route);
    setQuery("");
    setDebouncedQuery("");
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
              setDebouncedQuery("");
              setIsOpen(false);
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
                    {getResultIcon(result.type)}
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
