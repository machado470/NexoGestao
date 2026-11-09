export type SettingsValues = {
  name: string;
  timezone: string;
  currency: "BRL" | "USD" | "EUR";
};
export type SettingsDraft = {
  baseline: SettingsValues | null;
  values: SettingsValues;
};
export const initialSettingsDraft: SettingsDraft = {
  baseline: null,
  values: { name: "", timezone: "", currency: "BRL" },
};
type Action =
  | { type: "received" | "confirmed"; values: SettingsValues }
  | { type: "edit"; values: Partial<SettingsValues> }
  | { type: "discard" };

export function settingsDraftReducer(
  state: SettingsDraft,
  action: Action
): SettingsDraft {
  if (action.type === "edit")
    return { ...state, values: { ...state.values, ...action.values } };
  if (action.type === "discard")
    return state.baseline ? { ...state, values: { ...state.baseline } } : state;
  const baseline = {
    name: action.values.name,
    timezone: action.values.timezone,
    currency: action.values.currency,
  };
  if (action.type === "confirmed" || !state.baseline)
    return { baseline, values: { ...baseline } };
  // Adopt refreshed values only for fields the user has not changed.
  return {
    baseline,
    values: {
      name:
        state.values.name === state.baseline.name
          ? baseline.name
          : state.values.name,
      timezone:
        state.values.timezone === state.baseline.timezone
          ? baseline.timezone
          : state.values.timezone,
      currency:
        state.values.currency === state.baseline.currency
          ? baseline.currency
          : state.values.currency,
    },
  };
}

export function hasSettingsChanges(state: SettingsDraft): boolean {
  return Boolean(
    state.baseline &&
    (Object.keys(state.values) as Array<keyof SettingsValues>).some(
      key => state.values[key] !== state.baseline![key]
    )
  );
}
