import { DateTime } from "luxon";
type DateValue = string | Date | null | undefined;

function validDate(value: DateValue): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Project instants into the company clock; legacy callers use the browser clock. */
export function toLocalDateTimeInput(
  value: DateValue,
  timeZone?: string
): string {
  const date = validDate(value);
  if (!date) return "";
  if (timeZone) {
    const zoned = DateTime.fromJSDate(date, { zone: timeZone });
    return zoned.isValid ? zoned.toFormat("yyyy-MM-dd'T'HH:mm") : "";
  }
  const pad = (number: number, width = 2) =>
    String(number).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Keep the exact original instant when a minute-precision control was not edited. */
export function parseLocalDateTimeInput(
  value: string,
  original?: DateValue,
  timeZone?: string
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const previous = validDate(original);
  if (previous && toLocalDateTimeInput(previous, timeZone) === value)
    return previous;
  if (timeZone) {
    const zoned = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm", {
      zone: timeZone,
    });
    if (
      !zoned.isValid ||
      zoned.toFormat("yyyy-MM-dd'T'HH:mm") !== value ||
      zoned.getPossibleOffsets().length !== 1
    )
      return null;
    return zoned.toJSDate();
  }
  const parsed = validDate(value);
  // Reject invalid calendar dates and nonexistent local times during DST changes.
  return parsed && toLocalDateTimeInput(parsed) === value ? parsed : null;
}

/** Inclusive query bounds for a civil day; DST days need not have 24 hours. */
export function organizationDayRange(day: string, timeZone?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = DateTime.fromISO(day, {
    ...(timeZone ? { zone: timeZone } : {}),
  }).startOf("day");
  if (!start.isValid || start.toISODate() !== day) return null;
  return {
    from: start.toUTC().toISO()!,
    to: start
      .plus({ days: 1 })
      .startOf("day")
      .minus({ milliseconds: 1 })
      .toUTC()
      .toISO()!,
  };
}
