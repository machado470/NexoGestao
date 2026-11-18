import { describe, expect, it } from "vitest";
import {
  availabilityDraftFor,
  availabilityDraftsReducer as reduce,
  type AvailabilityDrafts,
} from "./availability-drafts";
const edit = (state: AvailabilityDrafts, personId: string, reason: string) =>
  reduce(state, {
    type: "edit",
    personId,
    values: {
      startsAt: "2026-11-20T09:00",
      endsAt: "2026-11-20T10:00",
      reason,
    },
  });
describe("availability drafts belong to the submitted person", () => {
  it("preserves independent drafts when switching people", () => {
    const state = edit(edit({}, "A", "Consulta A"), "B", "Consulta B");
    expect(availabilityDraftFor(state, "A").reason).toBe("Consulta A");
    expect(availabilityDraftFor(state, "B").reason).toBe("Consulta B");
    expect(availabilityDraftFor(state, "C").reason).toBe("");
  });
  it("a late success clears only its person's draft", () => {
    const before = edit(edit({}, "A", "A"), "B", "B");
    const after = reduce(before, { type: "saved", personId: "A" });
    expect(after.A.reason).toBe("");
    expect(after.B).toBe(before.B);
    expect(before.A.reason).toBe("A");
  });
  it("a late failure stays with its person and preserves input", () => {
    const before = edit(edit({}, "A", "A"), "B", "B");
    const after = reduce(before, {
      type: "error",
      personId: "A",
      message: "Recusado",
    });
    expect(after.A.reason).toBe("A");
    expect(after.A.error).toBe("Recusado");
    expect(after.B.error).toBeNull();
  });
  it("removal feedback does not appear on another person", () => {
    let state = reduce(
      {},
      { type: "removalError", personId: "A", message: "Não removido" }
    );
    state = edit(state, "B", "B");
    expect(state.B.removalError).toBeNull();
    state = reduce(state, { type: "removed", personId: "A" });
    expect(state.A.removalError).toBeNull();
    expect(state.B.reason).toBe("B");
  });
  it("editing clears outdated validation feedback without changing another draft", () => {
    const before = reduce(edit({}, "A", "A"), {
      type: "error",
      personId: "A",
      message: "Inválido",
    });
    expect(edit(before, "A", "Corrigido").A.error).toBeNull();
    expect(reduce(before, { type: "saved", personId: "" })).toBe(before);
    expect(availabilityDraftFor(before, null).reason).toBe("");
  });
});
