import { describe, expect, it } from "vitest";
import { whatsappAvailability } from "./integration-availability";
describe("WhatsApp capability presentation", () => {
  it.each([undefined, null, { status: "disabled", queueAvailable: true }, { status: "misconfigured", queueAvailable: true }, { status: "configured", queueAvailable: false }, { status: "future_status", queueAvailable: true }])("does not offer sending without confirmed capability: %j", health => {
    expect(whatsappAvailability(health).canSend).toBe(false);
    expect(whatsappAvailability(health).reason).not.toBe("");
  });
  it("allows sending with configured provider and queue", () => {
    expect(whatsappAvailability({ status: "configured", queueAvailable: true })).toMatchObject({ canSend: true, label: "Canal disponível", reason: "" });
  });
  it("identifies mock sends as demonstration, never real delivery", () => {
    const state = whatsappAvailability({ status: "configured_mock", queueAvailable: true });
    expect(state.canSend).toBe(true);
    expect(state.reason).toContain("não são entregues");
    expect(state.label).toContain("demonstração");
  });
});

describe("operational actions without channel access", () => {
  it("blocks delivery actions while retaining non-delivery operations", async () => {
    const { requiresWhatsAppChannel } = await import("./integration-availability");
    expect(requiresWhatsAppChannel("SEND_PAYMENT_LINK")).toBe(true);
    expect(requiresWhatsAppChannel("CONFIRM_APPOINTMENT")).toBe(true);
    expect(requiresWhatsAppChannel("MARK_RESOLVED")).toBe(false);
    expect(requiresWhatsAppChannel("OPEN_SERVICE_ORDER")).toBe(false);
  });
});
