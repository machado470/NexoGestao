import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageFiles = [
  "client/src/pages/FinancesPage.tsx",
  "client/src/pages/GovernancePage.tsx",
  "client/src/pages/TimelinePage.tsx",
];

describe("Operational page guardrails", () => {
  it("evita placeholders rasos nas páginas críticas", () => {
    for (const file of pageFiles) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("PAGE OK")).toBe(false);
    }
  });

  it("mantém timeline incremental sem feed infinito automático", () => {
    const timeline = readFileSync("client/src/pages/TimelinePage.tsx", "utf8");
    expect(timeline).toContain("const [limit, setLimit] = useState(120)");
    expect(timeline).toContain("onClick={() => setLimit((prev) => prev + 120)}");
    expect(timeline).not.toContain("setLimit(limit + 120)");
  });

  it("mantém botão primário padronizado nas ações contextuais", () => {
    const operationalComponent = readFileSync("client/src/components/internal-page-system.tsx", "utf8");
    expect(operationalComponent).toContain("export function AppNextActionCard");
    expect(operationalComponent).toContain("<Button className=\"mt-2\" type=\"button\" onClick={onExecute}>");
  });
});
