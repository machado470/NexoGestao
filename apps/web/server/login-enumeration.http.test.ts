import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousApiUrl = vi.hoisted(() => {
  const previous = process.env.NEXO_API_URL;
  process.env.NEXO_API_URL = "http://nexo-api.c72b.test";
  return previous;
});

// C7.2b through the BFF: the API's uniform INVALID_CREDENTIALS / INVITE_INVALID answers reach the
// browser unchanged (same status, message and code for every unknown or wrong case), without a
// session cookie, and the messages the pages already map stay recognisable.
const API = "http://nexo-api.c72b.test";
const TOKEN = "jwt-c72b.header.signature";
const invalidCredentials = { success: false, message: "Credenciais inválidas", error: "Credenciais inválidas", code: "INVALID_CREDENTIALS", data: null };
const invalidInvite = { success: false, message: "Convite inválido ou expirado.", error: "Convite inválido ou expirado.", code: "INVITE_INVALID", data: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeApi(path: string, init: RequestInit = {}) {
  const body = init.body ? JSON.parse(String(init.body)) : {};
  if (path === "/v1/auth/login") {
    if (body.email === "alice@org-a.test" && body.password === "correct-horse") return json({ data: { token: TOKEN, user: { id: "user-a", orgId: "org-a" } } }, 201);
    return json(invalidCredentials, 401);
  }
  if (path === "/v1/auth/accept-invite") return json(invalidInvite, 401);
  return json({ message: "not found" }, 404);
}

describe("C7.2b: login and invite answers through the BFF", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
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
    if (previousApiUrl === undefined) delete process.env.NEXO_API_URL;
    else process.env.NEXO_API_URL = previousApiUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const mutation = (path: string, input: unknown) =>
    realFetch(`${base}/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: input }) });
  const comparable = async (res: Response) => {
    const error = (await res.json()).error.json;
    return { status: res.status, message: error.message, code: error.data.code, upstreamCode: error.data.upstreamCode, cookie: res.headers.getSetCookie().some((c) => c.startsWith("nexo_token=")) };
  };

  it("unknown e-mail and wrong password are indistinguishable at the browser", async () => {
    const unknown = await comparable(await mutation("auth.login", { email: "nobody@nowhere.test", password: "whatever-1" }));
    const wrong = await comparable(await mutation("auth.login", { email: "alice@org-a.test", password: "wrong-pass" }));
    expect(unknown).toEqual(wrong);
    expect(unknown).toEqual({ status: 401, message: "Credenciais inválidas", code: "UNAUTHORIZED", upstreamCode: "INVALID_CREDENTIALS", cookie: false });
    // Login.tsx maps "credenciais inválidas" to "Email ou senha inválidos.".
    expect(unknown.message.toLowerCase()).toContain("credenciais inválidas");
  });

  it("the correct password still establishes only the HttpOnly session cookie", async () => {
    const res = await mutation("auth.login", { email: "alice@org-a.test", password: "correct-horse" });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie().find((c) => c.startsWith("nexo_token="))).toMatch(/HttpOnly/i);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("invalid, expired or unknown invites share one answer (AcceptInvitePage maps 'inválido')", async () => {
    const a = await comparable(await mutation("auth.acceptInvite", { email: "nobody@nowhere.test", token: "t", name: "Ana Teste", password: "Password123!" }));
    const b = await comparable(await mutation("auth.acceptInvite", { email: "pending@org-a.test", token: "wrong", name: "Ana Teste", password: "Password123!" }));
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: 401, code: "UNAUTHORIZED", upstreamCode: "INVITE_INVALID", cookie: false });
    expect(a.message.toLowerCase()).toContain("inválido");
  });
});
