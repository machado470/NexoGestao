import { safeDate } from "@/lib/operational/kpi";

export type OperationalSignalTone = "critical" | "warning" | "info" | "healthy";

export type OperationalSignal = {
  key: string;
  label: string;
  tone: OperationalSignalTone;
};

export type OperationalNextActionDecision<TIntent extends string> = {
  title: string;
  reason: string;
  impact: string;
  urgency: string;
  intent: TIntent;
  healthy?: boolean;
  secondary: TIntent[];
};

export type CompactTimelineEntry = {
  id: string;
  occurredAt: unknown;
  label: string;
  summary: string;
};

export function getOperationalSignalToneClasses(
  tone: OperationalSignalTone,
  variant: "soft" | "outlined" = "soft"
) {
  if (variant === "outlined") {
    if (tone === "critical") {
      return "border-[var(--dashboard-danger)]/35 bg-[var(--dashboard-danger)]/10 text-[var(--dashboard-danger)]";
    }
    if (tone === "warning") {
      return "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-300";
    }
    if (tone === "info") {
      return "border-sky-500/35 bg-sky-500/10 text-sky-600 dark:text-sky-300";
    }
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (tone === "critical") {
    return "bg-[var(--dashboard-danger)]/15 text-[var(--dashboard-danger)]";
  }
  if (tone === "warning") {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  }
  if (tone === "info") {
    return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  }
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
}

export function buildCompactOperationalTimeline<TEvent>({
  events,
  mapEvent,
  fallbackEvents = [],
  maxItems = 6,
}: {
  events: TEvent[];
  mapEvent: (event: TEvent) => CompactTimelineEntry | null;
  fallbackEvents?: TEvent[];
  maxItems?: number;
}) {
  const primary = events.map(mapEvent).filter(Boolean) as CompactTimelineEntry[];
  const source = primary.length > 0 ? primary : (fallbackEvents.map(mapEvent).filter(Boolean) as CompactTimelineEntry[]);

  return source
    .sort((a, b) => (safeDate(b.occurredAt)?.getTime() ?? 0) - (safeDate(a.occurredAt)?.getTime() ?? 0))
    .slice(0, Math.max(1, maxItems));
}
