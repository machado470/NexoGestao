import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataTable } from "./internal-page-system";

describe("AppDataTable", () => {
  it("gives the scroll area a name and keyboard access", () => {
    const html = renderToStaticMarkup(
      <AppDataTable label="Carteira de clientes" viewportClassName="max-h-[560px]">
        <thead><tr><th scope="col">Cliente</th></tr></thead>
        <tbody><tr><td>Ana</td></tr></tbody>
      </AppDataTable>
    );

    expect(html).toMatch(/^<div role="region" aria-label="Carteira de clientes" tabindex="0"[^>]*max-h-\[560px\]/);
    expect(html).toContain('<th scope="col">Cliente</th>');
    expect(html.match(/<table\b/g)).toHaveLength(1);
  });

  it("preserves a caller-supplied table without nesting another table", () => {
    const html = renderToStaticMarkup(
      <AppDataTable>
        <table aria-label="Registros"><tbody><tr><td>Registro</td></tr></tbody></table>
      </AppDataTable>
    );

    expect(html.match(/<table\b/g)).toHaveLength(1);
    expect(html).toContain('<table aria-label="Registros">');
    expect(html).not.toContain("tabindex");
  });
});
