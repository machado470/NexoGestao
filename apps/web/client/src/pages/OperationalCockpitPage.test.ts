import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  formatNullable,
  reasonDescription,
  statusLabel,
} from "./OperationalCockpitPage";

const source = readFileSync(
  new URL("./OperationalCockpitPage.tsx", import.meta.url),
  "utf8"
);

describe("OperationalCockpitPage presentation", () => {
  it.each([
    ["available", "Disponível"],
    ["unknown", "Não disponível"],
    ["unavailable", "Indisponível"],
    ["not_configured", "Não configurado"],
  ] as const)("maps %s literally", (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it("preserves factual zero and presents null as unavailable", () => {
    expect(formatNullable(0)).toBe("0");
    expect(formatNullable(null)).toBe("Não disponível");
  });

  it("uses a neutral fallback for an unknown reason code", () => {
    expect(reasonDescription("NEW_REASON")).toBe(
      "Informação adicional não disponível (NEW_REASON)."
    );
  });
});

describe("OperationalCockpitPage tenant contract", () => {
  it("queries only the tenant summary without identity input", () => {
    expect(source).toContain(
      "trpc.operations.tenantSummary.useQuery(undefined"
    );
    expect(source).toContain("tenantSummary.refetch()");
  });

  it.each([
    "operations.summary",
    "operations.incidents",
    "operations.queues",
    "operations.dlq",
    "/internal/operations/",
    "orgId",
    "x-org-id",
    "Date.now(",
    "severity",
    "nextAction",
    "priorityScore",
    ".sort(",
  ])("does not contain forbidden tenant-path construct %s", forbidden => {
    expect(source).not.toContain(forbidden);
  });

  it("uses canonical page states and surfaces", () => {
    expect(source).toContain("<AppPageShell");
    expect(source).toContain("<AppOperationalHeader");
    expect(source).toContain("<AppSectionBlock");
    expect(source).toContain("<AppStatusBadge");
    expect(source).toContain("<AppAlert");
    expect(source).toContain("<AppPageLoadingState");
    expect(source).toContain('title="Dados operacionais indisponíveis"');
  });

  it("does not present optimistic or aggregate classifications", () => {
    expect(source).not.toMatch(
      /Saudável|saudável|Sem incidentes|Sem críticos|Sem degradação|risco baixo|tudo funcionando/i
    );
    expect(source).toContain("Configuração disponível");
    expect(source).toMatch(
      /a disponibilidade do\s+provedor não está sendo afirmada/
    );
    expect(source).toContain("Disponibilidade não observável");
  });

  it("renders requested factual values and timestamps", () => {
    for (const field of [
      "customersVolume",
      "appointmentsVolume",
      "serviceOrdersVolume",
      "chargesVolume",
      "paymentsVolume",
      "failedMessages",
      "configuredEndpoints",
      "activeEndpoints",
      "pendingDeliveries",
      "successfulDeliveries",
      "failedDeliveries",
      "subscriptionStatus",
      "executionMode",
      "generatedAt",
      "observedAt",
      "updatedAt",
    ])
      expect(source).toContain(field);
  });
});
