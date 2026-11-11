import { describe, it, expect } from "vitest";
import { buildAuditActorOptions } from "./audit-actor-options";

describe("audit actor options", () => {
  it("includes historical actors absent from the active directory", () => {
    expect(buildAuditActorOptions([], [{ actorPersonId: "inactive", actorName: "Histórico" }], [])).toEqual([{ id: "inactive", label: "Histórico · inactive" }]);
  });
  it("keeps duplicate names distinguishable by authorized secondary identifiers", () => {
    expect(buildAuditActorOptions([{ id: "a", name: "Ana", email: "ana@example.test" }], [{ actorPersonId: "b", actorName: "Ana" }], [])).toEqual([{ id: "a", label: "Ana · ana@example.test" }, { id: "b", label: "Ana · b" }]);
  });
  it("uses event names if directory and summary are unavailable", () => {
    expect(buildAuditActorOptions([], [], [{ actorPersonId: "a", actorName: "Ana" }])).toEqual([{ id: "a", label: "Ana · a" }]);
  });
  it("preserves a selected ID when the date range no longer contains that actor", () => {
    expect(buildAuditActorOptions([], [], [], "selected")).toEqual([{ id: "selected", label: "Ator não identificado · selected" }]);
  });
  it("deduplicates by person ID, enriches unnamed actors and excludes system records", () => {
    expect(buildAuditActorOptions([], [{ actorPersonId: "a", actorName: null }, { actorPersonId: null }], [{ actorPersonId: "a", actorName: "Ana" }])).toEqual([{ id: "a", label: "Ana · a" }]);
  });
});
