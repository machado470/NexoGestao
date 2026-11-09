import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseLocalDateTimeInput, toLocalDateTimeInput } from "./local-date-time";

function inTimezone(timezone: string, expression: string) {
  const moduleUrl = new URL("./local-date-time.ts", import.meta.url).href;
  const script = `import {parseLocalDateTimeInput, toLocalDateTimeInput} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath, ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href, "--input-type=module", "-e", script], {
    env: { ...process.env, TZ: timezone }, encoding: "utf8",
  }).trim());
}

describe("local date/time control conversion", () => {
  it.each([
    ["America/Sao_Paulo", "2026-11-08T22:30", "2026-11-08T12:45:00.000Z"],
    ["UTC", "2026-11-09T01:30", "2026-11-09T09:45:00.000Z"],
    ["Asia/Kolkata", "2026-11-09T07:00", "2026-11-09T04:15:00.000Z"],
    ["Pacific/Kiritimati", "2026-11-09T15:30", "2026-11-08T19:45:00.000Z"],
    ["America/New_York", "2026-11-08T20:30", "2026-11-08T14:45:00.000Z"],
  ])("round-trips an untouched instant and converts an explicit local change in %s", (timezone, local, changedUtc) => {
    const original = "2026-11-09T01:30:15.123Z";
    const result = inTimezone(timezone, `(() => {
      const original = ${JSON.stringify(original)};
      const input = toLocalDateTimeInput(original);
      return { input, unchanged: parseLocalDateTimeInput(input, original)?.toISOString(), changed: parseLocalDateTimeInput(input.slice(0, 10) + "T09:45", original)?.toISOString() };
    })()`);
    expect(result).toEqual({ input: local, unchanged: original, changed: changedUtc });
  });

  it("rejects nonexistent daylight-saving times instead of silently moving them", () => {
    expect(inTimezone("America/New_York", 'parseLocalDateTimeInput("2026-03-08T02:30")')).toBeNull();
  });
  it("preserves the original instant in the repeated hour at the end of daylight saving", () => {
    expect(inTimezone("America/New_York", 'parseLocalDateTimeInput("2026-11-01T01:30", "2026-11-01T06:30:15.123Z")?.toISOString()')).toBe("2026-11-01T06:30:15.123Z");
  });
  it.each(["", "invalid", "2026-02-30T09:00", "2026-11-08T24:00", "2026-11-08T09:60", "2026-11-08T09:00:00Z"])("rejects invalid local controls: %s", value => {
    expect(parseLocalDateTimeInput(value)).toBeNull();
  });
  it("keeps empty and invalid persisted dates out of date/time controls", () => {
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(toLocalDateTimeInput(undefined)).toBe("");
    expect(toLocalDateTimeInput("invalid")).toBe("");
    expect(toLocalDateTimeInput(new Date(NaN))).toBe("");
  });
  it("interprets an explicit offset before projecting it into the browser clock", () => {
    expect(inTimezone("UTC", 'toLocalDateTimeInput("2026-11-08T09:30:00-03:00")')).toBe("2026-11-08T12:30");
  });
});
