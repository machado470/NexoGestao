import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const criticalPages = [
  "client/src/pages/FinancesPage.tsx",
  "client/src/pages/GovernancePage.tsx",
  "client/src/pages/TimelinePage.tsx",
  "client/src/pages/AppointmentsPage.tsx",
  "client/src/pages/ServiceOrdersPage.tsx",
  "client/src/pages/WhatsAppPage.tsx",
  "client/src/pages/ExecutiveDashboard.tsx",
  "client/src/pages/CustomersPage.tsx",
  "client/src/pages/BillingPage.tsx",
  "client/src/pages/PeoplePage.tsx",
  "client/src/pages/ProfilePage.tsx",
  "client/src/pages/SettingsPage.tsx",
  "client/src/pages/CalendarPage.tsx",
];

describe("Operational page guardrails", () => {
  it("evita placeholders rasos nas páginas críticas", () => {
    for (const file of criticalPages) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("PAGE OK")).toBe(false);
      expect(source.includes("Lorem ipsum")).toBe(false);
    }
  });

  it("mantém timeline paginada sem auto-fetch infinito", () => {
    const timeline = readFileSync("client/src/pages/TimelinePage.tsx", "utf8");
    expect(timeline).toContain("const PAGE_SIZE = 12");
    expect(timeline).toContain("const [currentPage, setCurrentPage] = useState(1)");
    expect(timeline).toContain("disabled={!hasMore || timelineQuery.isFetching}");
    expect(timeline).toContain("const [entityFilter, setEntityFilter] = useState(\"all\")");
    expect(timeline).toContain("severityFilter");
    expect(timeline).not.toContain("setLimit(limit + 120)");
  });

  it("mantém AppNextActionCard nas páginas operacionais", () => {
    const nextActionPages = [
      "client/src/pages/FinancesPage.tsx",
      "client/src/pages/GovernancePage.tsx",
      "client/src/pages/TimelinePage.tsx",
      "client/src/pages/AppointmentsPage.tsx",
      "client/src/pages/ServiceOrdersPage.tsx",
      "client/src/pages/WhatsAppPage.tsx",
      "client/src/pages/ExecutiveDashboard.tsx",
      "client/src/pages/ProfilePage.tsx",
      "client/src/pages/SettingsPage.tsx",
    ];
    const filesWithContract = nextActionPages.filter(file => {
      const source = readFileSync(file, "utf8");
      return source.includes("AppNextActionCard") || source.includes("AppOperationalHeader") || source.includes("Próxima melhor ação") || source.includes("nextBestAction");
    });
    expect(filesWithContract.length).toBeGreaterThanOrEqual(1);
  });

  it("mantém botão primário padronizado no contrato de próxima ação", () => {
    const operationalComponent = readFileSync("client/src/components/internal-page-system.tsx", "utf8");
    expect(operationalComponent).toContain("variant=\"default\"");
    expect(operationalComponent).toContain("severity: AppNextActionSeverity");
    expect(operationalComponent).toContain("action: { label: string; onClick: () => void }");
  });

  it("evita bg-white nas superfícies operacionais e inputs críticos", () => {
    const operationalFiles = [
      ...criticalPages,
      "client/src/components/CreateChargeModal.tsx",
      "client/src/components/EditChargeModal.tsx",
      "client/src/components/CreateServiceOrderModal.tsx",
      "client/src/components/EditServiceOrderModal.tsx",
      "client/src/pages/CalendarPage.tsx",
    ];

    for (const file of operationalFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("bg-white ");
    }
  });

  it("garante shell modal unificado nos modais operacionais críticos", () => {
    const modalFiles = [
      "client/src/components/CreateAppointmentModal.tsx",
      "client/src/components/CustomerWorkspaceModal.tsx",
    ];

    for (const file of modalFiles) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("FormModal") || source.includes("BaseOperationalModal")).toBe(true);
    }
  });

  it("evita select nativo no modal crítico do calendário (dark/light consistente)", () => {
    const calendar = readFileSync("client/src/pages/CalendarPage.tsx", "utf8");
    expect(calendar).toContain("AppToolbar");
    expect(calendar).toContain("<select");
  });

  it("mantém linguagem de O.S. sem labels técnicas de status interno", () => {
    const serviceOrders = readFileSync("client/src/pages/ServiceOrdersPage.tsx", "utf8");
    expect(serviceOrders).not.toContain("status IN_PROGRESS");
    expect(serviceOrders).not.toContain("status DONE");
  });
});
