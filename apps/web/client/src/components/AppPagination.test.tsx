import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppPagination } from "./internal-page-system";

function render(currentPage: number, totalItems: number) {
  return renderToStaticMarkup(
    <AppPagination
      currentPage={currentPage}
      totalItems={totalItems}
      pageSize={10}
      onPageChange={() => {}}
    />
  );
}

describe("AppPagination", () => {
  it("announces the current range and renders one pair of navigation controls", () => {
    const html = render(6, 120);

    expect(html).toContain('<nav aria-label="Paginação"');
    expect(html).toMatch(/role="status"[^>]*>Mostrando 51–60 de 120 registros/);
    expect(html).toContain('aria-label="Página 6" aria-current="page"');
    expect(html).toContain("Página 6 de 12");
    expect(html.match(/aria-label="Página anterior"/g)).toHaveLength(1);
    expect(html.match(/aria-label="Próxima página"/g)).toHaveLength(1);
  });

  it("keeps boundary navigation disabled and shows the final partial page", () => {
    expect(render(1, 21)).toMatch(/disabled="" aria-label="Página anterior"/);
    const last = render(4, 21);
    expect(last).toContain("Mostrando 21–21 de 21 registros");
    expect(last).toMatch(/disabled="" aria-label="Próxima página"/);
  });
});
