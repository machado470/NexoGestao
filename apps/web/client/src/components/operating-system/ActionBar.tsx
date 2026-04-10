import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type ActionBarProps = {
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchSlot?: ReactNode;
  filtersSlot?: ReactNode;
  className?: string;
};

export function ActionBar({
  primaryAction,
  secondaryActions,
  searchValue,
  searchPlaceholder = "Buscar",
  onSearchChange,
  searchSlot,
  filtersSlot,
  className,
}: ActionBarProps) {
  return (
    <section className={cn("nexo-surface p-4", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
          {searchSlot ?? (onSearchChange ? (
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={searchValue ?? ""}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          ) : null)}
          {filtersSlot}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>
    </section>
  );
}

export function ActionBarWrapper(props: ActionBarProps) {
  return <ActionBar {...props} />;
}
