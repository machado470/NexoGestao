import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileUpcomingAppointment } from "./MobileUpcomingAppointment";
const state = vi.hoisted(() => ({
  scheduled: {} as any,
  confirmed: {} as any,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ role: "ADMIN" }),
}));
vi.mock("@/contexts/OrganizationLocaleContext", () => ({
  useOrganizationLocale: () => ({ timezone: "America/Sao_Paulo" }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    appointments: {
      page: {
        useQuery: ({ status }: any) =>
          status === "CONFIRMED" ? state.confirmed : state.scheduled,
      },
    },
  },
}));
const render = () =>
  renderToStaticMarkup(<MobileUpcomingAppointment navigate={() => {}} />);
describe("upcoming appointment", () => {
  beforeEach(() => {
    state.scheduled = {
      data: {
        items: [
          {
            id: "later",
            startsAt: "2026-11-20T15:00:00Z",
            status: "SCHEDULED",
            customer: { name: "Cliente agendado" },
          },
        ],
      },
    };
    state.confirmed = {
      data: {
        items: [
          {
            id: "first",
            startsAt: "2026-11-20T12:00:00Z",
            status: "CONFIRMED",
            customer: { name: "Cliente confirmado" },
          },
        ],
      },
    };
  });
  it("chooses the earlier confirmed record and displays company time", () => {
    const html = render();
    expect(html).toContain("Cliente confirmado");
    expect(html).not.toContain("Cliente agendado");
    expect(html).toContain("09:00");
  });
  it("does not claim there are no appointments when either source fails", () => {
    state.confirmed = { isError: true };
    expect(render()).toContain(
      "Não foi possível confirmar o próximo atendimento"
    );
    expect(render()).not.toContain("Nenhum atendimento futuro");
  });
  it("distinguishes an empty agenda from an unavailable agenda", () => {
    state.confirmed = { data: { items: [] } };
    state.scheduled = { data: { items: [] } };
    expect(render()).toContain("Nenhum atendimento futuro");
  });
  it("rejects malformed records instead of inventing dates", () => {
    state.confirmed = {
      data: {
        items: [{ id: "bad", startsAt: "invalid", status: "CONFIRMED" }],
      },
    };
    expect(render()).toContain("Não foi possível confirmar");
  });
});
