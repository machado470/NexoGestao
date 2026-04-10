import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OperationalStickyZone({
  summaryCards,
  searchBar,
  children,
  className,
}: {
  summaryCards: ReactNode;
  searchBar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-h-0 flex flex-1 flex-col overflow-hidden", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="sticky top-0 z-10 space-y-3 border-b border-[var(--border-soft)] bg-[var(--bg-app)]/95 pb-3 backdrop-blur">
          <OperationalSummaryCards>{summaryCards}</OperationalSummaryCards>
          {searchBar ? <OperationalSearchBar>{searchBar}</OperationalSearchBar> : null}
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </section>
  );
}

export function OperationalSummaryCards({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>;
}

export function OperationalSearchBar({ children }: { children: ReactNode }) {
  return (
    <div className="nexo-surface-operational p-3 md:p-4">
      {children}
    </div>
  );
}
