import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import { Button } from "@/components/ui/button";
import type { ActionSeverity } from "@/lib/operations/next-action";

export type ActionFeedItem = {
  id: string;
  entity: string;
  reason: string;
  priority: ActionSeverity;
  nextAction: string;
  onExecute: () => void;
  amountLabel?: string;
};

export function ActionFeed({ items }: { items: ActionFeedItem[] }) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Fila operacional</h3>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.entity}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{item.reason} {item.amountLabel ? `• ${item.amountLabel}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadge severity={item.priority} />
              <Button size="sm" onClick={item.onExecute}>{item.nextAction}</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
