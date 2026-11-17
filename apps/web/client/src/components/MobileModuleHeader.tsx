import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/** A compact, shared title and primary action for operational phone screens. */
export function MobileModuleHeader({
  title,
  description,
  context,
  primaryAction,
  onRefresh,
}: {
  title: string;
  description?: string;
  context?: ReactNode;
  primaryAction?: ReactNode;
  onRefresh?: () => void;
}) {
  return (
    <header className="mobile-module-header md:hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {primaryAction ? (
          <div className="max-w-[55%] shrink-0">{primaryAction}</div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
      ) : null}
      {context || onRefresh ? (
        <div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <span className="min-w-0 break-words">{context}</span>
          {onRefresh ? (
            <button
              type="button"
              className="flex min-h-11 shrink-0 items-center gap-2 text-sm"
              onClick={onRefresh}
              aria-label={`Atualizar ${title}`}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
