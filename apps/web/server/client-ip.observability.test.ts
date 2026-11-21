import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousApiUrl = vi.hoisted(() => {
  const previous = process.env.NEXO_API_URL;
  process.env.NEXO_API_URL = "http://nexo-api.c72c.test";
  return previous;
});

import {
  ClientIpChainMetrics,
  MAX_FORWARDED_HOPS,
  NO_TRUST,
  clientIpChainMetrics,
  clientIpObservationMiddleware,
  normalizeIp,
  observeClientIpChain,
  trustPolicyFrom,
} from "./_core/clientIp";
import { logger } from "./_core/logger";

// C7.2c: observation of the client IP chain. Nothing is trusted in production, nothing is used
// for security decisions, and no address leaks into diagnostics logs, metrics or cookies.
const SPOOF = "6.6.6.6";
const CLIENT = "198.51.100.23";
const EDGE = "203.0.113.9";
const V6 = "2001:db8::42";
const TEST_ADDRESSES = [SPOOF, CLIENT, EDGE, V6, "10.20.30.40", "fd12:3456::7"];

function fakeReq(peer: string | undefined, headers: Record<string, string | string[]> = {}) {
  const lower: Record<string, string | string[]> = {};
  const distinct: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    lower[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
    distinct[key.toLowerCase()] = Array.isArray(value) ? value : [value];
  }
  return { socket: { remoteAddress: peer }, headers: lower, headersDistinct: distinct } as any;
}

