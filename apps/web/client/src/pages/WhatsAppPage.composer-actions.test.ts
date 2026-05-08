import { describe, expect, it } from "vitest";

import {
  buildWhatsAppComposerActionGroups,
  buildWhatsAppSendPayload,
  getDefaultMessageType,
  resolveMessageType,
} from "./WhatsAppPage";

describe("WhatsApp composer action groups", () => {
  it("moves communication controls into Mais ações descriptors", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: true,
    });

    expect(groups.Comunicação.map(action => action.label)).toEqual([
      "Template rápido",
      "Anexar arquivo",
      "Enviar imagem/documento",
      "Áudio / gravação",
    ]);
    expect(
      groups.Comunicação.filter(action => action.disabled).map(
        action => action.reason
      )
    ).toEqual(["Em breve", "Em breve", "Em breve"]);
  });

  it("keeps supported operational and assisted execution actions discoverable", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: true,
    });

    expect(groups.Operacional.map(action => action.label)).toEqual([
      "Enviar cobrança",
      "Enviar link de pagamento",
      "Confirmar agendamento",
      "Atualizar serviço",
      "Vincular O.S.",
      "Marcar conversa como resolvida",
    ]);
    expect(groups["Execução assistida"].map(action => action.label)).toEqual([
      "Criar execução assistida",
      "Follow-up / ação sugerida",
    ]);
    expect(groups["Execução assistida"].every(action => !action.disabled)).toBe(
      true
    );
  });

  it("disables assisted execution entries when no suggested action exists", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: false,
    });

    expect(groups["Execução assistida"].every(action => action.disabled)).toBe(
      true
    );
    expect(groups["Execução assistida"].map(action => action.reason)).toEqual([
      "Sem ação sugerida",
      "Sem ação sugerida",
    ]);
  });

  it("does not bring back the old visible General intent selector", () => {
    const groups = buildWhatsAppComposerActionGroups({
      hasSuggestedAction: true,
    });
    const labels = Object.values(groups)
      .flat()
      .map(action => action.label);

    expect(labels).not.toContain("Geral");
    expect(labels).not.toContain("General");
    expect(labels).not.toContain("Intenção");
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
  });
});
