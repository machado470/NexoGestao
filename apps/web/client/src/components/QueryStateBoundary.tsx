import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton key={colIndex} className="h-9" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function QueryStateBoundary({
  isLoading,
  isError,
  errorMessage,
  onRetry,
  isEmpty,
  empty,
  loading,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry: () => void;
  isEmpty?: boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) {
    return <>{loading ?? <TableSkeleton />}</>;
  }

  if (isError) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-950/20">
        <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <>{
        empty ?? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Nenhum dado encontrado"
            description="Ajuste os filtros ou adicione novos registros."
          />
        )
      }</>
    );
  }

  return <>{children}</>;
}
