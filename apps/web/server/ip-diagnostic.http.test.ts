import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousApiUrl = vi.hoisted(() => {
  const previous = process.env.NEXO_API_URL;
  process.env.NEXO_API_URL = "http://nexo-api.c72e.test";
  return previous;
});

import { clientIpChainMetrics, expandIpv6, maskAddress } from "./_core/clientIp";
import { cacheControlHeaderFor } from "./_core/app";

// C7.2e diagnostic panel backend: masked mode carries no full address, first/last-hop comparisons
// are computed server-side, the API still decides who is a platform operator, and the response
// without input is unchanged (manual procedure keeps working).
const API = "http://nexo-api.c72e.test";
const CLIENT = "198.51.100.23";
const EDGE = "203.0.113.9";
const V6 = "2001:db8:aa:bb::42";
const TOKENS = { platform: "jwt-platform.h.s", orgAdmin: "jwt-org-admin.h.s", limited: "jwt-limited.h.s" };
const USERS: Record<string, { id: string; orgId: string; email: string; role: string }> = {
  [TOKENS.platform]: { id: "user-platform", orgId: "org-a", email: "ops@org-a.test", role: "ADMIN" },
  [TOKENS.orgAdmin]: { id: "user-admin-b", orgId: "org-b", email: "admin@org-b.test", role: "ADMIN" },
  [TOKENS.limited]: { id: "user-limited", orgId: "org-a", email: "busy@org-a.test", role: "ADMIN" },
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
    if (token === TOKENS.limited) return new Response(JSON.stringify({ message: "ThrottlerException: Too Many Requests", code: "RATE_LIMITED" }), { status: 429, headers: { "content-type": "application/json", "Retry-After": "30" } });
    return token === TOKENS.platform ? json({ platformAdmin: true }) : json({ message: "Acesso restrito à administração da plataforma.", code: null }, 403);
  }
  return json({ message: "not found" }, 404);
}

describe("maskAddress", () => {
  it("IPv4: first two octets only", () => {
    expect(maskAddress(CLIENT, 4)).toBe("198.51.•.•");
    expect(maskAddress(" 10.0.0.1 ", 4)).toBe("10.0.•.•");
  });

  it.each([
    ["2804:14c:65:8000:1234:5678:9abc:def0", "2804:14c::/32"], // full form
    ["2001:db8:aa:bb::42", "2001:db8::/32"],
    ["2600::5", "2600:0::/32"], // compressed: host bits never shown
    ["2001:db8::1", "2001:db8::/32"],
    ["::", "0:0::/32"],
    ["::1", "0:0::/32"],
    ["2001:DB8:0:0:0:0:0:1", "2001:db8::/32"], // case and zero-padding normalized
    ["fe80::1%eth0", "fe80:0::/32"], // zone id dropped
    ["64:ff9b::198.51.100.23", "64:ff9b::/32"], // embedded IPv4 tail in a non-mapped prefix
  ])("IPv6 %s → %s (expanded /32 prefix)", (address, masked) => {
    expect(maskAddress(address, 6)).toBe(masked);
  });

  it("IPv4-mapped IPv6 is masked as IPv4", () => {
    expect(maskAddress(`::ffff:${CLIENT}`, 6)).toBe("198.51.•.•");
    expect(maskAddress("::ffff:c633:6417", 6)).toBe("198.51.•.•");
  });

  it.each([
    ["", 6], ["garbage", 6], ["1:2:3", 6], ["1::2::3", 6], ["12345::1", 6], [":::", 6], ["g::1", 6],
    ["", 4], ["999.1.1.1", 4], ["1.2.3", 4], ["2001:db8::1", 4], [null as any, 4], [undefined as any, 6],
  ])("malformed %j (family %s) → invalid", (address, family) => {
    expect(maskAddress(address, family as 4 | 6)).toBe("invalid");
  });

  it("never reveals any group after the /32 prefix, for any compression", () => {
    const groups = ["2001", "db8", "a1b2", "c3d4", "e5f6", "7788", "99aa", "bbcc"];
    for (let start = 2; start < 8; start++) {
      for (let end = start + 1; end <= 8; end++) {
        const zeroed = groups.map((g, i) => (i >= start && i < end ? "0" : g));
        const compressed = `${zeroed.slice(0, start).join(":")}::${zeroed.slice(end).join(":")}`;
        const masked = maskAddress(compressed, 6);
        expect(masked).toBe("2001:db8::/32");
        for (const host of groups.slice(2)) expect(masked).not.toContain(host);
      }
    }
    expect(expandIpv6("2600::5")).toEqual([0x2600, 0, 0, 0, 0, 0, 0, 5]);
  });
});

