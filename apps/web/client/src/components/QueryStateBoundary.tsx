import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OperationalState } from "@/components/operating-system/OperationalState";

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
    return (
      <>
        {loading ?? (
          <OperationalState
            type="loading"
            title="Carregando contexto operacional"
            description="Estamos atualizando os dados para mostrar a próxima ação com segurança."
          />
        )}
      </>
    );
  }

  if (isError) {
    return (
      <OperationalState
        type="error"
        title="Falha ao carregar este bloco"
        description={errorMessage}
        actionLabel="Tentar novamente"
        onAction={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <>{
        empty ?? (
          <OperationalState
            type="empty"
            title="Sem itens para esta visão"
            description="Ajuste os filtros atuais ou crie um novo registro para destravar o fluxo."
            actionLabel="Recarregar visão"
            onAction={onRetry}
          />
        )
      }</>
    );
  }

  return <>{children}</>;
}
