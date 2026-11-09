import { describe, expect, it } from "vitest";
import { parseAvailabilityInterval } from "./availability-input";
describe("availability interval before submission", () => {
  it.each([
    ["", ""],
    ["invalid", "2026-11-10T10:00"],
    ["2026-02-30T09:00", "2026-03-02T10:00"],
    ["2026-11-10T09:00", "2026-11-10T09:00"],
    ["2026-11-10T10:00", "2026-11-10T09:00"],
    ["2026-11-11T10:00", "2026-11-10T09:00"],
  ])("rejects %s to %s without throwing", (start, end) => {
    expect(parseAvailabilityInterval(start, end).ok).toBe(false);
  });
  it("converts local controls into explicit ISO instants", () => {
    const result = parseAvailabilityInterval(
      "2026-11-10T09:00",
      "2026-11-10T10:00"
    );
    expect(result).toEqual({
      ok: true,
      startsAt: new Date(2026, 10, 10, 9).toISOString(),
      endsAt: new Date(2026, 10, 10, 10).toISOString(),
    });
  });
  it("accepts an interval crossing midnight", () => {
    expect(
      parseAvailabilityInterval("2026-11-10T23:30", "2026-11-11T00:30").ok
    ).toBe(true);
  });
});
