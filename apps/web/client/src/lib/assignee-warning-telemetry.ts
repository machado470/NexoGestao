export const ASSIGNEE_WARNING_EVENT_NAMES = [
  "ASSIGNEE_WARNING_SHOWN",
  "ASSIGNEE_WARNING_CONFIRMED",
] as const;

export type AssigneeWarningEventName = (typeof ASSIGNEE_WARNING_EVENT_NAMES)[number];
export type AssigneeWarningContext = "APPOINTMENT" | "SERVICE_ORDER";
export type AssigneeWarningType =
  | "UNAVAILABLE_NOW"
  | "UNAVAILABLE_SOON"
  | "OVER_CAPACITY"
  | "OVERLOADED";

export type AssigneeWarningPayload = {
  context: AssigneeWarningContext;
  personId: string;
  warningTypes: AssigneeWarningType[];
  entityId?: string;
};

export function getAssigneeWarningKey(payload: AssigneeWarningPayload) {
  return [payload.context, payload.personId, [...payload.warningTypes].sort().join(",")].join(":");
}

export function createAssigneeWarningTelemetry(
  track: (eventName: AssigneeWarningEventName, payload: AssigneeWarningPayload) => void
) {
  const shownKeys = new Set<string>();
  const warningsByPerson = new Map<string, AssigneeWarningType[]>();

  return {
    trackShown(payload: AssigneeWarningPayload) {
      const warningTypes = [...payload.warningTypes].sort();
      if (warningTypes.length === 0) return;

      warningsByPerson.set(payload.personId, warningTypes);
      const normalizedPayload = { ...payload, warningTypes };
      const key = getAssigneeWarningKey(normalizedPayload);
      if (shownKeys.has(key)) return;

      shownKeys.add(key);
      track("ASSIGNEE_WARNING_SHOWN", normalizedPayload);
    },
    trackConfirmed(context: AssigneeWarningContext, personId?: string | null, entityId?: string) {
      if (!personId) return;
      const warningTypes = warningsByPerson.get(personId);
      if (!warningTypes?.length) return;

      track("ASSIGNEE_WARNING_CONFIRMED", {
        context,
        personId,
        warningTypes,
        ...(entityId ? { entityId } : {}),
      });
    },
    reset() {
      shownKeys.clear();
      warningsByPerson.clear();
    },
  };
}
