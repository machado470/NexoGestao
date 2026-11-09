import { describe, expect, it } from "vitest";
import { isValidSettingsTimezone } from "./settings-validation";

describe("organization timezone input", () => {
  it.each([
    "UTC",
    "America/Sao_Paulo",
    "Europe/Lisbon",
    "Asia/Kolkata",
    " UTC ",
  ])("accepts %s", value => {
    expect(isValidSettingsTimezone(value)).toBe(true);
  });
  it.each(["", "   ", "Mars/Olympus", "+03:00", "-0300", "UTC+3"])(
    "rejects %j",
    value => {
      expect(isValidSettingsTimezone(value)).toBe(false);
    }
  );
});
