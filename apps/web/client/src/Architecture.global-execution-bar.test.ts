import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Global execution controls architecture guardrails", () => {
  const mainLayoutSource = readFileSync("client/src/components/MainLayout.tsx", "utf8");
  const pagesDir = "client/src/pages";
  const pageFiles = readdirSync(pagesDir).filter(file => file.endsWith(".tsx"));

  it("não renderiza ExecutionGlobalBar no shell principal", () => {
    const matches = mainLayoutSource.match(/<ExecutionGlobalBar\s*\/>/g) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("não renderiza GlobalActionEngine no MainLayout", () => {
    expect(mainLayoutSource).not.toContain("<GlobalActionEngine />");
  });

  it("evita barra/engine globais dentro de páginas internas", () => {
    for (const pageFile of pageFiles) {
      const source = readFileSync(path.join(pagesDir, pageFile), "utf8");
      expect(source.includes("ExecutionGlobalBar")).toBe(false);
      expect(source.includes("GlobalActionEngine")).toBe(false);
      expect(source.includes("GlobalNextAction")).toBe(false);
    }
  });
});
