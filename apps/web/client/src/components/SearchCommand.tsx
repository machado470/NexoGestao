import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/design-system';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: string;
  action: () => void;
}

interface SearchCommandProps {
  results: SearchResult[];
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function SearchCommand({ results, onSearch, isLoading = false }: SearchCommandProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Open with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    result.action();
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-between text-gray-500"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4" />
          <span className="text-xs">Buscar...</span>
        </div>
        <kbd className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">⌘K</kbd>
      </Button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Search Dialog */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Buscar clientes, agendamentos, ordens..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                onSearch(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="border-0 focus:ring-0 text-lg"
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Buscando...</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {query ? 'Nenhum resultado encontrado' : 'Digite para buscar'}
              </div>
            ) : (
              <div className="p-2">
                {/* Group by category */}
                {Array.from(
                  new Set(results.map((r) => r.category))
                ).map((category) => (
                  <div key={category}>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                      {category}
                    </div>
                    {results
                      .filter((r) => r.category === category)
                      .map((result, idx) => {
                        const globalIdx = results.indexOf(result);
                        return (
                          <button
                            key={result.id}
                            onClick={() => handleSelect(result)}
                            className={`w-full text-left px-3 py-2 rounded transition-colors ${
                              selectedIndex === globalIdx
                                ? 'bg-orange-100 dark:bg-orange-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="font-medium text-sm">{result.title}</div>
                            {result.description && (
                              <div className="text-xs text-gray-500">{result.description}</div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-2">
              <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">↑↓</kbd>
              <span>Navegar</span>
              <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Enter</kbd>
              <span>Selecionar</span>
              <kbd className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Esc</kbd>
              <span>Fechar</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
