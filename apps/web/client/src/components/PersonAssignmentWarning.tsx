import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import type { AssigneeWarningType } from "@/lib/assignee-warning-telemetry";
import { trpc } from "@/lib/trpc";

type AvailabilityException = {
  startsAt: string;
  endsAt: string;
  reason?: string | null;
};

export type PersonOperationalSummary = {
  personId: string;
  availabilityStatus?: "AVAILABLE" | "UNAVAILABLE_NOW" | "UNAVAILABLE_SOON";
  capacityStatus?: "UNDER_CAPACITY" | "AT_CAPACITY" | "OVER_CAPACITY";
  loadStatus?: "IDLE" | "NORMAL" | "BUSY" | "OVERLOADED";
  serviceOrderCapacityUsagePct?: number | null;
  appointmentCapacityUsagePct?: number | null;
  overdueServiceOrdersCount?: number | null;
  todayAppointmentsCount?: number | null;
  currentAvailabilityException?: AvailabilityException | null;
  nextAvailabilityException?: AvailabilityException | null;
};

export function getPersonAssignmentWarningTypes(personSummary?: PersonOperationalSummary | null): AssigneeWarningType[] {
  if (!personSummary) return [];

  const warningTypes: AssigneeWarningType[] = [];
  if (personSummary.availabilityStatus === "UNAVAILABLE_NOW") warningTypes.push("UNAVAILABLE_NOW");
  if (personSummary.availabilityStatus === "UNAVAILABLE_SOON") warningTypes.push("UNAVAILABLE_SOON");
  if (personSummary.capacityStatus === "OVER_CAPACITY") warningTypes.push("OVER_CAPACITY");
  if (personSummary.loadStatus === "OVERLOADED") warningTypes.push("OVERLOADED");
  return warningTypes;
}

export function getPersonAssignmentWarning(personSummary?: PersonOperationalSummary | null) {
  if (!personSummary) return [];

  const warnings: string[] = [];
  if (personSummary.availabilityStatus === "UNAVAILABLE_NOW") {
    warnings.push("Pessoa indisponível agora");
  }
  if (personSummary.availabilityStatus === "UNAVAILABLE_SOON") {
    warnings.push("Pessoa ficará indisponível em breve");
  }
  if (personSummary.capacityStatus === "OVER_CAPACITY") {
    warnings.push("Pessoa acima da capacidade planejada");
  }
  if (personSummary.loadStatus === "OVERLOADED") {
    warnings.push("Pessoa com carga operacional alta");
  }
  return warnings;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getAssignmentContext(personSummary: PersonOperationalSummary) {
  const context: string[] = [];
  const currentStartsAt = formatDateTime(personSummary.currentAvailabilityException?.startsAt);
  const currentEndsAt = formatDateTime(personSummary.currentAvailabilityException?.endsAt);
  const nextStartsAt = formatDateTime(personSummary.nextAvailabilityException?.startsAt);
  const nextEndsAt = formatDateTime(personSummary.nextAvailabilityException?.endsAt);

  if (currentStartsAt && currentEndsAt) {
    context.push(`Indisponibilidade atual: ${currentStartsAt} até ${currentEndsAt}`);
  }
  if (nextStartsAt && nextEndsAt) {
    context.push(`Próxima indisponibilidade: ${nextStartsAt} até ${nextEndsAt}`);
  }
  if (personSummary.serviceOrderCapacityUsagePct != null) {
    context.push(`Capacidade de O.S.: ${personSummary.serviceOrderCapacityUsagePct}% usada`);
  }
  if (personSummary.appointmentCapacityUsagePct != null) {
    context.push(`Capacidade de agenda: ${personSummary.appointmentCapacityUsagePct}% usada`);
  }
  if (personSummary.overdueServiceOrdersCount != null) {
    context.push(`O.S. atrasadas: ${personSummary.overdueServiceOrdersCount}`);
  }
  if (personSummary.todayAppointmentsCount != null) {
    context.push(`Agendamentos hoje: ${personSummary.todayAppointmentsCount}`);
  }
  return context;
}

export function PersonAssignmentWarning({
  personId,
  onWarningShown,
}: {
  personId?: string | null;
  onWarningShown?: (payload: { personId: string; warningTypes: AssigneeWarningType[] }) => void;
}) {
  const summaryQuery = trpc.people.operationalSummary.useQuery(undefined, {
    enabled: Boolean(personId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const people = ((summaryQuery.data ?? { people: [] }) as {
    people?: PersonOperationalSummary[];
  }).people ?? [];
  const personSummary = people.find((person) => person.personId === personId);
  const warningTypes = getPersonAssignmentWarningTypes(personSummary);
  const warnings = getPersonAssignmentWarning(personSummary);
  const warningTypesKey = warningTypes.join(",");

  useEffect(() => {
    if (!personId || warningTypes.length === 0) return;
    onWarningShown?.({ personId, warningTypes });
  }, [onWarningShown, personId, warningTypesKey]);

  if (!personSummary || warnings.length === 0) return null;

  const context = getAssignmentContext(personSummary);
  return (
    <div
      data-testid="person-assignment-warning"
      className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">Atenção antes de atribuir</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
          {context.length > 0 ? <p>{context.join(" · ")}</p> : null}
          <p>A atribuição continua permitida; confirme a decisão operacional antes de salvar.</p>
        </div>
      </div>
    </div>
  );
}
