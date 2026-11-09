import { describe, expect, it } from "vitest";
import {
  emptyPersonForm,
  initialPersonEditSession,
  personEditSessionReducer as reduce,
} from "./person-edit-session";
const first = {
  id: "person",
  version: "v1",
  values: {
    ...emptyPersonForm,
    name: "Ana",
    dailyServiceOrderCapacity: "5",
    dailyAppointmentCapacity: "4",
  },
};
describe("person edit session under concurrent reads", () => {
  it("keeps capacity edits and their original version after a background update", () => {
    let state = reduce(initialPersonEditSession, {
      type: "received",
      ...first,
    });
    state = reduce(state, {
      type: "edit",
      values: {
        name: "Rascunho",
        dailyServiceOrderCapacity: "7",
        workloadNotes: "Nota local",
      },
    });
    state = reduce(state, {
      type: "received",
      ...first,
      version: "v2",
      values: {
        ...first.values,
        name: "Remoto",
        dailyServiceOrderCapacity: "9",
      },
    });
    expect(state.values).toMatchObject({
      name: "Rascunho",
      dailyServiceOrderCapacity: "7",
      workloadNotes: "Nota local",
    });
    expect(state.version).toBe("v1");
    expect(state.initial).toEqual(first.values);
  });
  it("adopts the new version and values together only on explicit reload", () => {
    const state = reduce(initialPersonEditSession, {
      type: "received",
      ...first,
    });
    const latest = {
      ...first,
      version: "v2",
      values: { ...first.values, dailyServiceOrderCapacity: "9" },
    };
    const next = reduce(state, { type: "reload", ...latest });
    expect(next.version).toBe("v2");
    expect(next.values).toEqual(latest.values);
    expect(next.initial).toEqual(latest.values);
  });
  it("discards local edits into the reviewed snapshot without silently advancing its version", () => {
    let state = reduce(initialPersonEditSession, {
      type: "received",
      ...first,
    });
    state = reduce(state, {
      type: "edit",
      values: { active: false, email: "new@example.com" },
    });
    expect(reduce(state, { type: "discard" })).toMatchObject({
      version: "v1",
      values: first.values,
    });
  });
  it("does not carry a draft to another person", () => {
    let state = reduce(initialPersonEditSession, {
      type: "received",
      ...first,
    });
    state = reduce(state, {
      type: "edit",
      values: { dailyAppointmentCapacity: "10" },
    });
    expect(
      reduce(state, { type: "received", ...first, id: "other" })
    ).toMatchObject({ id: "other", values: first.values });
  });
  it("starts a fresh snapshot after close and reopen", () => {
    const state = reduce(initialPersonEditSession, {
      type: "received",
      ...first,
    });
    const closed = reduce(state, { type: "closed" });
    expect(closed.id).toBeNull();
    expect(
      reduce(closed, { type: "received", ...first, version: "v2" }).version
    ).toBe("v2");
  });
});
