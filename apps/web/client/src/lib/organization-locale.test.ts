import { describe, expect, it } from "vitest";
import {
  formatOrganizationDate,
  formatRecordedMoney,
  formatRecordedTotal,
} from "./organization-locale";
import {
  organizationDayRange,
  parseLocalDateTimeInput,
  toLocalDateTimeInput,
} from "./local-date-time";

describe("organization timezone and recorded currency", () => {
  it("displays the same instant in the organization timezone across midnight", () => {
    expect(
      formatOrganizationDate("2026-11-17T01:00:00Z", "America/Sao_Paulo")
    ).toContain("16/11/2026");
    expect(
      toLocalDateTimeInput("2026-11-17T01:00:00Z", "America/Sao_Paulo")
    ).toBe("2026-11-16T22:00");
    expect(
      toLocalDateTimeInput("2026-11-17T15:00:00Z", "Pacific/Kiritimati")
    ).toBe("2026-11-18T05:00");
  });
  it("converts company civil time independently of the machine timezone", () => {
    expect(
      parseLocalDateTimeInput(
        "2026-11-17T09:00",
        undefined,
        "America/Sao_Paulo"
      )?.toISOString()
    ).toBe("2026-11-17T12:00:00.000Z");
    const original = "2026-11-17T12:00:15.123Z";
    expect(
      parseLocalDateTimeInput(
        "2026-11-17T09:00",
        original,
        "America/Sao_Paulo"
      )?.toISOString()
    ).toBe(original);
  });
  it("rejects nonexistent and ambiguous new civil times while preserving an untouched instant", () => {
    expect(
      parseLocalDateTimeInput("2026-03-08T02:30", undefined, "America/New_York")
    ).toBeNull();
    expect(
      parseLocalDateTimeInput("2026-11-01T01:30", undefined, "America/New_York")
    ).toBeNull();
    const original = "2026-11-01T06:30:15.123Z";
    expect(
      parseLocalDateTimeInput(
        "2026-11-01T01:30",
        original,
        "America/New_York"
      )?.toISOString()
    ).toBe(original);
    expect(
      parseLocalDateTimeInput("2026-02-30T09:00", undefined, "UTC")
    ).toBeNull();
  });
  it.each([
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ])("uses complete civil-day boundaries on %s", (day, hours) => {
    const range = organizationDayRange(day as string, "America/New_York")!;
    expect(
      new Date(range.to).getTime() - new Date(range.from).getTime() + 1
    ).toBe(Number(hours) * 3600000);
  });
  it("rejects invalid or skipped civil dates", () => {
    expect(organizationDayRange("2026-02-30", "UTC")).toBeNull();
    expect(organizationDayRange("2011-12-30", "Pacific/Apia")).toBeNull();
  });
  it("never labels a mixed or unknown aggregate with the company preference", () => {
    expect(formatRecordedTotal(15000, ["BRL", "USD"], "EUR")).toBe(
      "Moedas diferentes"
    );
    expect(formatRecordedTotal(15000, undefined, "USD")).toBe(
      "Moeda não informada"
    );
    expect(formatRecordedTotal(15000, ["BRL"], "USD")).toContain("R$");
    expect(formatRecordedTotal(0, [], "USD")).toContain("US$");
    expect(formatRecordedTotal(15000, [], "USD")).toBe("Moeda não informada");
  });
  it("keeps persisted denominations and amounts without currency conversion", () => {
    expect(formatRecordedMoney(15000, "BRL")).toContain("R$");
    expect(formatRecordedMoney(15000, "USD")).toContain("US$");
    expect(formatRecordedMoney(15000, "EUR")).toContain("€");
    expect(formatRecordedMoney(15000, undefined)).toBe(
      "Moeda ou valor não informado"
    );
    expect(formatRecordedMoney(NaN, "BRL")).toBe(
      "Moeda ou valor não informado"
    );
  });
});
