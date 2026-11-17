export type Instant = string | Date | number | null | undefined;
export function formatOrganizationDate(
  value: Instant,
  timeZone?: string,
  fallback = "Não informado",
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  }
) {
  if (value == null || value === "") return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      ...options,
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return fallback;
  }
}
/** Display only the persisted denomination. This is not an exchange-rate conversion. */
export function formatRecordedMoney(
  cents: unknown,
  currency: unknown,
  fallback = "Moeda ou valor não informado"
) {
  if (
    typeof cents !== "number" ||
    !Number.isFinite(cents) ||
    typeof currency !== "string" ||
    !/^[A-Za-z]{3}$/.test(currency)
  )
    return fallback;
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return fallback;
  }
}

/** An aggregate can only use a denomination confirmed by its source records. */
export function formatRecordedTotal(
  cents: unknown,
  currencies: unknown,
  emptyCurrency?: string
) {
  if (
    !Array.isArray(currencies) ||
    !currencies.every(value => typeof value === "string")
  )
    return "Moeda não informada";
  if (currencies.length > 1) return "Moedas diferentes";
  return currencies.length === 1
    ? formatRecordedMoney(cents, currencies[0])
    : cents === 0
      ? formatRecordedMoney(0, emptyCurrency)
      : "Moeda não informada";
}
