import { describe, expect, it } from "vitest";
import { parsePlannedCapacityInput } from "./planned-capacity-input";
describe("planned capacity form input", () => {
  it.each([
    ["1", 1],
    ["100", 100],
    ["007", 7],
    [" 5 ", 5],
  ])("accepts %j as %i", (raw, value) => {
    expect(parsePlannedCapacityInput(String(raw), 5)).toEqual({
      ok: true,
      value,
    });
  });
  it.each([
    "",
    " ",
    "0",
    "101",
    "-1",
    "+5",
    "1.5",
    "1,5",
    "1e2",
    "0x10",
    "Infinity",
    "999999999999999999",
  ])("rejects %j without omitting an existing capacity", raw => {
    expect(parsePlannedCapacityInput(raw, 5)).toEqual({ ok: false });
  });
  it("preserves a legacy unknown capacity when editing unrelated fields", () => {
    expect(parsePlannedCapacityInput("", null)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(parsePlannedCapacityInput("7", null)).toEqual({
      ok: true,
      value: 7,
    });
  });
});
