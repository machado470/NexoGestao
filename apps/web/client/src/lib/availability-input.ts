import { parseLocalDateTimeInput } from "./local-date-time";
export function parseAvailabilityInterval(
  start: string,
  end: string
):
  | { ok: true; startsAt: string; endsAt: string }
  | { ok: false; message: string } {
  const startsAt = parseLocalDateTimeInput(start);
  const endsAt = parseLocalDateTimeInput(end);
  if (!startsAt || !endsAt)
    return {
      ok: false,
      message: "Informe datas e horários válidos para início e fim.",
    };
  if (startsAt >= endsAt)
    return {
      ok: false,
      message: "O fim da indisponibilidade deve ser posterior ao início.",
    };
  return {
    ok: true,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}
