import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { tenantOperationsSummary } from "./operational";
import { readFileSync } from "node:fs";

const context = { req: { headers: {}, cookies: {} }, res: {}, user: { token: "trusted-token", validated: true } } as any;
const timestamp = "2026-09-13T12:00:00.000Z";
const valid = {
  contractVersion: 1 as const, generatedAt: timestamp,
  facts: [
    { key: "resources", status: "available", observedAt: timestamp, reasonCode: null, facts: { customersVolume: 1, customersUpdatedAt: null, appointmentsVolume: 2, appointmentsUpdatedAt: null, serviceOrdersVolume: 3, serviceOrdersUpdatedAt: null, chargesVolume: 4, chargesUpdatedAt: null, paymentsVolume: 5, paymentsUpdatedAt: null } },
    { key: "whatsapp", status: "unknown", observedAt: timestamp, reasonCode: "TENANT_CONFIGURATION_NOT_OBSERVABLE", facts: { failedMessages: 2 } },
    { key: "webhooks", status: "not_configured", observedAt: timestamp, reasonCode: "NO_WEBHOOK_ENDPOINTS", facts: { configuredEndpoints: 0, activeEndpoints: 0, pendingDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0 } },
    { key: "billing", status: "unknown", observedAt: timestamp, reasonCode: "PROVIDER_AVAILABILITY_NOT_OBSERVABLE", facts: { subscriptionStatus: "ACTIVE" } },
    { key: "operation_config", status: "available", observedAt: timestamp, reasonCode: null, facts: { executionMode: "manual", updatedAt: timestamp } },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("operations.tenantSummary contract", () => {
  it.each(["canonical envelope", "direct response"])("accepts a valid %s without input and calls only the tenant endpoint", async kind => {
    const body = kind === "canonical envelope" ? { success: true, data: valid } : valid;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(appRouter.createCaller(context).operations.tenantSummary()).resolves.toEqual(valid);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/v1\/operations\/tenant-summary$/);
    expect(String(url)).not.toContain("orgId");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer trusted-token" });
  });

  it("declares no input or orgId and never forwards caller-supplied identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(valid), { status: 200 }));
    await (appRouter.createCaller(context).operations.tenantSummary as any)({ orgId: "other" });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("orgId");
    const source = readFileSync(new URL("./operational.ts", import.meta.url), "utf8");
    const tenantLine = source.split("\n").find(line => line.includes("tenantSummary:"));
    expect(tenantLine).not.toContain(".input(");
    expect(tenantLine).not.toContain("orgId");
  });

  it.each([
    ["unknown status", () => ({ ...valid, facts: valid.facts.map((f, i) => i ? f : { ...f, status: "healthy" }) })],
    ["incompatible key/facts", () => ({ ...valid, facts: valid.facts.map((f, i) => i ? f : { ...f, key: "whatsapp" }) })],
    ["missing required fact", () => { const copy: any = structuredClone(valid); delete copy.facts[0].facts.customersVolume; return copy; }],
    ["global extra fact", () => { const copy: any = structuredClone(valid); copy.facts[2].facts.queueNames = ["global"]; return copy; }],
    ["extra orgId", () => ({ ...valid, orgId: "other" })],
  ])("rejects %s", (_label, mutate) => expect(() => tenantOperationsSummary.parse(mutate())).toThrow());

  it("contains no fallback, threshold/sort classification, or internal operations call in the tenant procedure", () => {
    const source = readFileSync(new URL("./operational.ts", import.meta.url), "utf8");
    const tenantPath = source.slice(source.indexOf("tenantSummary:"), source.indexOf("summary:", source.indexOf("tenantSummary:") + 1));
    expect(tenantPath).not.toMatch(/fallback|threshold|\.sort\s*\(|\/internal\/operations\//i);
    expect(tenantPath).toContain('"/v1/operations/tenant-summary"');
  });
});
