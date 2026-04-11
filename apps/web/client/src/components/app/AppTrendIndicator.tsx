import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTrend, resolveTrendDirection } from "@/lib/operational/trend";

export function AppTrendIndicator({ value, label }: { value: number; label?: string }) {
  const direction = resolveTrendDirection(value);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        direction === "up" && "text-emerald-500",
        direction === "down" && "text-rose-500",
        direction === "flat" && "text-[var(--text-muted)]"
      )}
    >
      {direction === "up" ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
      {direction === "down" ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      {direction === "flat" ? <ArrowRight className="h-3.5 w-3.5" /> : null}
      {label ?? formatTrend(value)}
    </span>
  );
}
