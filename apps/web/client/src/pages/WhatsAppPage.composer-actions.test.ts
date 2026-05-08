import { describe, expect, it } from "vitest";

import {
  buildWhatsAppComposerActionGroups,
  buildWhatsAppSendPayload,
  getDefaultMessageType,
  resolveMessageType,
} from "./WhatsAppPage";

describe("WhatsApp composer action groups", () => {
  it("renders Mais ações as compact operational sections", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: true,
      canResolveConversation: true,
    });

    expect(Object.keys(groups)).toEqual([
      "Comunicação",
      "Financeiro",
      "Agenda",
      "Ordem de serviço",
      "Execução assistida",
    ]);
    expect(groups.Comunicação.map(action => action.label)).toEqual([
      "Template rápido",
      "Anexar arquivo",
      "Áudio / mensagem de voz",
    ]);
    expect(groups.Financeiro.map(action => action.label)).toEqual([
      "Enviar cobrança",
      "Enviar link de pagamento",
      "Lembrete de pagamento",
    ]);
    expect(groups.Agenda.map(action => action.label)).toEqual([
      "Confirmar agendamento",
      "Lembrete de agendamento",
    ]);
    expect(groups["Ordem de serviço"].map(action => action.label)).toEqual([
      "Atualizar serviço",
      "Vincular O.S.",
    ]);
    expect(groups["Execução assistida"].map(action => action.label)).toEqual([
      "Criar execução assistida",
      "Marcar conversa como resolvida",
    ]);
  });

  it("keeps unavailable actions disabled with user-facing reasons", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: false,
      hasOpenCharge: false,
      canSendPaymentLink: false,
      hasUpcomingAppointment: false,
      hasActiveServiceOrder: false,
      canResolveConversation: false,
    });

    expect(
      groups.Comunicação.filter(action => action.disabled).map(action => [
        action.label,
        action.reason,
      ])
    ).toEqual([
      ["Anexar arquivo", "Em breve"],
      ["Áudio / mensagem de voz", "Em breve"],
    ]);
    expect(groups.Financeiro.every(action => action.disabled)).toBe(true);
    expect(groups.Agenda.every(action => action.disabled)).toBe(true);
    expect(groups["Ordem de serviço"][0]).toMatchObject({
      label: "Atualizar serviço",
      disabled: true,
      reason: "Sem O.S.",
    });
    expect(groups["Ordem de serviço"][1]).toMatchObject({
      label: "Vincular O.S.",
    });
    expect(groups["Ordem de serviço"][1].disabled).toBeUndefined();
    expect(groups["Execução assistida"].every(action => action.disabled)).toBe(
      true
    );
  });

  it("does not bring back isolated composer controls or General labels", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: true,
    });
    const labels = Object.values(groups)
      .flat()
      .map(action => action.label);

    expect(labels).not.toContain("Geral");
    expect(labels).not.toContain("General");
    expect(labels).not.toContain("Intenção");
    expect(labels).not.toContain("Enviar imagem/documento");
    expect(labels).not.toContain("Gravação isolada");
  });
});

describe("WhatsApp composer messageType resolution", () => {
  it("uses MANUAL as the valid default messageType for normal freeform sends", () => {
    expect(getDefaultMessageType()).toBe("MANUAL");
    expect(resolveMessageType()).toBe("MANUAL");
  });

  it("allows contextual actions to override the default messageType", () => {
    expect(
      resolveMessageType({ explicitMessageType: "APPOINTMENT_CONFIRMATION" })
    ).toBe("APPOINTMENT_CONFIRMATION");
    expect(
      resolveMessageType({ explicitMessageType: "APPOINTMENT_REMINDER" })
    ).toBe("APPOINTMENT_REMINDER");
    expect(resolveMessageType({ explicitMessageType: "SERVICE_UPDATE" })).toBe(
      "SERVICE_UPDATE"
    );
    expect(
      resolveMessageType({ explicitMessageType: "PAYMENT_REMINDER" })
    ).toBe("PAYMENT_REMINDER");
    expect(resolveMessageType({ explicitMessageType: "PAYMENT_LINK" })).toBe(
      "PAYMENT_LINK"
    );
    expect(
      resolveMessageType({ explicitMessageType: "EXECUTION_CONFIRMATION" })
    ).toBe("EXECUTION_CONFIRMATION");
  });

  it("prevents undefined, null, General, or unknown values from reaching the API", () => {
    expect(resolveMessageType({ explicitMessageType: undefined })).toBe(
      "MANUAL"
    );
    expect(resolveMessageType({ explicitMessageType: null })).toBe("MANUAL");
    expect(resolveMessageType({ explicitMessageType: "GENERAL" })).toBe(
      "MANUAL"
    );
    expect(resolveMessageType({ explicitMessageType: "General" })).toBe(
      "MANUAL"
    );
  });

  it("builds send mutation payloads with a valid messageType", () => {
    expect(
      buildWhatsAppSendPayload({ content: "Olá", messageType: undefined })
    ).toMatchObject({ content: "Olá", messageType: "MANUAL" });
    expect(
      buildWhatsAppSendPayload({
        content: "Confirmado",
        messageType: "APPOINTMENT_CONFIRMATION",
      })
    ).toMatchObject({
      content: "Confirmado",
      messageType: "APPOINTMENT_CONFIRMATION",
    });
    expect(
      buildWhatsAppSendPayload({
        content: "Serviço atualizado",
        messageType: "SERVICE_UPDATE",
      })
    ).toMatchObject({ messageType: "SERVICE_UPDATE" });
    expect(
      buildWhatsAppSendPayload({
        content: "Link",
        messageType: "PAYMENT_LINK",
      })
    ).toMatchObject({ messageType: "PAYMENT_LINK" });
    expect(
      buildWhatsAppSendPayload({
        content: "Lembrete",
        messageType: "PAYMENT_REMINDER",
      })
    ).toMatchObject({ messageType: "PAYMENT_REMINDER" });
  });
});
