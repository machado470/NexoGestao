import type { ReactNode } from "react";
import { SeverityBadge } from "@/components/operating-system/SeverityBadge";
import type { ActionSeverity } from "@/lib/operations/next-action";

export function AlertStrip({
  title,
  description,
  severity,
  action,
}: {
  title: string;
  description: string;
  severity: ActionSeverity;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SeverityBadge severity={severity} />
          <p className="mt-2 text-sm font-semibold">{title}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
