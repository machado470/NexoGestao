import { describe, expect, it } from "vitest";
import {
  hasSettingsChanges,
  initialSettingsDraft,
  settingsDraftReducer as reduce,
  type SettingsValues,
} from "./settings-draft";
const original: SettingsValues = {
  name: "Oficina",
  timezone: "UTC",
  currency: "BRL",
};
const loaded = () =>
  reduce(initialSettingsDraft, { type: "received", values: original });
describe("settings draft across query refreshes", () => {
  it("loads persisted values without marking them dirty", () => {
    expect(loaded().values).toEqual(original);
    expect(hasSettingsChanges(loaded())).toBe(false);
  });
  it("preserves local changes while adopting refreshed untouched fields", () => {
    const editing = reduce(loaded(), {
      type: "edit",
      values: { name: "Nome em edição" },
    });
    const refreshed = reduce(editing, {
      type: "received",
      values: {
        name: "Alterado remotamente",
        timezone: "Europe/Lisbon",
        currency: "EUR",
      },
    });
    expect(refreshed.values).toEqual({
      name: "Nome em edição",
      timezone: "Europe/Lisbon",
      currency: "EUR",
    });
    expect(hasSettingsChanges(refreshed)).toBe(true);
  });
  it("preserves every edited field across repeated refreshes", () => {
    let state = reduce(loaded(), {
      type: "edit",
      values: {
        name: "Rascunho",
        timezone: "America/Sao_Paulo",
        currency: "USD",
      },
    });
    for (const name of ["Remoto A", "Remoto B"])
      state = reduce(state, {
        type: "received",
        values: { ...original, name },
      });
    expect(state.values).toEqual({
      name: "Rascunho",
      timezone: "America/Sao_Paulo",
      currency: "USD",
    });
  });
  it("discards into the latest server values rather than the initial snapshot", () => {
    let state = reduce(loaded(), {
      type: "edit",
      values: { name: "Rascunho" },
    });
    const latest = { ...original, name: "Remoto" };
    state = reduce(state, { type: "received", values: latest });
    state = reduce(state, { type: "discard" });
    expect(state.values).toEqual(latest);
    expect(hasSettingsChanges(state)).toBe(false);
  });
  it("recognizes the mutation response as saved without requiring another read", () => {
    const state = reduce(loaded(), {
      type: "edit",
      values: { name: "  Oficina nova  " },
    });
    const confirmed = { ...original, name: "Oficina nova" };
    const saved = reduce(state, { type: "confirmed", values: confirmed });
    expect(saved.values).toEqual(confirmed);
    expect(hasSettingsChanges(saved)).toBe(false);
  });
  it("becomes clean if another administrator saved the same values", () => {
    const state = reduce(loaded(), {
      type: "edit",
      values: { name: "Novo nome" },
    });
    expect(
      hasSettingsChanges(
        reduce(state, {
          type: "received",
          values: { ...original, name: "Novo nome" },
        })
      )
    ).toBe(false);
  });
  it("updates a reverted field on the next refresh", () => {
    let state = reduce(loaded(), {
      type: "edit",
      values: { name: "Rascunho" },
    });
    state = reduce(state, { type: "edit", values: { name: original.name } });
    expect(
      reduce(state, {
        type: "received",
        values: { ...original, name: "Remoto" },
      }).values.name
    ).toBe("Remoto");
  });
});
