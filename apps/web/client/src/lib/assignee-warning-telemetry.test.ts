import { describe, expect, it, vi } from "vitest";
import { createAssigneeWarningTelemetry } from "./assignee-warning-telemetry";

describe("passive assignee warning telemetry", () => {
  it("registra SHOWN uma vez por combinação durante a vida do modal", () => {
    const track = vi.fn();
    const telemetry = createAssigneeWarningTelemetry(track);
    const payload = { context: "APPOINTMENT" as const, personId: "person-1", warningTypes: ["OVERLOADED" as const] };

    telemetry.trackShown(payload);
    telemetry.trackShown(payload);

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("ASSIGNEE_WARNING_SHOWN", payload);
  });

  it("registra CONFIRMED no submit com contexto, pessoa e entidade quando existe alerta", () => {
    const track = vi.fn();
    const telemetry = createAssigneeWarningTelemetry(track);
    telemetry.trackShown({ context: "SERVICE_ORDER", personId: "person-2", warningTypes: ["UNAVAILABLE_NOW", "OVER_CAPACITY"] });

    telemetry.trackConfirmed("SERVICE_ORDER", "person-2", "os-1");

    expect(track).toHaveBeenLastCalledWith("ASSIGNEE_WARNING_CONFIRMED", {
      context: "SERVICE_ORDER",
      personId: "person-2",
      warningTypes: ["OVER_CAPACITY", "UNAVAILABLE_NOW"],
      entityId: "os-1",
    });
  });

  it("registra CONFIRMED para agendamento sem bloquear o submit", () => {
    const track = vi.fn();
    const telemetry = createAssigneeWarningTelemetry(track);
    telemetry.trackShown({ context: "APPOINTMENT", personId: "person-3", warningTypes: ["UNAVAILABLE_SOON"] });

    telemetry.trackConfirmed("APPOINTMENT", "person-3");

    expect(track).toHaveBeenLastCalledWith("ASSIGNEE_WARNING_CONFIRMED", {
      context: "APPOINTMENT",
      personId: "person-3",
      warningTypes: ["UNAVAILABLE_SOON"],
    });
  });

  it("não registra evento para responsável sem alerta", () => {
    const track = vi.fn();
    const telemetry = createAssigneeWarningTelemetry(track);

    telemetry.trackConfirmed("APPOINTMENT", "person-normal");

    expect(track).not.toHaveBeenCalled();
  });

  it("permite registrar novamente depois do reset que representa um novo modal", () => {
    const track = vi.fn();
    const telemetry = createAssigneeWarningTelemetry(track);
    const payload = { context: "APPOINTMENT" as const, personId: "person-1", warningTypes: ["OVERLOADED" as const] };

    telemetry.trackShown(payload);
    telemetry.reset();
    telemetry.trackShown(payload);

    expect(track).toHaveBeenCalledTimes(2);
  });
});
