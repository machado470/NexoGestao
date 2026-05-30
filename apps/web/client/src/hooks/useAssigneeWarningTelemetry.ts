import { useCallback, useRef } from "react";
import { useProductAnalytics } from "@/hooks/useProductAnalytics";
import {
  createAssigneeWarningTelemetry,
  type AssigneeWarningContext,
  type AssigneeWarningPayload,
} from "@/lib/assignee-warning-telemetry";

export function useAssigneeWarningTelemetry(context: AssigneeWarningContext) {
  const { track } = useProductAnalytics();
  const trackRef = useRef(track);
  trackRef.current = track;
  const telemetryRef = useRef(
    createAssigneeWarningTelemetry((eventName, payload) => trackRef.current(eventName, payload))
  );

  return {
    trackShown: useCallback(
      (payload: Omit<AssigneeWarningPayload, "context">) =>
        telemetryRef.current.trackShown({ context, ...payload }),
      [context]
    ),
    trackConfirmed: useCallback(
      (personId?: string | null, entityId?: string) =>
        telemetryRef.current.trackConfirmed(context, personId, entityId),
      [context]
    ),
    reset: useCallback(() => telemetryRef.current.reset(), []),
  };
}
