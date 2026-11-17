import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileDetailBack, MobileDetailState } from "./MobileDetailBack";

describe("mobile detail navigation states", () => {
  it("does not add a back control to the list view", () => {
    expect(
      renderToStaticMarkup(
        <MobileDetailBack
          visible={false}
          onBack={vi.fn()}
          label="Voltar à equipe"
        />
      )
    ).toBe("");
  });
  it("names the back action for the active module", () => {
    expect(
      renderToStaticMarkup(
        <MobileDetailBack visible onBack={vi.fn()} label="Voltar à equipe" />
      )
    ).toContain("Voltar à equipe");
  });
  it("keeps the loading state visible before a deep-linked record arrives", () => {
    const html = renderToStaticMarkup(
      <MobileDetailState visible loading failed={false} onRetry={vi.fn()} />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando o registro");
    expect(html).not.toContain("Tentar novamente");
  });
  it("reports a failed record and offers recovery", () => {
    const html = renderToStaticMarkup(
      <MobileDetailState visible loading={false} failed onRetry={vi.fn()} />
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar");
    expect(html).toContain("Tentar novamente");
  });
  it("explains a missing record rather than showing a blank detail", () => {
    const html = renderToStaticMarkup(
      <MobileDetailState
        visible
        loading={false}
        failed={false}
        onRetry={vi.fn()}
      />
    );
    expect(html).toContain("Volte à lista");
    expect(html).toContain("Tentar novamente");
  });
  it("does not show a placeholder over a loaded detail", () => {
    expect(
      renderToStaticMarkup(
        <MobileDetailState
          visible={false}
          loading={false}
          failed={false}
          onRetry={vi.fn()}
        />
      )
    ).toBe("");
  });
});
