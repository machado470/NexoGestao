import { compareOperationalPriority, type OperationalPriorityInput } from "@/lib/operational-prioritization";
import { normalizeOperationalSeverity, type OperationalSeverity } from "@/lib/operational-semantics";

export type OperationalAttentionItem = OperationalPriorityInput & {
  key?: string;
  title?: string;
  context?: string;
  domain?: string | null;
  type?: string | null;
  actionLabel?: string;
  actionPath?: string;
  status?: string;
  hiddenCount?: number;
  mergedKeys?: string[];
  [key: string]: unknown;
};

export type AttentionSummary = {
  total: number;
  visible: number;
  hidden: number;
  hiddenByDomain: Record<string, number>;
  hiddenByType: Record<string, number>;
  hiddenMessage: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDomain(item: OperationalAttentionItem) {
  return String(item.domain ?? "general").trim().toLowerCase() || "general";
}

function getType(item: OperationalAttentionItem) {
  return String(item.type ?? "generic").trim().toLowerCase() || "generic";
}

function getOverdueDays(item: OperationalAttentionItem) {
  const dueDate = toDate(item.dueDate);
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
}

function hasGreaterFinancialImpact(a: OperationalAttentionItem, b: OperationalAttentionItem) {
  return Number(a.amountCents ?? 0) > Number(b.amountCents ?? 0);
}

function isOlderOverdue(a: OperationalAttentionItem, b: OperationalAttentionItem) {
  return getOverdueDays(a) > getOverdueDays(b);
}

export function shouldSuppressSignal(signal: OperationalAttentionItem, context: OperationalAttentionItem[]) {
  const severity = normalizeOperationalSeverity(signal.severity);
  if (severity === "CRITICAL") return false;

  const domain = getDomain(signal);
  const hasCriticalInDomain = context.some(item => {
    if (item === signal) return false;
    return getDomain(item) === domain && normalizeOperationalSeverity(item.severity) === "CRITICAL";
  });

  if (severity === "WARNING" && hasCriticalInDomain) return true;

  return false;
}

export function groupOperationalSignals(items: OperationalAttentionItem[]) {
  const grouped = new Map<string, OperationalAttentionItem[]>();

  for (const item of items) {
    const key = `${getDomain(item)}:${getType(item)}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  return grouped;
}

export function mergeSimilarAttentionItems(items: OperationalAttentionItem[]) {
  const grouped = groupOperationalSignals(items);
  const merged: OperationalAttentionItem[] = [];

  for (const [, group] of grouped.entries()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    const ordered = [...group].sort((a, b) => {
      if (hasGreaterFinancialImpact(a, b)) return -1;
      if (hasGreaterFinancialImpact(b, a)) return 1;
      if (isOlderOverdue(a, b)) return -1;
      if (isOlderOverdue(b, a)) return 1;
      return compareOperationalPriority(a, b);
    });

    const dominant = ordered[0];
    const hiddenCount = ordered.length - 1;
    merged.push({
      ...dominant,
      hiddenCount,
      mergedKeys: ordered.map(item => String(item.key ?? "")).filter(Boolean),
      context: `${String(dominant.context ?? "")} +${hiddenCount} pendências semelhantes`,
    });
  }

  return merged;
}

export function suppressOperationalNoise(items: OperationalAttentionItem[]) {
  return items.filter(item => !shouldSuppressSignal(item, items));
}

export function getVisibleAttentionItems(items: OperationalAttentionItem[], limit = 4) {
  const merged = mergeSimilarAttentionItems(suppressOperationalNoise(items));
  return [...merged]
    .sort((a, b) => {
      const severityA = normalizeOperationalSeverity(a.severity);
      const severityB = normalizeOperationalSeverity(b.severity);
      if (severityA === "CRITICAL" && severityB !== "CRITICAL") return -1;
      if (severityB === "CRITICAL" && severityA !== "CRITICAL") return 1;
      if (Number(a.amountCents ?? 0) !== Number(b.amountCents ?? 0)) {
        return Number(b.amountCents ?? 0) - Number(a.amountCents ?? 0);
      }
      if (getOverdueDays(a) !== getOverdueDays(b)) {
        return getOverdueDays(b) - getOverdueDays(a);
      }
      return compareOperationalPriority(a, b);
    })
    .slice(0, Math.max(1, limit));
}

export function getAttentionSummary(items: OperationalAttentionItem[]): AttentionSummary {
  const total = items.length;
  const visibleItems = getVisibleAttentionItems(items);
  const visibleKeys = new Set(visibleItems.map(item => String(item.key ?? "")));
  const hiddenItems = items.filter(item => !visibleKeys.has(String(item.key ?? "")));

  const hiddenByDomain: Record<string, number> = {};
  const hiddenByType: Record<string, number> = {};

  for (const item of hiddenItems) {
    const domain = getDomain(item);
    const type = getType(item);
    hiddenByDomain[domain] = (hiddenByDomain[domain] ?? 0) + 1;
    hiddenByType[type] = (hiddenByType[type] ?? 0) + 1;
  }

  const hidden = hiddenItems.length;
  const hiddenMessage = hidden > 0 ? `+${hidden} pendências semelhantes` : "Sem pendências ocultas";

  return {
    total,
    visible: visibleItems.length,
    hidden,
    hiddenByDomain,
    hiddenByType,
    hiddenMessage,
  };
}

export function normalizeAttentionSeverity(value: string | null | undefined): OperationalSeverity {
  return normalizeOperationalSeverity(value);
}
