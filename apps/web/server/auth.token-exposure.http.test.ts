import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Regression for C4: the JWT must live only in the httpOnly `nexo_token` cookie. No BFF
// response may hand it to browser JavaScript (login, register, invite, OAuth callback, session).
const API = "http://nexo-api.c4.test";
const TOKENS = { a: "jwt-org-a.header.signature", b: "jwt-org-b.header.signature", invite: "jwt-invite.header.signature", registered: "jwt-registered.header.signature", expired: "jwt-expired.header.signature" };
const USERS: Record<string, { id: string; orgId: string; email: string; role: string }> = {
  [TOKENS.a]: { id: "user-a", orgId: "org-a", email: "alice@org-a.test", role: "ADMIN" },
  [TOKENS.b]: { id: "user-b", orgId: "org-b", email: "bob@org-b.test", role: "ADMIN" },
  [TOKENS.invite]: { id: "user-invite", orgId: "org-a", email: "carol@org-a.test", role: "STAFF" },
  [TOKENS.registered]: { id: "user-new", orgId: "org-new", email: "dave@org-new.test", role: "ADMIN" },
};
const ALL_TOKENS = Object.values(TOKENS);

type UpstreamCall = { path: string; authorization: string | null; orgHeader: string | null };
const upstream: UpstreamCall[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Fake NestJS API. It echoes tokens in every shape the BFF has to strip.
function fakeApi(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const authorization = headers.get("authorization");
  upstream.push({ path, authorization, orgHeader: headers.get("x-org-id") });
  const body = init.body ? JSON.parse(String(init.body)) : {};
  if (path === "/v1/auth/login") {
    const token = body.email === USERS[TOKENS.a].email ? TOKENS.a : body.email === USERS[TOKENS.b].email ? TOKENS.b : null;
    return token ? json({ data: { token, user: USERS[token] } }) : json({ message: "Credenciais inválidas" }, 401);
  }
  if (path === "/v1/auth/register") {
    if (body.email === "verify@org-new.test") return json({ data: { requiresEmailVerification: true, user: { email: body.email } } });
    return json({ data: { data: { token: TOKENS.registered, accessToken: TOKENS.registered, user: USERS[TOKENS.registered] } } });
  }
  if (path === "/v1/auth/accept-invite") return json({ token: TOKENS.invite, user: USERS[TOKENS.invite] });
  if (path === "/v1/me") {
    const token = authorization?.replace(/^Bearer /, "") ?? "";
    const user = USERS[token];
    return user ? json({ data: { user, token, organization: { id: user.orgId } } }) : json({ message: "Sessão expirada" }, 401);
  }
  return json({ message: "not found" }, 404);
}

describe("C4: JWT is never exposed to browser JavaScript", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;
  const previousEnv = { NEXO_API_URL: process.env.NEXO_API_URL, NODE_ENV: process.env.NODE_ENV };

  beforeAll(async () => {
    // nexoClient resolves NEXO_API_URL at import time, so the app is imported after setting it.
    process.env.NEXO_API_URL = API;
    const { createBffApp } = await import("./_core/app");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith(API)) return fakeApi(url.slice(API.length).split("?")[0], init);
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    upstream.length = 0;
    process.env.NODE_ENV = "production";
  });

  const mutation = (path: string, input: unknown, headers: Record<string, string> = {}) =>
    realFetch(`${base}/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ json: input }) });
  const query = (path: string, headers: Record<string, string> = {}) => realFetch(`${base}/api/trpc/${path}`, { headers });
  const session = (token: string) => ({ cookie: `nexo_token=${token}` });
  const sessionCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith("nexo_token="));
  const expectNoToken = (text: string) => {
    for (const token of ALL_TOKENS) expect(text).not.toContain(token);
    expect(text).not.toMatch(/"(token|accessToken|access_token)"\s*:/);
  };

  describe.each([["auth.login"], ["nexo.auth.login"]])("%s", (procedure) => {
    it("sets the session only as an httpOnly cookie and returns no token", async () => {
      const res = await mutation(procedure, { email: USERS[TOKENS.a].email, password: "correct-horse" }, { "x-forwarded-proto": "https" });
      const text = await res.text();
      expect(res.status).toBe(200);
      expectNoToken(text);
      expect(JSON.parse(text).result.data.json).toMatchObject({ sessionEstablished: true, data: { user: { id: "user-a", orgId: "org-a" } } });
      const cookie = sessionCookie(res) ?? "";
      expect(cookie).toContain(`nexo_token=${TOKENS.a}`);
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/;\s*SameSite=Lax/i);
      expect(cookie).toMatch(/;\s*Path=\//i);
    });

    it("rejects invalid credentials without setting a cookie or leaking a token", async () => {
      const res = await mutation(procedure, { email: "intruder@evil.test", password: "wrong-pass" });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(sessionCookie(res)).toBeUndefined();
      expectNoToken(await res.text());
    });
  });

  it("register returns sessionEstablished without the token (nested data.data and accessToken)", async () => {
    const res = await mutation("auth.register", { orgName: "Org New", adminName: "Dave", email: USERS[TOKENS.registered].email, password: "long-password" });
    const text = await res.text();
    expectNoToken(text);
    expect(JSON.parse(text).result.data.json).toMatchObject({ sessionEstablished: true, data: { data: { user: { id: "user-new" } } } });
    expect(sessionCookie(res)).toContain(`nexo_token=${TOKENS.registered}`);
  });

  it("register pending e-mail verification reports no session and sets no cookie", async () => {
    const res = await mutation("auth.register", { orgName: "Org New", adminName: "Dave", email: "verify@org-new.test", password: "long-password" });
    expect(JSON.parse(await res.text()).result.data.json).toMatchObject({ sessionEstablished: false, data: { requiresEmailVerification: true } });
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("acceptInvite sets the cookie and returns no token", async () => {
    const res = await mutation("auth.acceptInvite", { email: USERS[TOKENS.invite].email, token: "invite-code-123", name: "Carol", password: "long-password" });
    const text = await res.text();
    expectNoToken(text);
    expect(JSON.parse(text).result.data.json).toMatchObject({ sessionEstablished: true, user: { id: "user-invite" } });
    expect(sessionCookie(res)).toContain(`nexo_token=${TOKENS.invite}`);
  });

  it("establishSession (OAuth callback) does not echo the token back, even when /me includes it", async () => {
    const res = await mutation("auth.establishSession", { token: TOKENS.a });
    const text = await res.text();
    expectNoToken(text);
    expect(JSON.parse(text).result.data.json).toMatchObject({ success: true, validated: true, me: { data: { user: { id: "user-a" } } } });
    expect(sessionCookie(res)).toContain(`nexo_token=${TOKENS.a}`);
  });

  it("persistent session: session.me with the cookie returns the user without the token", async () => {
    const res = await query("session.me", session(TOKENS.a));
    const text = await res.text();
    expect(res.status).toBe(200);
    expectNoToken(text);
    expect(JSON.parse(text).result.data.json).toMatchObject({ id: "user-a", organizationId: "org-a", validated: true });
  });

  it("expired session: session.me returns null and protected procedures answer 401", async () => {
    const me = await query("session.me", session(TOKENS.expired));
    expect(JSON.parse(await me.text()).result.data.json).toBeNull();
    const protectedRes = await query("nexo.me", session(TOKENS.expired));
    expect(protectedRes.status).toBe(401);
    expectNoToken(await protectedRes.text());
  });

  it("no session: protected procedures answer 401", async () => {
    expect((await query("nexo.me")).status).toBe(401);
  });

  it("organization isolation: each cookie maps to its own organization and spoofed org headers are not forwarded", async () => {
    const meA = JSON.parse(await (await query("session.me", { ...session(TOKENS.a), "x-org-id": "org-b" })).text()).result.data.json;
    const meB = JSON.parse(await (await query("session.me", { ...session(TOKENS.b), "x-org-id": "org-a" })).text()).result.data.json;
    expect(meA).toMatchObject({ id: "user-a", organizationId: "org-a" });
    expect(meB).toMatchObject({ id: "user-b", organizationId: "org-b" });
    const meCalls = upstream.filter((call) => call.path === "/v1/me");
    expect(meCalls.map((call) => call.authorization)).toEqual(expect.arrayContaining([`Bearer ${TOKENS.a}`, `Bearer ${TOKENS.b}`]));
    expect(meCalls.every((call) => call.orgHeader === null)).toBe(true);
  });

  it("logout expires every session cookie with the same security attributes", async () => {
    const res = await mutation("session.logout", undefined, { ...session(TOKENS.a), "x-forwarded-proto": "https" });
    expect(res.status).toBe(200);
    const cleared = res.headers.getSetCookie();
    for (const name of ["nexo_token", "token", "auth_token"]) {
      const cookie = cleared.find((c) => c.startsWith(`${name}=;`)) ?? "";
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
      expect(cookie).toMatch(/;\s*HttpOnly/i);
    }
    expectNoToken(await res.text());
  });

  it.each([
    ["production behind the Railway HTTPS proxy", "production", { "x-forwarded-proto": "https" }, true],
    ["production with a proxy chain (first hop https)", "production", { "x-forwarded-proto": "https, http" }, true],
    ["local development over http", "development", {}, false],
  ])("cookie flags in %s", async (_label, nodeEnv, headers, secure) => {
    process.env.NODE_ENV = nodeEnv;
    const res = await mutation("auth.login", { email: USERS[TOKENS.b].email, password: "correct-horse" }, headers);
    const cookie = sessionCookie(res) ?? "";
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    if (secure) expect(cookie).toMatch(/;\s*Secure/i);
    else expect(cookie).not.toMatch(/;\s*Secure/i);
    expectNoToken(await res.text());
  });
});
