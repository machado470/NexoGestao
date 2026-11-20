import { promises as fs } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBffApp } from "./app";
import { serveStatic } from "./static";

// Regression for C3: the BFF used to expose unauthenticated, tenant-less read/write access to
// internal execution logs on /execution/*. Execution data is served only by the authenticated
// API (/executions/*) through tRPC, so the BFF must not serve those routes at all.
const LEGACY_STORE = path.resolve(process.cwd(), ".data", "execution-logs.json");
const validLog = { actionId: "action-org-a", decisionId: "decision-org-a", status: "success", entityType: "CUSTOMER", entityId: "customer-org-b" };
const legacyRoutes = [
  { method: "POST", path: "/execution/log", body: validLog },
  { method: "GET", path: "/execution/logs" },
  { method: "GET", path: "/execution/logs?decisionId=decision-org-a&sinceMs=999999999" },
  { method: "GET", path: "/execution/state-summary" },
  { method: "GET", path: "/execution/state-summary?sinceMs=999999999" },
] as const;
const sessionHeaders = { Cookie: "nexo_token=any-session-token", Authorization: "Bearer any-session-token", "x-org-id": "org-b" };

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function snapshotStore() {
  try {
    const stat = await fs.stat(LEGACY_STORE);
    return { exists: true, size: stat.size, mtimeMs: stat.mtimeMs, content: await fs.readFile(LEGACY_STORE, "utf8") };
  } catch {
    return { exists: false };
  }
}

function request(baseUrl: string, route: (typeof legacyRoutes)[number], headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${route.path}`, {
    method: route.method,
    headers: { "Content-Type": "application/json", ...headers },
    body: "body" in route ? JSON.stringify(route.body) : undefined,
  });
}

describe("C3: /execution/* internal routes are not exposed by the BFF", () => {
  const servers: Server[] = [];
  let apiOnly: string;
  let production: string;

  beforeAll(async () => {
    const apiApp = createBffApp();
    servers.push(createServer(apiApp));
    apiOnly = await listen(servers[0]);

    // Same assembly as production (`index.ts` with NODE_ENV != development): API routes + SPA fallback.
    const productionApp = createBffApp();
    serveStatic(productionApp);
    servers.push(createServer(productionApp));
    production = await listen(servers[1]);
  });

  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  describe.each([
    ["without credentials", {}],
    ["with a session cookie, bearer token and spoofed organization", sessionHeaders],
  ])("%s", (_label, headers) => {
    it.each(legacyRoutes.map((route) => [`${route.method} ${route.path}`, route] as const))(
      "API surface returns 404 for %s",
      async (_name, route) => {
        const response = await request(apiOnly, route, headers);
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type") ?? "").not.toContain("application/json");
      }
    );

    it.each(legacyRoutes.map((route) => [`${route.method} ${route.path}`, route] as const))(
      "production assembly never returns log data for %s",
      async (_name, route) => {
        const response = await request(production, route, headers);
        const text = await response.text();
        if (route.method === "POST") expect(response.status).toBe(404);
        else expect(response.headers.get("content-type") ?? "").toContain("text/html");
        expect(text).not.toMatch(/"logs"|"summary"|"log"\s*:|decision-org-a|action-org-a/);
      }
    );
  });

  it("does not create or modify the legacy log store", async () => {
    const before = await snapshotStore();
    for (const base of [apiOnly, production]) {
      for (let i = 0; i < 3; i += 1) await request(base, legacyRoutes[0], sessionHeaders);
    }
    expect(await snapshotStore()).toEqual(before);
  });

  it("keeps legitimate BFF routes mounted (consent)", async () => {
    const response = await fetch(`${apiOnly}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketing: false, analytics: false, cookies: true }),
    });
    expect(response.status).toBe(200);
  });

  it("serves execution state only through the authenticated tRPC procedure", async () => {
    const response = await fetch(`${apiOnly}/api/trpc/nexo.executions.stateSummary`);
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).toContain("UNAUTHORIZED");
  });
});
