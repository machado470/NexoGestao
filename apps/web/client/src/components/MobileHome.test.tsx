import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileHome } from "./MobileHome";
const base = {
  role: "ADMIN" as const,
  name: "Ana Silva",
  summary: [],
  action: null,
  actionLoading: false,
  actionError: false,
  attention: [],
  attentionLoading: false,
  attentionError: false,
  empty: false,
  loading: false,
  failed: false,
  partial: false,
  onRetry: () => {},
  navigate: () => {},
};
describe("mobile home presentation", () => {
  it("offers creation shortcuts only for permitted roles", () => {
    expect(renderToStaticMarkup(<MobileHome {...base} />)).toContain("Cobrar");
    const staff = renderToStaticMarkup(<MobileHome {...base} role="STAFF" />);
    expect(staff).toContain("Nova O.S.");
    expect(staff).not.toContain("Cobrar");
    expect(
      renderToStaticMarkup(<MobileHome {...base} role="VIEWER" />)
    ).not.toContain('aria-label="Ações rápidas"');
  });
  it("distinguishes absent actions and unavailable sources", () => {
    expect(renderToStaticMarkup(<MobileHome {...base} />)).toContain(
      "Nenhuma ação prioritária retornada"
    );
    const failed = renderToStaticMarkup(
      <MobileHome {...base} failed actionError attentionError />
    );
    expect(failed).toContain("Não foi possível atualizar a operação");
    expect(failed).not.toContain("Nenhuma ação prioritária retornada");
  });
  it("does not enable a recommendation whose destination is restricted", () => {
    const html = renderToStaticMarkup(
      <MobileHome
        {...base}
        role="STAFF"
        action={{
          title: "Cobrança pendente",
          reason: "Há saldo pendente",
          path: "/finances?chargeId=c-1",
          ctaLabel: "Revisar cobrança",
        }}
      />
    );
    expect(html).toContain("A ação requer outro perfil de acesso.");
    expect(html).not.toContain("Revisar cobrança");
  });
  it("preserves zero and announces partial source failures", () => {
    const html = renderToStaticMarkup(
      <MobileHome
        {...base}
        partial
        summary={[
          { label: "O.S. em aberto", value: "0", path: "/service-orders" },
        ]}
      />
    );
    expect(html).toContain(">0</strong>");
    expect(html).toContain("Algumas informações estão indisponíveis");
  });
});