describe("cacheControlHeaderFor", () => {
  it("only the diagnostic (alone or in a batch) and unparsed requests get no-store", () => {
    expect(cacheControlHeaderFor(["system.clientIpDiagnostic"])).toEqual({ "Cache-Control": "private, no-store" });
    expect(cacheControlHeaderFor(["system.health", "system.clientIpDiagnostic"])).toEqual({ "Cache-Control": "private, no-store" });
    expect(cacheControlHeaderFor(undefined)).toEqual({ "Cache-Control": "private, no-store" });
    expect(cacheControlHeaderFor(["system.health"])).toBeUndefined();
    expect(cacheControlHeaderFor(["auth.me", "dashboard.kpis"])).toBeUndefined();
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
    expect((await self(res)).realIp).toMatchObject({ matchesFirstHop: true, address: "2001:db8::/32" });
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

  it("compressed IPv6 never reveals host bits in masked mode", async () => {
    const res = await diagnostic(TOKENS.platform, { "X-Forwarded-For": "2600::5", "X-Real-IP": "2600::5" }, { addresses: "masked" });
    const text = await res.clone().text();
    expect(text).not.toContain("2600::5");
    expect(text).not.toContain("2600:5");
    const body = await self(res);
    expect(body.realIp.address).toBe("2600:0::/32");
    expect(body.forwardedFor.chain[0].address).toBe("2600:0::/32");
  });

  describe("Cache-Control: private, no-store on every diagnostic response", () => {
    const noStore = (res: Response) => expect(res.headers.get("cache-control")).toBe("private, no-store");
    const xff = { "X-Forwarded-For": `${CLIENT}, ${EDGE}`, "X-Real-IP": CLIENT };

    it("success in masked and full modes, and without input", async () => {
      noStore(await diagnostic(TOKENS.platform, xff, { addresses: "masked" }));
      noStore(await diagnostic(TOKENS.platform, xff, { addresses: "full" }));
      noStore(await diagnostic(TOKENS.platform, xff));
    });

    it("errors: 401 anonymous, 403 organization ADMIN, 400 invalid input", async () => {
      const anonymous = await diagnostic(null, {}, { addresses: "masked" });
      expect(anonymous.status).toBe(401); noStore(anonymous);
      const forbidden = await diagnostic(TOKENS.orgAdmin, xff, { addresses: "masked" });
      expect(forbidden.status).toBe(403); noStore(forbidden);
      const invalid = await diagnostic(TOKENS.platform, {}, { addresses: "everything" });
      expect(invalid.status).toBe(400); noStore(invalid);
    });

    it("429 keeps Retry-After alongside no-store", async () => {
      const res = await diagnostic(TOKENS.limited, xff, { addresses: "masked" });
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("30");
      noStore(res);
    });

    it("a batch that includes the diagnostic is never cacheable", async () => {
      const input = encodeURIComponent(JSON.stringify({ 0: { json: { timestamp: 0 } }, 1: { json: { addresses: "masked" } } }));
      const res = await realFetch(`${base}/api/trpc/system.health,system.clientIpDiagnostic?batch=1&input=${input}`, { headers: { cookie: `nexo_token=${TOKENS.platform}`, ...xff } });
      expect(res.status).toBe(200);
      noStore(res);
      expect(await res.text()).not.toContain(CLIENT);
    });

    it("POST to the diagnostic (wrong method) also answers no-store", async () => {
      const res = await realFetch(`${base}/api/trpc/system.clientIpDiagnostic`, { method: "POST", headers: { "content-type": "application/json", cookie: `nexo_token=${TOKENS.platform}` }, body: JSON.stringify({ json: { addresses: "masked" } }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      noStore(res);
    });

    it("other endpoints keep their current caching behaviour", async () => {
      const input = encodeURIComponent(JSON.stringify({ json: { timestamp: 0 } }));
      const res = await realFetch(`${base}/api/trpc/system.health?input=${input}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBeNull();
    });
  });

  it("the diagnostic does not make anything verified (NO_TRUST stays)", async () => {
    const body = await self(await diagnostic(TOKENS.platform, { "X-Forwarded-For": CLIENT, "X-Real-IP": CLIENT }, { addresses: "masked" }));
    expect(body.classification).toBe("unverified");
    expect(body.policy).toContain("observation-only");
  });
});
