import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousApiUrl = vi.hoisted(() => {
  const previous = process.env.NEXO_API_URL;
  process.env.NEXO_API_URL = "http://nexo-api.c72e.test";
  return previous;
});

import { clientIpChainMetrics, maskAddress } from "./_core/clientIp";

// C7.2e diagnostic panel backend: masked mode carries no full address, first/last-hop comparisons
// are computed server-side, the API still decides who is a platform operator, and the response
// without input is unchanged (manual procedure keeps working).
const API = "http://nexo-api.c72e.test";
const CLIENT = "198.51.100.23";
const EDGE = "203.0.113.9";
const V6 = "2001:db8:aa:bb::42";
const TOKENS = { platform: "jwt-platform.h.s", orgAdmin: "jwt-org-admin.h.s" };
const USERS: Record<string, { id: string; orgId: string; email: string; role: string }> = {
  [TOKENS.platform]: { id: "user-platform", orgId: "org-a", email: "ops@org-a.test", role: "ADMIN" },
  [TOKENS.orgAdmin]: { id: "user-admin-b", orgId: "org-b", email: "admin@org-b.test", role: "ADMIN" },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const platformChecks: string[] = [];

function fakeApi(path: string, init: RequestInit = {}) {
  const token = new Headers(init.headers).get("authorization")?.replace(/^Bearer /, "") ?? "";
  const user = USERS[token];
  if (path === "/v1/me") return user ? json({ data: { user, organization: { id: user.orgId } } }) : json({ message: "Sessão expirada" }, 401);
  if (path === "/v1/admin/platform-access") {
    platformChecks.push(token);
    if (!user) return json({ message: "Unauthorized" }, 401);
    return token === TOKENS.platform ? json({ platformAdmin: true }) : json({ message: "Acesso restrito à administração da plataforma.", code: null }, 403);
  }
  return json({ message: "not found" }, 404);
}

describe("maskAddress", () => {
  it("keeps only a partial prefix", () => {
    expect(maskAddress(CLIENT, 4)).toBe("198.51.•.•");
    expect(maskAddress("2001:db8:aa:bb::42", 6)).toBe("2001:db8:…");
  });
});

describe("C7.2e diagnostic endpoint (BFF)", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    const { createBffApp } = await import("./_core/app");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith(API)) return fakeApi(new URL(url).pathname, init);
      return realFetch(input as any, init);
    });
    server = createServer(createBffApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (previousApiUrl === undefined) delete process.env.NEXO_API_URL;
    else process.env.NEXO_API_URL = previousApiUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => { platformChecks.length = 0; clientIpChainMetrics.drain(); });

  const diagnostic = (token: string | null, headers: Record<string, string>, input?: unknown) => {
    const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
    return realFetch(`${base}/api/trpc/system.clientIpDiagnostic${query}`, { headers: { ...(token ? { cookie: `nexo_token=${token}` } : {}), ...headers } });
  };
  const self = async (res: Response) => (await res.json()).result.data.json.self;

  it("masked mode: no full address anywhere in the response; comparisons still computed", async () => {
    const res = await diagnostic(TOKENS.platform, { "X-Forwarded-For": `${CLIENT}, ${EDGE}`, "X-Real-IP": CLIENT }, { addresses: "masked" });
    expect(res.status).toBe(200);
    const text = await res.clone().text();
    expect(text).not.toContain(CLIENT);
    expect(text).not.toContain(EDGE);
    const body = await self(res);
    expect(body).toMatchObject({ addresses: "masked", classification: "unverified", forwardedFor: { hops: 2 } });
    expect(body.realIp).toMatchObject({ present: true, valid: true, matchesFirstHop: true, matchesLastHop: false, address: "198.51.•.•" });
    expect(body.forwardedFor.chain.map((hop: any) => hop.address)).toEqual(["198.51.•.•", "203.0.•.•"]);
  });

  it("detects an X-Real-IP that differs from the first hop", async () => {
    const body = await self(await diagnostic(TOKENS.platform, { "X-Forwarded-For": `${EDGE}, ${CLIENT}`, "X-Real-IP": CLIENT }, { addresses: "masked" }));
    expect(body.realIp).toMatchObject({ matchesFirstHop: false, matchesLastHop: true });
  });

  it("IPv6 addresses are masked too", async () => {
    const res = await diagnostic(TOKENS.platform, { "X-Forwarded-For": V6, "X-Real-IP": V6 }, { addresses: "masked" });
    const text = await res.clone().text();
    expect(text).not.toContain(V6);
    expect((await self(res)).realIp).toMatchObject({ matchesFirstHop: true, address: "2001:db8:…" });
  });

  it("full mode only when explicitly requested", async () => {
    const body = await self(await diagnostic(TOKENS.platform, { "X-Forwarded-For": `${CLIENT}, ${EDGE}`, "X-Real-IP": CLIENT }, { addresses: "full" }));
    expect(body.addresses).toBe("full");
    expect(body.realIp.address).toBe(CLIENT);
  });

  it("without input the response is unchanged (full public addresses, as before)", async () => {
    const body = await self(await diagnostic(TOKENS.platform, { "X-Forwarded-For": `${CLIENT}, ${EDGE}`, "X-Real-IP": CLIENT }));
    expect(body.forwardedFor.chain.map((hop: any) => hop.address)).toEqual([CLIENT, EDGE]);
  });

  it("an organization ADMIN is refused by the API (the screen role filter is not the control)", async () => {
    const res = await diagnostic(TOKENS.orgAdmin, { "X-Forwarded-For": CLIENT }, { addresses: "masked" });
    expect(res.status).toBe(403);
    expect(platformChecks).toEqual([TOKENS.orgAdmin]);
    expect(await res.text()).not.toContain(CLIENT);
  });

  it("anonymous requests never reach the platform check", async () => {
    const res = await diagnostic(null, {}, { addresses: "masked" });
    expect(res.status).toBe(401);
    expect(platformChecks).toEqual([]);
  });

  it("rejects unknown input values", async () => {
    const res = await diagnostic(TOKENS.platform, {}, { addresses: "everything" });
    expect(res.status).toBe(400);
  });

  it("the diagnostic does not make anything verified (NO_TRUST stays)", async () => {
    const body = await self(await diagnostic(TOKENS.platform, { "X-Forwarded-For": CLIENT, "X-Real-IP": CLIENT }, { addresses: "masked" }));
    expect(body.classification).toBe("unverified");
    expect(body.policy).toContain("observation-only");
  });
});
