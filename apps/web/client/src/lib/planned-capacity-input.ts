export type PlannedCapacityInput =
  | { ok: true; value: number | undefined }
  | { ok: false };
/** Unknown legacy capacity can remain unknown; an existing capacity cannot be silently removed. */
export function parsePlannedCapacityInput(
  raw: string,
  original: number | null
): PlannedCapacityInput {
  const input = raw.trim();
  if (!input)
    return original === null ? { ok: true, value: undefined } : { ok: false };
  if (!/^\d+$/.test(input)) return { ok: false };
  const value = Number(input);
  return Number.isInteger(value) && value >= 1 && value <= 100
    ? { ok: true, value }
    : { ok: false };
}
