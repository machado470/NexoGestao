import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import { getNextAction } from "@/lib/operations/next-action";

export function NextActionCell({ entity, item }: { entity: "service_order" | "charge" | "appointment"; item: any }) {
  const next = getNextAction({ entity, item } as any);

  return (
    <div className="space-y-1">
      <SeverityBadge severity={next.severity} />
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{next.label}</p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{next.reason}</p>
    </div>
  );
}
