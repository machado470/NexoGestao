import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppField, AppInput, AppSelect } from "./app-system";

describe("AppField", () => {
  it("connects the hint to its control and preserves existing error references", () => {
    const html = renderToStaticMarkup(
      <AppField label="Valor" htmlFor="amount" hint="Valor em centavos.">
        <AppInput id="amount" aria-invalid aria-describedby="amount-error" />
        <p id="amount-error">Valor inválido.</p>
      </AppField>
    );

    expect(html).toContain('for="amount"');
    expect(html).toContain('aria-describedby="amount-error amount-hint"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('id="amount-hint"');
  });

  it("forwards the hint to the select trigger", () => {
    const html = renderToStaticMarkup(
      <AppField label="Moeda" htmlFor="currency" hint="Moeda de referência.">
        <AppSelect id="currency" options={[{ value: "BRL", label: "Real" }]} />
      </AppField>
    );

    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-describedby="currency-hint"');
  });
});
