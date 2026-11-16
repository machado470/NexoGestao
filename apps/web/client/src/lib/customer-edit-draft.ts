export type CustomerEditValues = {
  name: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
};
export type CustomerEditDraft = {
  id: string | null;
  version: string | undefined;
  initial: CustomerEditValues;
  values: CustomerEditValues;
};
const empty: CustomerEditValues = {
  name: "",
  phone: "",
  email: "",
  notes: "",
  active: true,
};
export const initialCustomerEditDraft: CustomerEditDraft = {
  id: null,
  version: undefined,
  initial: empty,
  values: empty,
};
type Snapshot = { id: string; version?: string; values: CustomerEditValues };
type Action =
  | ({ type: "received" | "reload" } & Snapshot)
  | { type: "edit"; values: Partial<CustomerEditValues> }
  | { type: "closed" };
export function customerEditDraftReducer(
  state: CustomerEditDraft,
  action: Action
): CustomerEditDraft {
  if (action.type === "closed") return initialCustomerEditDraft;
  if (action.type === "edit")
    return { ...state, values: { ...state.values, ...action.values } };
  // A background read must not replace either the draft or its concurrency token.
  if (action.type === "received" && state.id === action.id) return state;
  return {
    id: action.id,
    version: action.version,
    initial: { ...action.values },
    values: { ...action.values },
  };
}
export function isCustomerEditDirty(state: CustomerEditDraft): boolean {
  return (
    state.id !== null &&
    (Object.keys(state.values) as Array<keyof CustomerEditValues>).some(key => {
      const value = state.values[key],
        initial = state.initial[key];
      return typeof value === "string" && typeof initial === "string"
        ? value.trim() !== initial.trim()
        : value !== initial;
    })
  );
}
