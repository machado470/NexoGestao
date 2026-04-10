import { useMemo, useState } from "react";
import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import { Button } from "@/components/ui/button";
import type { ActionSeverity } from "@/lib/operations/next-action";

export type ActionFeedItem = {
  id: string;
  entity: string;
  reason: string;
  priority: ActionSeverity;
  nextAction: string;
  onExecute: () => Promise<void> | void;
  amountLabel?: string;
  group?: "financeiro" | "operacional" | "atendimento";
};

export function ActionFeed({ items }: { items: ActionFeedItem[] }) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Record<string, boolean>>({});
  const weight: Record<ActionSeverity, number> = {
    critical: 0,
    warning: 1,
    normal: 2,
    success: 3,
  };
  const visibleItems = useMemo(
    () => items.filter(item => !resolvedIds[item.id]),
    [items, resolvedIds]
  );
  const sorted = [...visibleItems].sort(
    (a, b) => weight[a.priority] - weight[b.priority]
  );
  const grouped = sorted.reduce<Record<string, ActionFeedItem[]>>((acc, item) => {
    const key = item.group ?? "operacional";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">Fila operacional</h3>
      <div className="mt-3 space-y-3">
        {Object.entries(grouped).map(([group, groupItems]) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group}
            </p>
            {groupItems.map(item => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.entity}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{item.reason} {item.amountLabel ? `• ${item.amountLabel}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={item.priority} />
                  <Button
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        setExecutingId(item.id);
                        try {
                          await item.onExecute();
                          setResolvedIds(prev => ({ ...prev, [item.id]: true }));
                        } finally {
                          setExecutingId(null);
                        }
                      })();
                    }}
                    disabled={executingId === item.id}
                  >
                    {executingId === item.id ? "Executando..." : item.nextAction}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}
        {sorted.length === 0 ? (
          <p className="text-xs text-zinc-500">Sem ações pendentes no momento.</p>
        ) : null}
      </div>
    </div>
  );
}
