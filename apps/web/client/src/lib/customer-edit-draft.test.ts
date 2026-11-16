import { describe, expect, it } from "vitest";
import {
  customerEditDraftReducer as reduce,
  initialCustomerEditDraft,
  isCustomerEditDirty,
} from "./customer-edit-draft";
const snapshot = {
  id: "customer-1",
  version: "2026-11-08T12:00:00Z",
  values: {
    name: "Cliente",
    phone: "5511999999999",
    email: "old@example.com",
    notes: "Nota",
    active: true,
  },
};
const loaded = () =>
  reduce(initialCustomerEditDraft, { type: "received", ...snapshot });
describe("customer edit session", () => {
  it("loads all persisted fields and the associated version", () => {
    expect(loaded()).toMatchObject({ ...snapshot, initial: snapshot.values });
    expect(isCustomerEditDirty(loaded())).toBe(false);
  });
  it("preserves edits and the original version across background updates", () => {
    const edited = reduce(loaded(), {
      type: "edit",
      values: { name: "Rascunho", email: "", notes: "", active: false },
    });
    const received = reduce(edited, {
      type: "received",
      ...snapshot,
      version: "2026-11-08T13:00:00Z",
      values: { ...snapshot.values, name: "Remoto" },
    });
    expect(received.values).toEqual({
      ...snapshot.values,
      name: "Rascunho",
      email: "",
      notes: "",
      active: false,
    });
    expect(received.version).toBe(snapshot.version);
    expect(isCustomerEditDirty(received)).toBe(true);
  });
  it("keeps the token associated with the loaded values even without edits", () => {
    expect(
      reduce(loaded(), { type: "received", ...snapshot, version: "new" })
        .version
    ).toBe(snapshot.version);
  });
  it("explicit reload replaces the whole draft and version together", () => {
    const edited = reduce(loaded(), {
      type: "edit",
      values: { name: "Rascunho" },
    });
    const latest = {
      ...snapshot,
      version: "new",
      values: { ...snapshot.values, name: "Remoto" },
    };
    const reloaded = reduce(edited, { type: "reload", ...latest });
    expect(reloaded.values).toEqual(latest.values);
    expect(reloaded.version).toBe("new");
    expect(isCustomerEditDirty(reloaded)).toBe(false);
  });
  it("loads another customer's data without carrying over the previous draft", () => {
    const edited = reduce(loaded(), { type: "edit", values: { email: "" } });
    const other = reduce(edited, {
      type: "received",
      ...snapshot,
      id: "customer-2",
    });
    expect(other.values.email).toBe(snapshot.values.email);
    expect(other.id).toBe("customer-2");
    expect(isCustomerEditDirty(other)).toBe(false);
  });
  it("starts a fresh session after close and reopen", () => {
    const closed = reduce(loaded(), { type: "closed" });
    expect(closed.id).toBeNull();
    expect(
      reduce(closed, { type: "received", ...snapshot, version: "new" }).version
    ).toBe("new");
  });
  it("does not mark surrounding whitespace as a change", () => {
    expect(
      isCustomerEditDirty(
        reduce(loaded(), { type: "edit", values: { name: " Cliente " } })
      )
    ).toBe(false);
  });
});
