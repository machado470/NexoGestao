import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousEnv = vi.hoisted(() => {
  const keys = ["NEXO_API_URL", "NEXO_INTERNAL_AUTH_SIGNING", "NEXO_INTERNAL_AUTH_KEY_ID", "NEXO_INTERNAL_AUTH_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.NEXO_API_URL = "http://nexo-api.c72d.test";
  return previous;
});

import {
  INTERNAL_AUTH_HEADER,
  canonicalString,
  internalApiHeaders,
  readInternalAuthSigner,
  requestTarget,
  resetInternalAuthSignerForTests,
  signInternalRequest,
  withoutInternalHeaders,
} from "./_core/internalAuth";

// C7.2d: signer side of the BFF → API HMAC. Test keys are random per run (never real secrets).
const KEY = randomBytes(32);
const KEY_B64 = KEY.toString("base64");
const API = "http://nexo-api.c72d.test";

/** Independent verifier for tests (mirrors apps/api internal-auth.protocol.ts). */
function verify(header: string | null, method: string, target: string, body = "", key = KEY) {
  if (!header) return "missing";
  const [v, kid, ts, nonce, sig] = header.split(".");
  if (v !== "v1") return "malformed";
  const digest = createHash("sha256").update(body).digest("hex");
  const canonical = ["NEXO-INTERNAL-AUTH", "v1", kid, ts, nonce, method, target, digest].join("\n");
  return createHmac("sha256", key).update(canonical).digest("base64url") === sig ? "valid" : "bad_signature";
}

describe("C7.2d signer", () => {
  it("matches the shared known-answer vector (same as the API suite)", () => {
    const signer = { kid: "k1", key: Buffer.alloc(32, 0x11) };
    const header = signInternalRequest(signer, { method: "post", url: "http://api.test/v1/auth/login?x=1", body: JSON.stringify({ a: 1 }) }, () => 1700000000_000, "AAAAAAAAAAAAAAAAAAAAAA");
    expect(header).toBe("v1.k1.1700000000.AAAAAAAAAAAAAAAAAAAAAA.DHgjpY_BffI0liBKmUyRZ5So0k3X9_RnmZ7R36KGhxM");
    expect(canonicalString({ kid: "k1", ts: 1, nonce: "n", method: "get", target: "/x", bodySha256: "h" })).toBe("NEXO-INTERNAL-AUTH\nv1\nk1\n1\nn\nGET\n/x\nh");
  });

  it("signs the request-target as fetch sends it", () => {
    expect(requestTarget("http://api.test/v1/me")).toBe("/v1/me");
    expect(requestTarget("http://api.test/v1/x?a=1&b=%C3%A9")).toBe("/v1/x?a=1&b=%C3%A9");
    expect(requestTarget("http://api.test/v1/x?")).toBe("/v1/x?");
    expect(requestTarget("http://api.test/v1/x#frag")).toBe("/v1/x");
    expect(requestTarget("http://api.test/v1/a b")).toBe("/v1/a%20b");
  });

  it("uses a fresh nonce per request and refuses to sign non-string bodies", () => {
    const signer = { kid: "k1", key: KEY };
    const a = signInternalRequest(signer, { url: `${API}/v1/me` })!;
    const b = signInternalRequest(signer, { url: `${API}/v1/me` })!;
    expect(a.split(".")[3]).not.toBe(b.split(".")[3]);
    expect(a).toMatch(/^v1\.k1\.\d{10}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    expect(signInternalRequest(signer, { url: `${API}/v1/x`, body: new Uint8Array([1]) })).toBeNull();
  });

  it("configuration: off by default; invalid values fail without echoing the secret", () => {
    expect(readInternalAuthSigner({})).toBeNull();
    expect(readInternalAuthSigner({ NEXO_INTERNAL_AUTH_SIGNING: "false", NEXO_INTERNAL_AUTH_SECRET: "x" })).toBeNull();
    expect(readInternalAuthSigner({ NEXO_INTERNAL_AUTH_SIGNING: "true", NEXO_INTERNAL_AUTH_KEY_ID: "k1", NEXO_INTERNAL_AUTH_SECRET: KEY.toString("base64url") })?.key.equals(KEY)).toBe(true);
    const short = randomBytes(16).toString("base64");
    for (const [env, message] of [
      [{ NEXO_INTERNAL_AUTH_SIGNING: "yes" }, "NEXO_INTERNAL_AUTH_SIGNING"],
      [{ NEXO_INTERNAL_AUTH_SIGNING: "true", NEXO_INTERNAL_AUTH_SECRET: KEY_B64 }, "KEY_ID"],
      [{ NEXO_INTERNAL_AUTH_SIGNING: "true", NEXO_INTERNAL_AUTH_KEY_ID: "k.1", NEXO_INTERNAL_AUTH_SECRET: KEY_B64 }, "KEY_ID"],
      [{ NEXO_INTERNAL_AUTH_SIGNING: "true", NEXO_INTERNAL_AUTH_KEY_ID: "k1", NEXO_INTERNAL_AUTH_SECRET: short }, "32 bytes"],
      [{ NEXO_INTERNAL_AUTH_SIGNING: "true", NEXO_INTERNAL_AUTH_KEY_ID: "k1", NEXO_INTERNAL_AUTH_SECRET: "not*base64!!" }, "32 bytes"],
    ] as const) {
      let error: Error | undefined;
      try { readInternalAuthSigner(env as any); } catch (e) { error = e as Error; }
      expect(error?.message).toContain(message);
      expect(error?.message).not.toContain(short);
      expect(error?.message).not.toContain(KEY_B64);
    }
  });

  it("outgoing headers: every x-nexo-* is dropped, names are preserved, the signature goes last", () => {
    expect(withoutInternalHeaders({ "X-Nexo-Internal-Auth": "forged", "x-nexo-client-context": "x", Authorization: "Bearer t" })).toEqual({ Authorization: "Bearer t" });
    const signed = internalApiHeaders({ Authorization: "Bearer t", "X-NEXO-INTERNAL-AUTH": "forged", "Idempotency-Key": "k" }, { method: "POST", url: `${API}/v1/x`, body: "{}" }, { kid: "k1", key: KEY });
    expect(Object.keys(signed)).toEqual(["Authorization", "Idempotency-Key", INTERNAL_AUTH_HEADER]);
    expect(verify(signed[INTERNAL_AUTH_HEADER], "POST", "/v1/x", "{}")).toBe("valid");
    expect(internalApiHeaders({ "x-nexo-internal-auth": "forged", A: "1" }, { url: `${API}/v1/x` }, null)).toEqual({ A: "1" });
  });
});

const TOKEN = "jwt-c72d.h.s";
const USER = { id: "user-a", orgId: "org-a", email: "alice@org-a.test", role: "ADMIN" };
const upstream: Array<{ method: string; target: string; headers: Headers; body: string }> = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeApi(url: string, init: RequestInit = {}) {
  const parsed = new URL(url);
  const target = parsed.href.slice(parsed.origin.length);
  const headers = new Headers(init.headers);
  upstream.push({ method: init.method ?? "GET", target, headers, body: typeof init.body === "string" ? init.body : "" });
  if (parsed.pathname === "/v1/me") return headers.get("authorization") === `Bearer ${TOKEN}` ? json({ data: { user: USER, organization: { id: USER.orgId } } }) : json({ message: "Sessão expirada" }, 401);
  if (parsed.pathname === "/v1/auth/login") return json({ data: { token: TOKEN, user: USER } }, 201);
  if (parsed.pathname === "/v1/notifications/stream") return json({ message: "unauthorized" }, 401);
  return json({ message: "not found" }, 404);
}

describe("C7.2d through the BFF (createBffApp)", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    process.env.NEXO_INTERNAL_AUTH_SIGNING = "true";
    process.env.NEXO_INTERNAL_AUTH_KEY_ID = "k1";
    process.env.NEXO_INTERNAL_AUTH_SECRET = KEY_B64;
    resetInternalAuthSignerForTests();
    const { createBffApp } = await import("./_core/app");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith(API)) return fakeApi(url, init);
      return realFetch(input as any, init);
    });
    server = createServer(createBffApp());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetInternalAuthSignerForTests();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => { upstream.length = 0; });

  const forged = { "X-Nexo-Internal-Auth": "v1.k1.1700000000.AAAAAAAAAAAAAAAAAAAAAA.forged", "X-Nexo-Client-Context": "forged" };

  it("nexoClient (tRPC → API) signs method, exact target and body; browser x-nexo-* never passes", async () => {
    const body = { email: "alice@org-a.test", password: "correct-horse" };
    const res = await realFetch(`${base}/api/trpc/auth.login`, { method: "POST", headers: { "content-type": "application/json", ...forged }, body: JSON.stringify({ json: body }) });
    expect(res.status).toBe(200);
    const call = upstream.find((c) => c.target === "/v1/auth/login")!;
    expect(call.headers.get("x-nexo-client-context")).toBeNull();
    expect(call.headers.get(INTERNAL_AUTH_HEADER)).not.toBe(forged["X-Nexo-Internal-Auth"]);
    expect(verify(call.headers.get(INTERNAL_AUTH_HEADER), "POST", "/v1/auth/login", call.body)).toBe("valid");
    // Session behaviour unchanged: HttpOnly cookie, no token in the body.
    expect(res.headers.getSetCookie().find((c) => c.startsWith("nexo_token="))).toMatch(/HttpOnly/i);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("context (/me session validation) and the SSE proxy are signed too", async () => {
    await realFetch(`${base}/api/notifications/stream`, { headers: { cookie: `nexo_token=${TOKEN}`, ...forged } });
    const me = upstream.find((c) => c.target === "/v1/me")!;
    expect(verify(me.headers.get(INTERNAL_AUTH_HEADER), "GET", "/v1/me")).toBe("valid");
    const stream = upstream.find((c) => c.target === "/v1/notifications/stream")!;
    expect(verify(stream.headers.get(INTERNAL_AUTH_HEADER), "GET", "/v1/notifications/stream")).toBe("valid");
    for (const call of upstream) expect(call.headers.get("x-nexo-client-context")).toBeNull();
  });

  it("the signature authenticates the BFF only: no client IP or identity header is added", async () => {
    await realFetch(`${base}/api/trpc/auth.login`, { method: "POST", headers: { "content-type": "application/json", "X-Forwarded-For": "6.6.6.6", "X-Real-IP": "6.6.6.6" }, body: JSON.stringify({ json: { email: "a@b.test", password: "whatever-1" } }) });
    const call = upstream.find((c) => c.target === "/v1/auth/login")!;
    for (const name of ["x-forwarded-for", "x-real-ip", "forwarded"]) expect(call.headers.get(name)).toBeNull();
    expect(call.headers.get(INTERNAL_AUTH_HEADER)).not.toContain("6.6.6.6");
  });

  it("a header signed by a different key does not verify", async () => {
    await realFetch(`${base}/api/trpc/auth.login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: { email: "a@b.test", password: "whatever-1" } }) });
    const call = upstream.find((c) => c.target === "/v1/auth/login")!;
    expect(verify(call.headers.get(INTERNAL_AUTH_HEADER), "POST", "/v1/auth/login", call.body, randomBytes(32))).toBe("bad_signature");
  });

  it("signing disabled (default): requests go out unsigned, exactly as before C7.2d", async () => {
    process.env.NEXO_INTERNAL_AUTH_SIGNING = "false";
    resetInternalAuthSignerForTests();
    try {
      await realFetch(`${base}/api/trpc/auth.login`, { method: "POST", headers: { "content-type": "application/json", ...forged }, body: JSON.stringify({ json: { email: "a@b.test", password: "whatever-1" } }) });
      const call = upstream.find((c) => c.target === "/v1/auth/login")!;
      expect(call.headers.get(INTERNAL_AUTH_HEADER)).toBeNull();
      expect(call.headers.get("x-nexo-client-context")).toBeNull();
    } finally {
      process.env.NEXO_INTERNAL_AUTH_SIGNING = "true";
      resetInternalAuthSignerForTests();
    }
  });

  it("an invalid signing configuration fails the BFF boot loudly", async () => {
    process.env.NEXO_INTERNAL_AUTH_SECRET = "short";
    resetInternalAuthSignerForTests();
    try {
      const { createBffApp } = await import("./_core/app");
      expect(() => createBffApp()).toThrow("NEXO_INTERNAL_AUTH_SECRET");
    } finally {
      process.env.NEXO_INTERNAL_AUTH_SECRET = KEY_B64;
      resetInternalAuthSignerForTests();
    }
  });
});
