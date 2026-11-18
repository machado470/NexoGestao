export type AvailabilityDraft = {
  startsAt: string;
  endsAt: string;
  reason: string;
  error: string | null;
  removalError: string | null;
};
export type AvailabilityDrafts = Record<string, AvailabilityDraft>;
const emptyDraft: AvailabilityDraft = {
  startsAt: "",
  endsAt: "",
  reason: "",
  error: null,
  removalError: null,
};
export function availabilityDraftFor(
  state: AvailabilityDrafts,
  personId: string | null
) {
  return personId ? (state[personId] ?? emptyDraft) : emptyDraft;
}
type Action =
  | {
      type: "edit";
      personId: string;
      values: Partial<
        Pick<AvailabilityDraft, "startsAt" | "endsAt" | "reason">
      >;
    }
  | { type: "error" | "removalError"; personId: string; message: string | null }
  | { type: "saved" | "removed"; personId: string };
/** Every response carries its submitted personId, never the currently selected row. */
export function availabilityDraftsReducer(
  state: AvailabilityDrafts,
  action: Action
): AvailabilityDrafts {
  if (!action.personId) return state;
  const previous = availabilityDraftFor(state, action.personId);
  let next: AvailabilityDraft;
  switch (action.type) {
    case "edit":
      next = { ...previous, ...action.values, error: null };
      break;
    case "error":
      next = { ...previous, error: action.message };
      break;
    case "removalError":
      next = { ...previous, removalError: action.message };
      break;
    case "saved":
      next = { ...previous, startsAt: "", endsAt: "", reason: "", error: null };
      break;
    case "removed":
      next = { ...previous, removalError: null };
      break;
  }
  return { ...state, [action.personId]: next };
}
