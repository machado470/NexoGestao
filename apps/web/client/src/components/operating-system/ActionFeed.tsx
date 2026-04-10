import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import { Button } from "@/components/ui/button";
import type { ActionSeverity } from "@/lib/operations/next-action";
import { cn } from "@/lib/utils";

export type ActionFeedItem = {
  id: string;
  entity: string;
  reason: string;
  priority: ActionSeverity;
  nextAction: string;
  onExecute: () => Promise<void> | void;
  amountLabel?: string;
  group?: "financeiro" | "operacional" | "atendimento";
  impactScore?: number;
  urgencyScore?: number;
  isCritical?: boolean;
};

export function ActionFeed({ items }: { items: ActionFeedItem[] }) {
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [justResolvedId, setJustResolvedId] = useState<string | null>(null);
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
    (a, b) => {
      const severityDiff = weight[a.priority] - weight[b.priority];
      if (severityDiff !== 0) return severityDiff;
      const scoreA = (a.impactScore ?? 50) + (a.urgencyScore ?? 50);
      const scoreB = (b.impactScore ?? 50) + (b.urgencyScore ?? 50);
      return scoreB - scoreA;
    }
  );
  const filteredForNoise = sorted.filter(item => item.priority !== "success");
  const groupedFiltered = filteredForNoise.reduce<Record<string, ActionFeedItem[]>>((acc, item) => {
    const key = item.group ?? "operacional";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const nextPriorityId = filteredForNoise[0]?.id ?? null;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Fila operacional</h3>
        <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {filteredForNoise.length} pendente{filteredForNoise.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {justResolvedId ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Item resolvido. Atualizando próxima prioridade...
          </div>
        ) : null}
        {Object.entries(groupedFiltered).map(([group, groupItems]) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {group}
            </p>
            {groupItems.map(item => (
              <div key={item.id} className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-300",
                item.isCritical && "border-red-300/70 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20",
                executingId === item.id && "scale-[0.995] border-orange-300 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20",
                nextPriorityId === item.id && "ring-2 ring-orange-300/50 dark:ring-orange-800/40",
                justResolvedId === item.id && "pointer-events-none translate-x-2 opacity-0"
              )}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {nextPriorityId === item.id ? <Sparkles className="h-3.5 w-3.5 text-orange-500" /> : null}
                    {item.entity}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{item.reason} {item.amountLabel ? `• ${item.amountLabel}` : ""}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    impacto {item.impactScore ?? 50}/100 • urgência {item.urgencyScore ?? 50}/100
                  </p>
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
                          setJustResolvedId(item.id);
                          setTimeout(() => {
                            setResolvedIds(prev => ({ ...prev, [item.id]: true }));
                            setJustResolvedId(null);
                          }, 320);
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
        {filteredForNoise.length === 0 ? (
          <p className="text-xs text-zinc-500">Sem ações pendentes no momento.</p>
        ) : null}
      </div>
    </div>
  );
}
