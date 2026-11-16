/** Positive BRL input. Accept decimal comma/dot and Brazilian thousands groups.
 * Three digits after a dot mean a thousands group: 1.234 = R$ 1.234,00.
 * Convert digit strings directly to cents without floating-point rounding.
 */
export function parseMoneyInputToCents(raw: string): number | null {
  const input = raw.trim();
  let normalized: string;
  if (/^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) {
    normalized = input.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+(?:[,.]\d{1,2})?$/.test(input)) {
    normalized = input.replace(",", ".");
  } else {
    return null;
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole + fraction.padEnd(2, "0"));
  // Monetary columns use PostgreSQL Int, a signed 32-bit integer.
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 2_147_483_647
    ? cents
    : null;
}
