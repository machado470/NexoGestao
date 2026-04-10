import { Badge } from "@/components/ui/badge";
import type { ActionSeverity } from "@/lib/operations/next-action";

const LABEL: Record<ActionSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  normal: "Normal",
  success: "Estável",
};

const CLASSNAME: Record<ActionSeverity, string> = {
  critical: "border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300",
  warning: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
  normal: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300",
  success: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
};

export function SeverityBadge({ severity }: { severity: ActionSeverity }) {
  return <Badge className={CLASSNAME[severity]}>{LABEL[severity]}</Badge>;
}
