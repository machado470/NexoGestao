import { cn } from "@/lib/utils";
import { executionStatusLabel } from "@/lib/execution/ui";

type ExecutionStatusBadgeProps = {
  status?: string;
  reasonCode?: string | null;
  className?: string;
};

export function ExecutionStatusBadge({ status, reasonCode, className }: ExecutionStatusBadgeProps) {
  const isCooldown = reasonCode === "blocked_recent_execution";
  const isManualBlocked = reasonCode === "mode_manual_explicit_configuration";
  const blocked = status === "blocked" || status === "requires_confirmation" || status === "throttled";

  const tone = status === "executed"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : status === "failed"
      ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
      : isCooldown || isManualBlocked || blocked
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-zinc-500/40 bg-zinc-500/10 text-[var(--text-secondary)]";

  return (
    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", tone, className)}>
      {executionStatusLabel(status, reasonCode)}
    </span>
  );
}
