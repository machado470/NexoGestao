import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import { getNextAction } from "@/lib/operations/next-action";

export function NextActionCell({ entity, item }: { entity: "service_order" | "charge" | "appointment" | "customer"; item: any }) {
  const next = getNextAction({ entity, item } as any);

  return (
    <div className="space-y-1">
      <SeverityBadge severity={next.severity} />
      <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[var(--text-primary)]">{next.label}</p>
      <p className="text-xs text-[var(--text-secondary)] dark:text-[var(--text-muted)]">{next.reason}</p>
    </div>
  );
}
