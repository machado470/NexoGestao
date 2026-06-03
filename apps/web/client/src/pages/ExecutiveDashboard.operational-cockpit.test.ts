import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ExecutiveDashboard decision center", () => {
  const source = readFileSync(
    "client/src/pages/ExecutiveDashboard.tsx",
    "utf8"
  );

  it("renders the operational structure in decision order", () => {
    const sections = [
      "Operação hoje",
      "Atenção imediata",
      "Próxima melhor ação",
      "KPIs operacionais",
      "Fluxo operacional",
      "Fila operacional",
      "Pulso da operação",
      "Acessos rápidos contextuais",
    ];
    sections.forEach(section => expect(source).toContain(section));
    const renderedSections = sections
      .slice(1)
      .map(section =>
        source.search(new RegExp(`<AppSectionBlock\\s+title="${section}"`))
      );
    renderedSections.forEach((position, index) => {
      expect(position).toBeGreaterThan(-1);
      if (index > 0)
        expect(position).toBeGreaterThan(renderedSections[index - 1]);
    });
  });

  it("limits immediate attention and the queue instead of rendering giant lists", () => {
    expect(source).toContain(".slice(0, 5)");
    expect(source).toContain(".slice(0, 6)");
    expect(source).not.toContain("<table");
  });

  it("uses the real next best action endpoint and an honest empty state", () => {
    expect(source).toContain("/internal/operational-signals/next-best-action");
    expect(source).toContain("Nenhuma Próxima Melhor Ação disponível");
    expect(source).toContain("nenhuma ação artificial foi criada");
  });

  it("gives every KPI context and CTA routes to its owning module", () => {
    expect(source).toContain("Indicadores de apoio para decidir rápido.");
    expect(source).toContain("/finances?view=paid");
    expect(source).toContain("/service-orders?status=open");
    expect(source).toContain("/finances?view=charges&status=overdue");
    expect(source).toContain("/whatsapp");
  });

  it("shows the real payment volume in the full operational flow and keeps an honest unavailable state", () => {
    ["Cliente", "Agendamento", "O.S.", "Cobrança", "Pagamento"].forEach(stage =>
      expect(source).toContain(`label: "${stage}"`)
    );
    expect(source).toContain(
      'readNullableNumber(metrics, "paymentsReceivedCount")'
    );
    expect(source).toContain("pagamentos recebidos nesta semana");
    expect(source).toContain("volume não disponível no contrato");
    expect(source).not.toContain("volume não exposto pelo backend");
  });

  it("uses the real backend comparison and renders honest pulse readings", () => {
    [
      "revenueReceivedPct",
      "completedServiceOrdersPct",
      "overdueChargesPct",
      "failedMessagesPct",
    ].forEach(field => expect(source).toContain(field));
    expect(source).toContain("melhorou");
    expect(source).toContain("piorou");
    expect(source).toContain("estável em relação ao período anterior");
    expect(source).toContain("sem base histórica suficiente");
    expect(source).not.toContain(
      "Tendência histórica: indisponível neste lote"
    );
  });

  it("uses the light transversal queue exposed by dashboard alerts", () => {
    expect(source).toContain("alerts.operationalQueue");
    expect(source).toContain("OVERDUE_SERVICE_ORDER");
    expect(source).toContain("OVERDUE_CHARGE");
    expect(source).toContain("UNCONFIRMED_APPOINTMENT");
    expect(source).toContain("CUSTOMER_AWAITING_RESPONSE");
    expect(source).toContain('path: "/appointments"');
    expect(source).toContain('path: "/whatsapp"');
  });

  it("does not disguise errors as a healthy empty operation", () => {
    expect(source).toContain("Não foi possível ler a operação");
    expect(source).toContain("não assume que está tudo bem");
    expect(source).toContain(
      "A operação não cria alertas ou recomendações fictícias"
    );
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
    const dashboardReadSection = routerSource.slice(
      routerSource.indexOf("kpis:"),
      routerSource.indexOf("revenueTrend:")
    );
    expect(dashboardReadSection).not.toContain("catch");
    expect(dashboardReadSection).not.toContain(
      "return {} as Record<string, unknown>"
    );
  });
});
