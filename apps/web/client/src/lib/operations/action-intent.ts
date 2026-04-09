export type ActionIntent = "resolve" | "follow_up" | "notify" | "create";

export type ActionBucket = "critical" | "today" | "pending";

export function getActionIntentLabel(intent: ActionIntent) {
  if (intent === "resolve") return "Resolver";
  if (intent === "follow_up") return "Follow-up";
  if (intent === "notify") return "Notificar";
  return "Criar";
}

export function getActionIntentClasses(intent: ActionIntent) {
  if (intent === "resolve") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300";
  }

  if (intent === "follow_up") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300";
  }

  if (intent === "notify") {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300";
}
