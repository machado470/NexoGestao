export type PersonEditValues = {
  name: string;
  role: string;
  email: string;
  active: boolean;
  dailyServiceOrderCapacity: string;
  dailyAppointmentCapacity: string;
  workloadNotes: string;
};
export const emptyPersonForm: PersonEditValues = {
  name: "",
  role: "",
  email: "",
  active: true,
  dailyServiceOrderCapacity: "",
  dailyAppointmentCapacity: "",
  workloadNotes: "",
};
export type PersonEditSession = {
  id: string | null;
  version?: string;
  initial: PersonEditValues;
  values: PersonEditValues;
};
export const initialPersonEditSession: PersonEditSession = {
  id: null,
  initial: emptyPersonForm,
  values: emptyPersonForm,
};
type Snapshot = { id: string; version?: string; values: PersonEditValues };
type Action =
  | ({ type: "received" | "reload" } & Snapshot)
  | { type: "edit"; values: Partial<PersonEditValues> }
  | { type: "discard" }
  | { type: "closed" };
export function personEditSessionReducer(
  state: PersonEditSession,
  action: Action
): PersonEditSession {
  if (action.type === "closed") return initialPersonEditSession;
  if (action.type === "discard")
    return { ...state, values: { ...state.initial } };
  if (action.type === "edit")
    return { ...state, values: { ...state.values, ...action.values } };
  if (action.type === "received" && state.id === action.id) return state;
  return {
    id: action.id,
    version: action.version,
    initial: { ...action.values },
    values: { ...action.values },
  };
}
