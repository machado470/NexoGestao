import { describe, it, expect } from "vitest";
import { presentationLabel } from "./presentation-labels";
describe("labels preserve technical contracts", () => {
  it.each([["UNKNOWN", "Não informado"], ["NORMAL", "Operação normal"], ["CUSTOMER_UPDATED", "Cliente atualizado"], ["UNDER_CAPACITY", "Abaixo da capacidade"]])("translates %s for display only", (code, label) => { expect(presentationLabel(code)).toBe(label); });
  it("keeps unknown values readable and accepts absent metadata", () => {
    expect(presentationLabel("NEW_EVENT")).toBe("Não reconhecido (NEW_EVENT)");
    expect(presentationLabel(null)).toBe("Não informado");
    expect(presentationLabel(12)).toBe("12");
    expect(presentationLabel("Nome da pessoa")).toBe("Nome da pessoa");
  });
});
