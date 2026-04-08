import express from "express";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { registerConsentRoutes } from "./_core/consent";

async function createTestServer() {
  const app = express();
  app.use(express.json());
  registerConsentRoutes(app);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  return server;
}

describe("POST /api/consent", () => {
  const servers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (!server) continue;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("accepts valid payload and returns audit metadata", async () => {
    const server = await createTestServer();
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not resolve test server address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketing: true,
        analytics: false,
        cookies: true,
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(typeof payload.consentId).toBe("string");
    expect(typeof payload.consentAt).toBe("string");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("nexo_lgpd_consent=");
  });

  it("rejects invalid payload", async () => {
    const server = await createTestServer();
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not resolve test server address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketing: true,
        analytics: false,
        cookies: false,
      }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Payload de consentimento inválido.");
  });
});
