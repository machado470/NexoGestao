import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const criticalPages = [
  "client/src/pages/FinancesPage.tsx",
  "client/src/pages/GovernancePage.tsx",
  "client/src/pages/TimelinePage.tsx",
  "client/src/pages/AppointmentsPage.tsx",
  "client/src/pages/ServiceOrdersPage.tsx",
  "client/src/pages/WhatsAppPage.tsx",
];

describe("Operational page guardrails", () => {
  it("evita placeholders rasos nas páginas críticas", () => {
    for (const file of criticalPages) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("PAGE OK")).toBe(false);
    }
  });

  it("mantém timeline paginada sem auto-fetch infinito", () => {
    const timeline = readFileSync("client/src/pages/TimelinePage.tsx", "utf8");
    expect(timeline).toContain("const pageSize = 20");
    expect(timeline).toContain("const [cursor, setCursor] = useState<string | undefined>(undefined)");
    expect(timeline).toContain("disabled={!hasMore || timelineQuery.isFetching}");
    expect(timeline).toContain("const [entityFilter, setEntityFilter] = useState(\"all\")");
    expect(timeline).toContain("Status:");
    expect(timeline).not.toContain("setLimit(limit + 120)");
  });

  it("mantém AppNextActionCard nas páginas operacionais", () => {
    for (const file of criticalPages) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("AppNextActionCard");
    }
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
    ];

    for (const file of operationalFiles) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("bg-white");
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
});
