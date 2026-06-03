import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const compact = (source: string) => source.replace(/\s+/g, " ").trim();

describe("appointment assignee UI contract", () => {
  it("envia filtro de equipe do calendário ao servidor e não cria conflito artificial para agenda sem responsável", () => {
    const calendar = readFileSync("client/src/pages/CalendarPage.tsx", "utf8");

    expect(calendar).toContain(
      'teamFilter === "all" ? { limit: 1000 } : { assignedToPersonId: teamFilter, limit: 1000 }'
    );
    expect(calendar).toContain("if (!item.assignedToPersonId) return;");
    expect(calendar).toContain(
      'Boolean(item.assignedToPersonId) && !["CANCELED", "DONE", "NO_SHOW"].includes(item.status)'
    );
  });

  it("permite filtrar, editar e remover o responsável na tela padronizada de agendamentos", () => {
    const appointments = readFileSync(
      "client/src/pages/AppointmentsPage.tsx",
      "utf8"
    );
    const normalizedAppointments = compact(appointments);

    expect(appointments).toContain("<AppPageShell>");
    expect(appointments).toContain("<AppOperationalHeader");
    expect(appointments).toContain("<AppSectionCard");
    expect(appointments).toContain("<AppNextBestActionBlock");
    expect(appointments).toContain("<AppDataTable");
    expect(appointments).toContain("<AppOperationalStatusBadge");
    expect(appointments).toContain("<AppPriorityBadge");
    expect(appointments).toContain("<AppRowActionsDropdown");
    expect(appointments).not.toContain("PageWrapper");
    expect(appointments).not.toContain("OperationalTopCard");
    expect(normalizedAppointments).toContain(
      'responsibleFilter === "all" ? { limit: 100 } : { assignedToPersonId: responsibleFilter, limit: 100 }'
    );
    expect(normalizedAppointments).toContain(
      'assignedToPersonId: form.assignedToPersonId === "unassigned" ? null : form.assignedToPersonId'
    );
    expect(appointments).toContain(
      '{ value: "unassigned", label: "Sem responsável" }'
    );
  });
});
