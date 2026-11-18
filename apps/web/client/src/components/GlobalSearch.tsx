import {
  normalizeGlobalSearchResults,
  type SearchResult,
} from "@/lib/global-search-results";
import { canVisitMobileRoute } from "@/lib/mobile-navigation";
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

export function GlobalSearch({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { isAuthenticated, isInitializing, role } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const globalSearchQuery = trpc.globalSearch.search.useQuery(
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

  const currentQuery = query.trim();
  const matchesQuery =
    currentQuery.length >= 2 && currentQuery === debouncedQuery;
  const normalized = normalizeGlobalSearchResults(globalSearchQuery.data, role);
  const isSearching =
    canQuery &&
    currentQuery.length >= 2 &&
    (!matchesQuery ||
      globalSearchQuery.isLoading ||
      globalSearchQuery.isFetching);
  const hasSearchError =
    canQuery &&
    matchesQuery &&
    !isSearching &&
    (globalSearchQuery.isError || !normalized.valid);
  const results =
    matchesQuery && !isSearching && !hasSearchError ? normalized.results : [];

  const handleSelectResult = (result: SearchResult) => {
    if (
      !matchesQuery ||
      isSearching ||
      hasSearchError ||
      !canVisitMobileRoute(role, result.route)
    )
      return;
    navigate(result.route);
    onNavigate?.();
    setQuery("");
    setDebouncedQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} className="relative min-w-0 w-full">
      <div
        className="nexo-search-input relative min-w-0 h-11"
        style={{
          backgroundColor: "var(--field-bg)",
          borderColor: "var(--field-border)",
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-[var(--modal-section-muted)]" />

        <input
          type="text"
          aria-label="Busca global"
          placeholder={
            canQuery
              ? compact
                ? "Buscar..."
                : "Buscar clientes, agendamentos..."
              : "Entre para pesquisar"
          }
          value={query}
          disabled={!canQuery}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="h-full min-w-0 w-full bg-transparent py-2 pl-9 pr-9 text-base text-[var(--app-overlay-text)] placeholder:text-[var(--modal-section-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        {query ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setIsOpen(false);
            }}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center transform text-[var(--modal-section-muted)] transition-colors hover:text-[var(--app-overlay-text)]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isOpen && canQuery && (
        <div
          className={`nexo-floating-panel z-50 mt-2 overflow-hidden rounded-[var(--radius-surface)] p-1 ${compact ? "relative" : "absolute left-0 right-0 top-full max-h-96"}`}
          style={{
            backgroundColor: "var(--app-overlay-surface)",
            borderColor: "var(--app-overlay-border)",
          }}
        >
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 p-4 text-[var(--modal-section-muted)]">
              <Loader className="h-4 w-4 animate-spin" />
              <span className="text-sm">Buscando...</span>
            </div>
          ) : hasSearchError ? (
            <div
              role="alert"
              className="p-4 text-sm text-[var(--app-overlay-text)]"
            >
              <p>Não foi possível carregar a busca.</p>
              <button
                type="button"
                className="mt-2 min-h-11 font-semibold"
                onClick={() => void globalSearchQuery.refetch()}
              >
                Tentar novamente
              </button>
            </div>
          ) : results.length > 0 ? (
            <div
              className="max-h-[min(24rem,45dvh)] overflow-y-auto"
              data-scrollbar="nexo"
            >
              {results.map(result => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--accent-soft)]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[var(--modal-section-muted)]"
                    style={{
                      backgroundColor: "var(--field-bg)",
                      borderColor: "var(--field-border)",
                    }}
                  >
                    {getResultIcon(result.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--app-overlay-text)]">
                      {result.title}
                    </p>

                    {result.subtitle && (
                      <p className="truncate text-xs text-[var(--modal-section-muted)]">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="p-4 text-center text-sm text-[var(--modal-section-muted)]">
              Nenhum resultado para essa busca.
            </div>
          ) : (
            <p className="p-3 text-sm text-[var(--modal-section-muted)]">
              Digite pelo menos 2 caracteres.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