describe("C7.2c: chain observation (NO_TRUST, production policy)", () => {
  it("direct connection without headers: unverified, candidate is the TCP peer", () => {
    const o = observeClientIpChain(fakeReq(CLIENT));
    expect(o).toMatchObject({ classification: "unverified", source: "connection", candidate: CLIENT, issues: [] });
    expect(o.peer).toEqual({ family: "ipv4", scope: "public", mapped: false });
  });

  it("a spoofed X-Forwarded-For is never verified and the leftmost value is never the candidate", () => {
    const o = observeClientIpChain(fakeReq("10.20.30.40", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}` }));
    expect(o.classification).toBe("unverified");
    expect(o.candidate).toBe(CLIENT); // nearest hop (rightmost), not the client-chosen 6.6.6.6
    expect(o.forwardedFor).toMatchObject({ present: true, hops: 2 });
  });

  it("never classifies as verified without an explicit trust policy, even with consistent headers", () => {
    const o = observeClientIpChain(fakeReq("10.20.30.40", { "X-Forwarded-For": CLIENT, "X-Real-IP": CLIENT }));
    expect(o.classification).toBe("unverified");
    expect(o.realIp).toEqual({ present: true, valid: true, matchesLastHop: true });
    expect(NO_TRUST.trustedProxies).toBeNull();
  });

  it.each([
    ["IPv6 peer", V6, { family: "ipv6", scope: "public", mapped: false }],
    ["IPv4-mapped IPv6 peer", "::ffff:10.20.30.40", { family: "ipv4", scope: "private", mapped: true }],
    ["unique-local IPv6 peer", "fd12:3456::7", { family: "ipv6", scope: "private", mapped: false }],
    ["loopback peer", "127.0.0.1", { family: "ipv4", scope: "loopback", mapped: false }],
  ])("classifies the %s", (_label, peer, expected) => {
    expect(observeClientIpChain(fakeReq(peer)).peer).toEqual(expected);
  });

  it("normalizes ports, brackets and zone ids, and rejects non-addresses", () => {
    expect(normalizeIp("203.0.113.9:51234")?.address).toBe(EDGE);
    expect(normalizeIp("[2001:db8::42]:443")?.address).toBe(V6);
    expect(normalizeIp("fe80::1%eth0")?.address).toBe("fe80::1");
    for (const bad of ["", "unknown", "300.1.1.1", "1.2.3", "abc::xyz::", "<script>", "1.2.3.4.5", null, 42]) {
      expect(normalizeIp(bad as any)).toBeNull();
    }
  });

  it.each([
    ["malformed entry", { "X-Forwarded-For": `${CLIENT}, not-an-ip` }, "xff_malformed_entry"],
    ["empty entry", { "X-Forwarded-For": `${CLIENT}, , ${EDGE}` }, "xff_malformed_entry"],
    ["oversized header", { "X-Forwarded-For": `${CLIENT}, `.repeat(120) + CLIENT }, "xff_too_long"],
    ["too many hops", { "X-Forwarded-For": Array.from({ length: MAX_FORWARDED_HOPS + 1 }, (_v, i) => `10.0.0.${i + 1}`).join(",") }, "xff_too_many_hops"],
    ["malformed X-Real-IP", { "X-Real-IP": "nope" }, "xri_malformed"],
    ["repeated X-Real-IP", { "X-Real-IP": [CLIENT, SPOOF] }, "xri_repeated"],
    ["X-Real-IP list", { "X-Real-IP": `${CLIENT}, ${SPOOF}` }, "xri_repeated"],
  ])("%s → invalid, no candidate", (_label, headers, issue) => {
    const o = observeClientIpChain(fakeReq("10.20.30.40", headers as any));
    expect(o.classification).toBe("invalid");
    expect(o.candidate).toBeNull();
    expect(o.issues).toContain(issue);
  });

  it("repeated X-Forwarded-For lines are combined in order (legal) but flagged", () => {
    const o = observeClientIpChain(fakeReq("10.20.30.40", { "X-Forwarded-For": [SPOOF, CLIENT] }));
    expect(o.classification).toBe("unverified");
    expect(o.issues).toContain("xff_repeated_header");
    expect(o.candidate).toBe(CLIENT);
  });

  it("an X-Real-IP that contradicts the nearest hop is reported", () => {
    const o = observeClientIpChain(fakeReq("10.20.30.40", { "X-Forwarded-For": CLIENT, "X-Real-IP": SPOOF }));
    expect(o.issues).toContain("xri_mismatch_last_hop");
    expect(o.realIp.matchesLastHop).toBe(false);
  });

  it("an unknown peer is reported and never throws", () => {
    expect(observeClientIpChain(fakeReq(undefined)).issues).toContain("peer_unknown");
    expect(() => observeClientIpChain({} as any)).not.toThrow();
  });
});

describe("C7.2c: explicit trust policy (not enabled in production)", () => {
  const edge = trustPolicyFrom(["10.0.0.0/8", "fd00::/8"], 1);

  it("verified only when the TCP peer is a trusted proxy; candidate counted from the right", () => {
    const o = observeClientIpChain(fakeReq("10.1.2.3", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}` }), edge);
    expect(o).toMatchObject({ classification: "verified", source: "forwarded-for", candidate: CLIENT });
  });

  it("multiple trusted proxies: the client is N hops from the right", () => {
    const twoHops = trustPolicyFrom(["10.0.0.0/8"], 2);
    const o = observeClientIpChain(fakeReq("10.1.2.3", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}, 10.9.9.9` }), twoHops);
    expect(o).toMatchObject({ classification: "verified", candidate: CLIENT });
  });

  it("direct access to the BFF (peer outside the trusted proxies) stays unverified", () => {
    const o = observeClientIpChain(fakeReq(SPOOF, { "X-Forwarded-For": CLIENT }), edge);
    expect(o.classification).toBe("unverified");
  });

  it("fewer hops than trusted proxies, or a malformed chain, is not verified", () => {
    expect(observeClientIpChain(fakeReq("10.1.2.3"), edge).classification).toBe("unverified");
    expect(observeClientIpChain(fakeReq("10.1.2.3", { "X-Forwarded-For": "garbage" }), edge).classification).toBe("invalid");
  });

  it("IPv6 trusted proxy and mapped peers are matched", () => {
    expect(observeClientIpChain(fakeReq("fd00::1", { "X-Forwarded-For": V6 }), edge).candidate).toBe(V6);
    expect(observeClientIpChain(fakeReq("::ffff:10.1.2.3", { "X-Forwarded-For": CLIENT }), edge).classification).toBe("verified");
  });

  it.each([[["10.0.0.0/33"], 1], [["nope/8"], 1], [["10.0.0.0"], 1], [["10.0.0.0/8"], 0], [["10.0.0.0/8"], 6]])("rejects invalid policy %j/%j", (cidrs, hops) => {
    expect(() => trustPolicyFrom(cidrs as string[], hops as number)).toThrow();
  });
});

describe("C7.2c: aggregated metrics and summary logs", () => {
  it("buckets contain shapes only, never addresses", () => {
    const metrics = new ClientIpChainMetrics();
    metrics.record(observeClientIpChain(fakeReq("10.20.30.40", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}`, "X-Real-IP": CLIENT })));
    metrics.record(observeClientIpChain(fakeReq(V6)));
    const text = JSON.stringify(metrics.snapshot());
    for (const address of TEST_ADDRESSES) expect(text).not.toContain(address);
    expect(metrics.snapshot()).toMatchObject({ total: 2 });
    expect(text).toContain("unverified|forwarded-for|hops=2|xri=ok|peer=ipv4/private|last=public");
  });

  it("cardinality is bounded and drain resets the window", () => {
    const metrics = new ClientIpChainMetrics();
    for (let i = 0; i < 5000; i++) metrics.record(observeClientIpChain(fakeReq(`10.0.${i % 250}.${(i * 7) % 250}`, { "X-Forwarded-For": `198.51.100.${i % 250}` })));
    expect(metrics.snapshot().buckets.length).toBeLessThanOrEqual(50);
    expect((metrics as any).buckets.size).toBeLessThanOrEqual(ClientIpChainMetrics.MAX_BUCKETS + 1);
    expect(metrics.drain().total).toBe(5000);
    expect(metrics.snapshot()).toEqual({ total: 0, buckets: [], issues: {} });
  });

  it("stays bounded under hostile, malformed input (issues are a fixed set)", () => {
    const metrics = new ClientIpChainMetrics();
    const junk = ["", " ", ",,,,", "\u0000", "1.1.1.1:99999999", "[::1", "::ffff:999.1.1.1", "a".repeat(5000), "%zz", "1.2.3.4, ".repeat(25)];
    for (let i = 0; i < 3000; i++) {
      metrics.record(observeClientIpChain(fakeReq(i % 3 ? `junk-${i}` : `10.${i % 250}.0.1`, {
        "X-Forwarded-For": [junk[i % junk.length], `${i}.${i}.${i}.${i}`],
        "X-Real-IP": i % 2 ? junk[(i + 3) % junk.length] : [`198.51.100.${i % 250}`, "x"],
      })));
    }
    const snapshot = metrics.snapshot();
    expect(snapshot.total).toBe(3000);
    expect((metrics as any).buckets.size).toBeLessThanOrEqual(ClientIpChainMetrics.MAX_BUCKETS + 1);
    const allowedIssues = ["peer_unknown", "xff_malformed_entry", "xff_repeated_header", "xff_too_long", "xff_too_many_hops", "xri_malformed", "xri_mismatch_last_hop", "xri_repeated"];
    for (const issue of Object.keys(snapshot.issues)) expect(allowedIssues).toContain(issue);
    expect(JSON.stringify(snapshot)).not.toMatch(/junk-|\d+\.\d+\.\d+\.\d+/);
  });

  it("the production middleware uses NO_TRUST: nothing is ever counted as verified", () => {
    const metrics = new ClientIpChainMetrics();
    const middleware = clientIpObservationMiddleware(metrics, () => undefined, 60_000);
    // A request that an explicit edge policy would verify.
    middleware(fakeReq("10.1.2.3", { "X-Forwarded-For": CLIENT, "X-Real-IP": CLIENT }), {}, () => undefined);
    middleware.stop();
    const shapes = metrics.snapshot().buckets.map((bucket) => bucket.shape);
    expect(shapes.some((shape) => shape.startsWith("verified|"))).toBe(false);
    expect(shapes).toEqual(["unverified|forwarded-for|hops=1|xri=ok|peer=ipv4/private|last=public"]);
  });

  it("the middleware never alters or blocks the request and logs one summary per window, without addresses", () => {
    vi.useFakeTimers();
    try {
      const metrics = new ClientIpChainMetrics();
      const lines: string[] = [];
      const middleware = clientIpObservationMiddleware(metrics, (line) => lines.push(line), 1000);
      const next = vi.fn();
      const req = fakeReq("10.20.30.40", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}` });
      const before = JSON.stringify(req.headers);
      middleware(req, {}, next);
      middleware({} as any, {}, next); // broken request object: still calls next
      expect(next).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(req.headers)).toBe(before);
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000); // empty window: nothing logged
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ event: "client_ip_chain_summary", total: 2 });
      for (const address of TEST_ADDRESSES) expect(lines[0]).not.toContain(address);
      middleware.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

const API = "http://nexo-api.c72c.test";
const TOKENS = { platform: "jwt-platform.h.s", orgAdmin: "jwt-org-admin.h.s", staff: "jwt-staff.h.s" };
const USERS: Record<string, { id: string; orgId: string; email: string; role: string }> = {
  [TOKENS.platform]: { id: "user-platform", orgId: "org-a", email: "ops@org-a.test", role: "ADMIN" },
  [TOKENS.orgAdmin]: { id: "user-admin-b", orgId: "org-b", email: "admin@org-b.test", role: "ADMIN" },
  [TOKENS.staff]: { id: "user-staff", orgId: "org-a", email: "staff@org-a.test", role: "STAFF" },
};
const upstream: Array<{ path: string; headers: Headers }> = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeApi(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  upstream.push({ path, headers });
  const token = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const user = USERS[token];
  if (path === "/v1/me") return user ? json({ data: { user, organization: { id: user.orgId } } }) : json({ message: "Sessão expirada" }, 401);
  if (path === "/v1/admin/platform-access") {
    if (!user) return json({ message: "Unauthorized" }, 401);
    return token === TOKENS.platform ? json({ platformAdmin: true }) : json({ message: "Acesso restrito à administração da plataforma." }, 403);
  }
  return json({ message: "not found" }, 404);
}

describe("C7.2c over HTTP (BFF)", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;
  const output: string[] = [];

  beforeAll(async () => {
    const { createBffApp } = await import("./_core/app");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith(API)) return fakeApi(url.slice(API.length).split("?")[0], init);
      return realFetch(input as any, init);
    });
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => { output.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ")); });
    }
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

  beforeEach(() => { upstream.length = 0; output.length = 0; clientIpChainMetrics.drain(); });
  afterEach(() => vi.clearAllMocks());

  const diagnostic = (token?: string, headers: Record<string, string> = {}) =>
    realFetch(`${base}/api/trpc/system.clientIpDiagnostic`, { headers: { ...(token ? { cookie: `nexo_token=${token}` } : {}), ...headers } });

  describe("administrative diagnostic", () => {
    it("anonymous → UNAUTHORIZED, and the platform check is never called", async () => {
      const res = await diagnostic();
      expect(res.status).toBe(401);
      expect(upstream.some((call) => call.path === "/v1/admin/platform-access")).toBe(false);
    });

    it("an organization ADMIN (not a platform operator) → FORBIDDEN", async () => {
      const res = await diagnostic(TOKENS.orgAdmin, { "X-Forwarded-For": CLIENT });
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain(CLIENT);
    });

    it("STAFF → FORBIDDEN", async () => {
      expect((await diagnostic(TOKENS.staff)).status).toBe(403);
    });

    it("a platform operator sees only their own request: public hops, masked private ones, no headers or secrets", async () => {
      const res = await diagnostic(TOKENS.platform, { "X-Forwarded-For": `${SPOOF}, 10.20.30.40, ${CLIENT}`, "X-Real-IP": CLIENT, "User-Agent": "c72c-agent" });
      expect(res.status).toBe(200);
      const text = await res.text();
      const body = JSON.parse(text).result.data.json;
      expect(body.self).toMatchObject({ classification: "unverified", source: "forwarded-for", peer: { family: "ipv4", scope: "loopback" } });
      expect(body.self.forwardedFor.chain.map((hop: any) => hop.address)).toEqual([SPOOF, "<private>", CLIENT]);
      expect(body.self.realIp).toMatchObject({ present: true, valid: true, matchesLastHop: true, address: CLIENT });
      expect(text).not.toMatch(/10\.20\.30\.40|127\.0\.0\.1|nexo_token|jwt-platform|authorization|cookie|c72c-agent/i);
      // The platform check used the caller's own session; the browser's forwarding headers were not passed on.
      const check = upstream.find((call) => call.path === "/v1/admin/platform-access");
      expect(check?.headers.get("authorization")).toBe(`Bearer ${TOKENS.platform}`);
    });

    it("isolation: one operator never sees another request's data", async () => {
      await diagnostic(TOKENS.orgAdmin, { "X-Forwarded-For": "192.0.2.77" });
      const text = await (await diagnostic(TOKENS.platform, { "X-Forwarded-For": CLIENT })).text();
      expect(text).not.toContain("192.0.2.77");
      expect(JSON.parse(text).result.data.json.aggregate.total).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(JSON.parse(text).result.data.json.aggregate)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    });
  });

  describe("nothing changes for the API or for sessions", () => {
    it("forwarding headers sent by the browser are not forwarded to the API (limits keep their current identity)", async () => {
      await realFetch(`${base}/api/trpc/auth.login`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Forwarded-For": SPOOF, "X-Real-IP": SPOOF, "X-Nexo-Client-Context": "forged" },
        body: JSON.stringify({ json: { email: "a@b.test", password: "whatever-1" } }),
      });
      const login = upstream.find((call) => call.path === "/v1/auth/login");
      expect(login).toBeDefined();
      for (const name of ["x-forwarded-for", "x-real-ip", "x-nexo-client-context", "forwarded"]) expect(login!.headers.get(name)).toBeNull();
    });

    it("sessions still rely on the HttpOnly cookie and /me, regardless of spoofed headers", async () => {
      const res = await diagnostic(TOKENS.platform, { "X-Forwarded-For": SPOOF });
      expect(res.status).toBe(200);
      expect(upstream.find((call) => call.path === "/v1/me")?.headers.get("authorization")).toBe(`Bearer ${TOKENS.platform}`);
    });

    it("observation is recorded for every request and no diagnostic output contains addresses", async () => {
      await diagnostic(undefined, { "X-Forwarded-For": `${SPOOF}, ${CLIENT}` });
      expect(clientIpChainMetrics.snapshot().total).toBeGreaterThanOrEqual(1);
      for (const address of TEST_ADDRESSES) expect(output.join("\n")).not.toContain(address);
    });
  });

  describe("LGPD consent", () => {
    const consent = (headers: Record<string, string> = {}) =>
      realFetch(`${base}/api/consent`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ marketing: true, analytics: false, cookies: true }) });

    it("keeps the response contract and stores no IP in the browser cookie", async () => {
      const res = await consent({ "X-Forwarded-For": `${SPOOF}, ${CLIENT}` });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(["consentAt", "consentId", "ok"]);
      const cookie = res.headers.getSetCookie().find((c) => c.startsWith("nexo_lgpd_consent=")) ?? "";
      expect(cookie).toMatch(/HttpOnly/i);
      // The route encodes the JSON and Express encodes the cookie value again.
      const value = JSON.parse(decodeURIComponent(decodeURIComponent(cookie.split(";")[0].slice("nexo_lgpd_consent=".length))));
      expect(value).toMatchObject({ id: body.consentId, version: 1, consentAt: body.consentAt, preferences: { marketing: true, analytics: false, cookies: true } });
      expect(value).not.toHaveProperty("ip");
      for (const address of [...TEST_ADDRESSES, "127.0.0.1"]) expect(cookie).not.toContain(encodeURIComponent(address));
    });

    it.each([
      ["spoofed chain", { "X-Forwarded-For": `${SPOOF}, ${CLIENT}` }, "unverified"],
      ["consistent X-Real-IP", { "X-Forwarded-For": CLIENT, "X-Real-IP": CLIENT }, "unverified"],
      ["no forwarding headers (TCP peer only)", {}, "unverified"],
      ["malformed header", { "X-Forwarded-For": "<script>alert(1)</script>" }, "invalid"],
    ])("%s: the audit record keeps the event, records ip: null and why", async (_label, headers, verification) => {
      const audit = vi.spyOn(logger.audit, "info");
      const res = await consent(headers as Record<string, string>);
      const body = await res.json();
      expect(audit).toHaveBeenCalledTimes(1);
      const [message, record] = audit.mock.calls[0] as [string, Record<string, unknown>];
      expect(message).toBe("LGPD consentimento registrado");
      expect(record).toEqual({
        consentEventId: body.consentId,
        consentAt: body.consentAt,
        preferences: { marketing: true, analytics: false, cookies: true },
        ip: null,
        ipVerified: false,
        ipVerification: verification,
      });
      for (const address of [...TEST_ADDRESSES, "127.0.0.1"]) expect(JSON.stringify(audit.mock.calls)).not.toContain(address);
    });

    it("the record would carry an address only for a verified origin, never in production (NO_TRUST)", async () => {
      // Same request through a trusted policy is verified, but the route always uses NO_TRUST.
      const req = fakeReq("10.1.2.3", { "X-Forwarded-For": CLIENT });
      expect(observeClientIpChain(req, trustPolicyFrom(["10.0.0.0/8"], 1)).classification).toBe("verified");
      expect(observeClientIpChain(req).classification).toBe("unverified");
    });
  });
});
