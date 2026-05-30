import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExecutiveDashboard decision center", () => {
  const source = readFileSync("client/src/pages/ExecutiveDashboard.tsx", "utf8");

  it("renders the operational structure in decision order", () => {
    const sections = [
      "Centro de decisão operacional",
      "Atenção imediata",
      "Próxima Melhor Ação",
      "KPIs operacionais",
      "Fluxo operacional",
      "Fila operacional",
      "Pulso da operação",
      "Acessos rápidos contextuais",
    ];
    sections.forEach(section => expect(source).toContain(section));
    const renderedSections = sections.slice(1).map(section => source.indexOf(`<AppSectionBlock title="${section}"`));
    renderedSections.forEach((position, index) => {
      expect(position).toBeGreaterThan(-1);
      if (index > 0) expect(position).toBeGreaterThan(renderedSections[index - 1]);
    });
  });

  it("limits immediate attention and the queue instead of rendering giant lists", () => {
    expect(source).toContain(".slice(0, 5)");
    expect(source).toContain(".slice(0, 6)");
    expect(source).not.toContain("<table");
  });

  it("uses the real next best action endpoint and an honest empty state", () => {
    expect(source).toContain('/internal/operational-signals/next-best-action');
    expect(source).toContain("Nenhuma Próxima Melhor Ação disponível");
    expect(source).toContain("nenhuma ação artificial foi criada");
  });

  it("gives every KPI context and CTA routes to its owning module", () => {
    expect(source).toContain("Poucos indicadores com contexto e destino útil.");
    expect(source).toContain('/finances?view=paid');
    expect(source).toContain('/service-orders?status=open');
    expect(source).toContain('/finances?view=charges&status=overdue');
    expect(source).toContain('/whatsapp');
  });

  it("shows the full operational flow and documents unavailable payment volume", () => {
    ["Cliente", "Agendamento", "O.S.", "Cobrança", "Pagamento"].forEach(stage => expect(source).toContain(`label: "${stage}"`));
    expect(source).toContain("volume não exposto pelo backend");
  });

  it("does not disguise errors as a healthy empty operation", () => {
    expect(source).toContain("Não foi possível ler a operação");
    expect(source).toContain("não assume que está tudo bem");
    expect(source).toContain("O dashboard não cria alertas ou recomendações fictícias");
  });

  it("does not keep the previous mocked operational fixtures", () => {
    expect(source).not.toContain("defaultAttentionItems");
    expect(source).not.toContain("defaultQueue");
    expect(source).not.toContain("operationalPipeline");
    expect(source).not.toContain("pulseSignals");
    expect(source).not.toContain("187400");
  });
});


describe("dashboard BFF error semantics", () => {
  const routerSource = readFileSync("server/routers/dashboard.ts", "utf8");

  it("propagates metrics and alerts failures instead of returning fake empty success", () => {
    const dashboardReadSection = routerSource.slice(routerSource.indexOf("kpis:"), routerSource.indexOf("revenueTrend:"));
    expect(dashboardReadSection).not.toContain("catch");
    expect(dashboardReadSection).not.toContain("return {} as Record<string, unknown>");
  });
});
