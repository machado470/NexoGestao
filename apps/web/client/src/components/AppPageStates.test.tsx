import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
} from "./internal-page-system";

describe("shared page states", () => {
  it("announces the empty state separately from its action", () => {
    const html = renderToStaticMarkup(
      <AppPageEmptyState
        title="Nenhum registro"
        description="Revise os filtros."
        action={<button type="button">Limpar filtros</button>}
      />
    );

    expect(html).toMatch(/role="status"[^>]*><p[^>]*>Nenhum registro<\/p><p[^>]*>Revise os filtros\.<\/p><\/div>/);
    expect(html).toContain('<button type="button">Limpar filtros</button>');
  });

  it("uses one announcement when the loading panel contains skeletons", () => {
    const html = renderToStaticMarkup(<AppPageLoadingState title="Carregando registros" />);

    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain("Carregando registros");
    expect(html).toMatch(/aria-hidden="true"><div data-slot="skeleton"/);
  });

  it("keeps retry outside the error announcement", () => {
    const html = renderToStaticMarkup(
      <AppPageErrorState description="A consulta falhou." onAction={() => {}} />
    );

    expect(html).toMatch(/role="alert"><p[^>]*>Não foi possível carregar<\/p><p[^>]*>A consulta falhou\.<\/p><\/div><button/);
    expect(html).toContain("Tentar novamente");
  });
});
