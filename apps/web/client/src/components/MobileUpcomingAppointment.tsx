import { z } from "zod";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { trpc } from "@/lib/trpc";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/button";

const upcomingSchema = z.object({
  id: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  status: z.enum(["SCHEDULED", "CONFIRMED"]),
  customer: z.object({ name: z.string().optional() }).nullable().optional(),
});
/** Each server query is sorted by startsAt asc; choose the earliest live status. */
export function MobileUpcomingAppointment({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const { role } = useAuth();
  const { timezone } = useOrganizationLocale();
  const [from, setFrom] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = window.setInterval(
      () => setFrom(new Date().toISOString()),
      60000
    );
    return () => window.clearInterval(timer);
  }, []);
  const enabled = Boolean(role && can(role, "appointments:read"));
  const scheduled = trpc.appointments.page.useQuery(
    { page: 1, limit: 1, from, status: "SCHEDULED" },
    { enabled, retry: false }
  );
  const confirmed = trpc.appointments.page.useQuery(
    { page: 1, limit: 1, from, status: "CONFIRMED" },
    { enabled, retry: false }
  );
  const rows = [
    ...(scheduled.data?.items ?? []),
    ...(confirmed.data?.items ?? []),
  ];
  const parsed = rows.map(item => upcomingSchema.safeParse(item));
  const candidates = parsed
    .flatMap(result => (result.success ? [result.data] : []))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  const item = candidates[0];
  const failed =
    scheduled.isError ||
    confirmed.isError ||
    parsed.some(result => !result.success);
  if (!enabled) return null;
  return (
    <section aria-labelledby="mobile-upcoming">
      <h2 id="mobile-upcoming" className="mb-3 text-base font-semibold">
        Próximo atendimento
      </h2>
      {scheduled.isLoading || confirmed.isLoading ? (
        <p role="status" className="text-sm text-[var(--text-muted)]">
          Consultando a agenda…
        </p>
      ) : failed ? (
        <div className="text-sm text-[var(--text-muted)]">
          <p>Não foi possível confirmar o próximo atendimento.</p>
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => navigate("/appointments")}
          >
            Consultar agenda
          </Button>
        </div>
      ) : item ? (
        <button
          type="button"
          className="w-full rounded-2xl bg-[var(--surface-elevated)] p-4 text-left"
          onClick={() =>
            navigate(
              `/appointments?appointmentId=${encodeURIComponent(item.id)}`
            )
          }
        >
          <span className="block text-sm font-semibold text-[var(--accent-primary)]">
            {formatOrganizationDate(item.startsAt, timezone)}
          </span>
          <span className="mt-1 block break-words font-medium">
            {item.customer?.name ?? "Cliente não informado"}
          </span>
          <span className="mt-1 block text-sm text-[var(--text-muted)]">
            {item.status === "CONFIRMED" ? "Confirmado" : "Agendado"} · Ver
            atendimento
          </span>
        </button>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          Nenhum atendimento futuro agendado ou confirmado.
        </p>
      )}
    </section>
  );
}
