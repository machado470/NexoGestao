/** Mirrors the API timezone check using the runtime's IANA timezone database. */
export function isValidSettingsTimezone(value: string): boolean {
  const timezone = value.trim();
  if (!timezone || /^[+-]/.test(timezone)) return false;
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
