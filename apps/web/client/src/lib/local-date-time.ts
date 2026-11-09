type DateValue = string | Date | null | undefined;

function validDate(value: DateValue): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Values for date/time controls use the browser's local clock, not UTC fields. */
export function toLocalDateTimeInput(value: DateValue): string {
  const date = validDate(value);
  if (!date) return "";
  const pad = (number: number, width = 2) =>
    String(number).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Keep the exact original instant when a minute-precision control was not edited. */
export function parseLocalDateTimeInput(
  value: string,
  original?: DateValue
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const previous = validDate(original);
  if (previous && toLocalDateTimeInput(previous) === value) return previous;
  const parsed = validDate(value);
  // Reject invalid calendar dates and nonexistent local times during DST changes.
  return parsed && toLocalDateTimeInput(parsed) === value ? parsed : null;
}
