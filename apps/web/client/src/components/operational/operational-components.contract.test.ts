import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");

describe("operational visual components contract", () => {
  it("expõe componentes base de carga, fluxo, timeline e ação", () => {
    [
      "OperationalWorkloadBar",
      "OperationalFlow",
      "OperationalTimelineItem",
      "OperationalActionPanel",
    ].forEach(component =>
      expect(source).toContain(`export function ${component}`)
    );
  });

  it("mantém namespace visual, tokens e acessibilidade básica", () => {
    expect(source).toContain("nexo-operational-workload");
    expect(source).toContain("nexo-operational-flow");
    expect(source).toContain("nexo-operational-timeline-item");
    expect(source).toContain(`role="meter"`);
    expect(source).toContain("aria-valuenow");
    expect(source).toContain("var(--nexo-card-bg,var(--surface-base))");
    expect(source).not.toContain("bg-black");
    expect(source).not.toContain("bg-zinc-900");
    expect(source).not.toContain("bg-slate-900");
  });

  it("documenta quando usar a camada operacional e proíbe cópia externa", () => {
    expect(readme).toContain("OperationalPanel");
    expect(readme).toContain("OperationalInnerCard");
    expect(readme).toContain("OperationalFlow");
    expect(readme).toContain("OperationalActionPanel");
    expect(readme).toContain("Não copie catálogos externos");
  });
});
