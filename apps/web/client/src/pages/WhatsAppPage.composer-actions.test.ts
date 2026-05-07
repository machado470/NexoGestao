import { describe, expect, it } from "vitest";

import { buildWhatsAppComposerActionGroups } from "./WhatsAppPage";

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
});
