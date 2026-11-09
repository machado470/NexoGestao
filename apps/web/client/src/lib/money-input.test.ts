import { describe, expect, it } from "vitest";
import { parseMoneyInputToCents } from "./money-input";

describe("money input in charges and service orders", () => {
  it.each([
    ["100.50", 10050],
    ["100,50", 10050],
    ["100", 10000],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["12.345.678,90", 1234567890],
    ["0,01", 1],
    ["0.29", 29],
    ["1,2", 120],
    ["1.2", 120],
    [" 100,50 ", 10050],
    ["0001,05", 105],
    ["21474836,47", 2147483647],
  ])("converts %j to exactly %i cents", (input, cents) => {
    expect(parseMoneyInputToCents(String(input))).toBe(cents);
  });
  it.each([
    "",
    " ",
    "0",
    "0,00",
    "-1",
    "+1",
    "1e3",
    "0x10",
    "Infinity",
    "NaN",
    "1,234",
    "1.2345",
    "100.50.00",
    "12.34,56",
    "1,234.56",
    "1 234,56",
    "1,",
    ".50",
    ",50",
    "1,2,3",
    "R$ 10,00",
    "21474836,48",
    "99999999999999999999999",
  ])("rejects %j without rounding or reinterpreting it", input => {
    expect(parseMoneyInputToCents(input)).toBeNull();
  });
});
