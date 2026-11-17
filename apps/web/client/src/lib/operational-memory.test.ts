import { afterEach, describe, expect, it, vi } from "vitest";
import { operationalMemoryKey, readOperationalMemory } from "./operational-memory";
afterEach(() => vi.unstubAllGlobals());
describe("operational memory identity boundaries", () => {
  it("isolates users, organizations and ambiguous identifier separators", () => {
    const identities = [["org", "a"], ["org", "b"], ["other", "a"], ["org:a", "b"], ["org", "a:b"]];
    const keys = identities.map(([org, user]) => operationalMemoryKey(org, user, "nexo.whatsapp.composer.v2"));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every(key => key?.startsWith("nexo:"))).toBe(true);
  });
  it.each([[undefined, "a"], ["org", undefined], ["", "a"], ["org", " "]])("never shares an anonymous namespace", (org, user) => expect(operationalMemoryKey(org, user, "draft")).toBeNull());
  it("does not import a legacy draft or another account's value", () => {
    const a = operationalMemoryKey("org", "a", "draft")!;
    const b = operationalMemoryKey("org", "b", "draft")!;
    const values = new Map([["draft", JSON.stringify("legacy private message")], [a, JSON.stringify("account A private message")]]);
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null } });
    expect(readOperationalMemory(a, "")).toBe("account A private message");
    expect(readOperationalMemory(b, "")).toBe("");
    expect(readOperationalMemory(null, "")).toBe("");
  });
  it("tolerates corrupted or blocked storage", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "broken JSON" } });
    expect(readOperationalMemory("key", "default")).toBe("default");
    vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); } });
    expect(readOperationalMemory("key", "default")).toBe("default");
  });
});
