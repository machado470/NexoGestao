import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// nexoClient resolves NEXO_API_URL at import time: set it before any import is evaluated.
const previousApiUrl = vi.hoisted(() => {
  const previous = process.env.NEXO_API_URL;
  process.env.NEXO_API_URL = "http://nexo-api.c72a.test";
  return previous;
});

import { MAX_RETRY_AFTER_SECONDS, parseRetryAfterSeconds, temporaryFailureMessage } from "./_core/nexoClient";

// C7.2a: 429/503 from the API must reach the browser as TOO_MANY_REQUESTS / SERVICE_UNAVAILABLE,
// with a sanitized Retry-After and a clear message. Before, 503 became INTERNAL_SERVER_ERROR and
// Retry-After was dropped.
const API = "http://nexo-api.c72a.test";
const TOKEN = "jwt-c72a.header.signature";
const USER = { id: "user-a", orgId: "org-a", email: "alice@org-a.test", role: "ADMIN" };

type Scripted = { status: number; body?: unknown; rawBody?: string; headers?: Record<string, string> };
let script: Record<string, Scripted> = {};
const upstreamHeaders: Headers[] = [];

function fakeApi(path: string, init: RequestInit = {}) {
  upstreamHeaders.push(new Headers(init.headers));
  if (path === "/v1/me") {
    const auth = new Headers(init.headers).get("authorization");
    return auth === `Bearer ${TOKEN}`
      ? new Response(JSON.stringify({ data: { user: USER, organization: { id: USER.orgId } } }), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(JSON.stringify({ message: "Sessão expirada" }), { status: 401 });
  }
  const scripted = script[path];
  if (!scripted) return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  return new Response(scripted.rawBody ?? JSON.stringify(scripted.body ?? {}), {
    status: scripted.status,
    headers: { "content-type": scripted.rawBody ? "text/html" : "application/json", ...(scripted.headers ?? {}) },
  });
}

describe("C7.2a: Retry-After parsing", () => {
  it.each([
    ["5", 5], [" 30 ", 30], ["1", 1], ["3600", 3600], ["86400", MAX_RETRY_AFTER_SECONDS], ["99999", MAX_RETRY_AFTER_SECONDS],
  ])("accepts delta-seconds %j", (raw, expected) => expect(parseRetryAfterSeconds(raw)).toBe(expected));

  it.each([
    [null], [undefined], [""], ["0"], ["-5"], ["+5"], ["5.5"], ["1e3"], ["0x10"], ["5, 10"], ["123456"],
    ["Wed, 21 Oct 2026 07:28:00 GMT"], ["5\r\nSet-Cookie: nexo_token=evil"], ["5\nX-Injected: 1"], ["<script>alert(1)</script>"], [" "],
  ])("rejects %j", (raw) => expect(parseRetryAfterSeconds(raw as any)).toBeUndefined());
});

describe("C7.2a: user-facing messages", () => {
  const base = { message: "x", body: {}, code: null, retryAfterSeconds: undefined } as const;
  it("replaces generic throttler text and states the wait", () => {
    expect(temporaryFailureMessage({ ...base, status: 429, message: "ThrottlerException: Too Many Requests", retryAfterSeconds: 42 }))
      .toBe("Muitas tentativas em pouco tempo. Tente novamente em 42 segundos.");
    expect(temporaryFailureMessage({ ...base, status: 429, message: "ThrottlerException: Too Many Requests", retryAfterSeconds: 1 }))
      .toBe("Muitas tentativas em pouco tempo. Tente novamente em 1 segundo.");
    expect(temporaryFailureMessage({ ...base, status: 503, message: "x", code: "RATE_LIMIT_UNAVAILABLE", retryAfterSeconds: 90 }))
      .toBe("Serviço temporariamente indisponível. Tente novamente em 2 minutos.");
    expect(temporaryFailureMessage({ ...base, status: 503, message: "Service Unavailable" }))
      .toBe("Serviço temporariamente indisponível. Tente novamente em alguns instantes.");
  });

  it("keeps specific API messages (e.g. tenant queue limit, e-mail outage)", () => {
    const tenant = "Limite temporário de mensagens desta organização. Tente novamente em até um minuto.";
    expect(temporaryFailureMessage({ ...base, status: 429, message: tenant, code: "TENANT_QUEUE_ADMISSION_LIMIT", retryAfterSeconds: 60 })).toBe(tenant);
    const email = "Serviço de e-mail indisponível no momento. Tente novamente mais tarde.";
    expect(temporaryFailureMessage({ ...base, status: 503, message: email })).toBe(email);
  });

  it("never shows a non-JSON upstream body (proxy HTML pages)", () => {
    expect(temporaryFailureMessage({ ...base, status: 503, message: "<html>502 Bad Gateway</html>", body: "<html>502 Bad Gateway</html>" }))
      .toBe("Serviço temporariamente indisponível. Tente novamente em alguns instantes.");
  });
});

describe("C7.2a: 429/503 through the BFF tRPC transport", () => {
  let server: Server;
  let base: string;
  const realFetch = globalThis.fetch;
  const previousEnv = { NEXO_API_URL: previousApiUrl, NODE_ENV: process.env.NODE_ENV };

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
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    script = {};
    upstreamHeaders.length = 0;
    process.env.NODE_ENV = "production";
  });

  const mutation = (path: string, input: unknown, headers: Record<string, string> = {}) =>
    realFetch(`${base}/api/trpc/${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ json: input }) });
  const login = () => mutation("auth.login", { email: USER.email, password: "correct-horse" });
  const pay = (idempotencyKey = "idem-key-123456") =>
    mutation("finance.charges.pay", { chargeId: "charge-1", method: "PIX", amountCents: 1000, idempotencyKey }, { cookie: `nexo_token=${TOKEN}` });
  const errorOf = async (res: Response) => (await res.json()).error.json;

  it("429 with Retry-After: TOO_MANY_REQUESTS, header relayed, clear message", async () => {
    script["/v1/auth/login"] = { status: 429, body: { message: "ThrottlerException: Too Many Requests", code: "RATE_LIMITED" }, headers: { "Retry-After": "37" } };
    const res = await login();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("37");
    const error = await errorOf(res);
    expect(error.data).toMatchObject({ code: "TOO_MANY_REQUESTS", httpStatus: 429, retryAfterSeconds: 37, upstreamCode: "RATE_LIMITED" });
    expect(error.message).toBe("Muitas tentativas em pouco tempo. Tente novamente em 37 segundos.");
    expect(res.headers.getSetCookie().some((c) => c.startsWith("nexo_token="))).toBe(false);
  });

  it("503 with Retry-After: SERVICE_UNAVAILABLE (no longer INTERNAL_SERVER_ERROR)", async () => {
    script["/v1/auth/login"] = {
      status: 503,
      body: { message: "Proteção contra abuso temporariamente indisponível. Tente novamente em alguns segundos.", code: "RATE_LIMIT_UNAVAILABLE" },
      headers: { "Retry-After": "5" },
    };
    const res = await login();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("5");
    const error = await errorOf(res);
    expect(error.data).toMatchObject({ code: "SERVICE_UNAVAILABLE", httpStatus: 503, retryAfterSeconds: 5, upstreamCode: "RATE_LIMIT_UNAVAILABLE" });
    expect(error.message).toBe("Serviço temporariamente indisponível. Tente novamente em 5 segundos.");
  });

  it("503 without Retry-After: SERVICE_UNAVAILABLE without a header or a wait", async () => {
    script["/v1/auth/forgot-password"] = { status: 503, body: { message: "Serviço de e-mail indisponível no momento. Tente novamente mais tarde.", code: "SERVICE_UNAVAILABLE" } };
    const res = await mutation("auth.forgotPassword", { email: USER.email });
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBeNull();
    const error = await errorOf(res);
    expect(error.data.code).toBe("SERVICE_UNAVAILABLE");
    expect(error.data.retryAfterSeconds).toBeUndefined();
  });

  it.each([
    ["CRLF header injection", "5\r\nSet-Cookie: nexo_token=evil"],
    ["HTTP-date", "Wed, 21 Oct 2026 07:28:00 GMT"],
    ["negative", "-1"],
    ["script", "<script>alert(1)</script>"],
  ])("drops a malicious/invalid upstream Retry-After (%s)", async (_label, value) => {
    script["/v1/auth/login"] = { status: 429, body: { message: "ThrottlerException: Too Many Requests" }, headers: { "Retry-After": value.replace(/[\r\n]/g, " ") } };
    const res = await login();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeNull();
    expect(res.headers.getSetCookie().some((c) => c.includes("evil"))).toBe(false);
    const error = await errorOf(res);
    expect(error.data.retryAfterSeconds).toBeUndefined();
    expect(error.message).toBe("Muitas tentativas em pouco tempo. Tente novamente em alguns instantes.");
  });

  it("clamps an excessive Retry-After and ignores unsafe upstream codes", async () => {
    script["/v1/auth/login"] = { status: 429, body: { message: "ThrottlerException: Too Many Requests", code: "<img src=x>" }, headers: { "Retry-After": "86400" } };
    const res = await login();
    expect(res.headers.get("retry-after")).toBe(String(MAX_RETRY_AFTER_SECONDS));
    const error = await errorOf(res);
    expect(error.data.upstreamCode).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain("<img");
  });

  it("a non-JSON 503 (proxy page) never reaches the user", async () => {
    script["/v1/auth/login"] = { status: 503, rawBody: "<html><body>upstream connect error internal-host:3000</body></html>" };
    const res = await login();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(text).not.toContain("internal-host");
    expect(JSON.parse(text).error.json.message).toBe("Serviço temporariamente indisponível. Tente novamente em alguns instantes.");
  });

  it("does not expose the upstream body, stack or cause", async () => {
    script["/v1/auth/login"] = { status: 503, body: { message: "Service Unavailable", code: "SERVICE_UNAVAILABLE", stack: "at secret (/srv/app.js)", internal: "db-password" }, headers: { "Retry-After": "5" } };
    const text = await (await login()).text();
    expect(text).not.toMatch(/db-password|\/srv\/app\.js|"stack"|"cause"/);
  });

  describe("existing flows are preserved", () => {
    it("invalid credentials stay UNAUTHORIZED with the API message and no cookie", async () => {
      script["/v1/auth/login"] = { status: 401, body: { message: "Senha inválida", code: null } };
      const res = await login();
      expect(res.status).toBe(401);
      const error = await errorOf(res);
      expect(error.data.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Senha inválida");
      expect(error.data.retryAfterSeconds).toBeUndefined();
      expect(res.headers.getSetCookie().some((c) => c.startsWith("nexo_token="))).toBe(false);
    });

    it("coded API errors no longer get a [CODE] suffix; the code is exposed as upstreamCode", async () => {
      script["/v1/auth/login"] = { status: 401, body: { message: "E-mail ainda não verificado. Confirme seu e-mail para concluir o login.", code: "EMAIL_NOT_VERIFIED" } };
      const error = await errorOf(await login());
      expect(error.message).toBe("E-mail ainda não verificado. Confirme seu e-mail para concluir o login.");
      expect(error.data.upstreamCode).toBe("EMAIL_NOT_VERIFIED");
    });

    it("successful login still sets only the HttpOnly session cookie", async () => {
      script["/v1/auth/login"] = { status: 201, body: { data: { token: TOKEN, user: USER } } };
      const res = await login();
      expect(res.status).toBe(200);
      expect(res.headers.get("retry-after")).toBeNull();
      const cookie = res.headers.getSetCookie().find((c) => c.startsWith("nexo_token=")) ?? "";
      expect(cookie).toMatch(/HttpOnly/i);
      expect(await res.text()).not.toContain(TOKEN);
    });

    it("payment 429 keeps TOO_MANY_REQUESTS (FinancesPage shows it as rejected) and the idempotency key is still sent", async () => {
      script["/v1/finance/charges/charge-1/pay"] = { status: 429, body: { message: "ThrottlerException: Too Many Requests", code: "RATE_LIMITED" }, headers: { "Retry-After": "48" } };
      const res = await pay("idem-key-abcdef");
      expect(res.status).toBe(429);
      const error = await errorOf(res);
      expect(error.data).toMatchObject({ code: "TOO_MANY_REQUESTS", retryAfterSeconds: 48 });
      expect(error.message).toBe("Muitas tentativas em pouco tempo. Tente novamente em 48 segundos.");
      const payCall = upstreamHeaders.find((h) => h.get("idempotency-key"));
      expect(payCall?.get("idempotency-key")).toBe("idem-key-abcdef");
    });

    it("payment 503 (fail-closed throttler) is SERVICE_UNAVAILABLE, not a generic 500", async () => {
      script["/v1/finance/charges/charge-1/pay"] = { status: 503, body: { message: "x", code: "RATE_LIMIT_UNAVAILABLE" }, headers: { "Retry-After": "5" } };
      const res = await pay();
      expect(res.status).toBe(503);
      expect((await errorOf(res)).data).toMatchObject({ code: "SERVICE_UNAVAILABLE", retryAfterSeconds: 5 });
    });

    it("payment conflicts (409) are unchanged", async () => {
      script["/v1/finance/charges/charge-1/pay"] = { status: 409, body: { message: "Cobrança alterada por outra ação", code: "CHARGE_CONCURRENT_MODIFICATION" } };
      const error = await errorOf(await pay());
      expect(error.data).toMatchObject({ code: "CONFLICT", httpStatus: 409, upstreamCode: "CHARGE_CONCURRENT_MODIFICATION" });
      expect(error.message).toBe("Cobrança alterada por outra ação");
    });

    it("permission (403) and not found (404) errors keep their codes and messages", async () => {
      script["/v1/finance/charges/charge-1/pay"] = { status: 403, body: { message: "Acesso negado.", code: null } };
      const forbidden = await pay();
      expect(forbidden.status).toBe(403);
      expect(await errorOf(forbidden)).toMatchObject({ message: "Acesso negado.", data: { code: "FORBIDDEN" } });
      script["/v1/finance/charges/charge-1/pay"] = { status: 404, body: { message: "Charge não encontrada" } };
      const missing = await pay();
      expect(missing.status).toBe(404);
      expect(await errorOf(missing)).toMatchObject({ message: "Charge não encontrada", data: { code: "NOT_FOUND" } });
      expect(missing.headers.get("retry-after")).toBeNull();
    });

    it("an unexpected API 500 reaches the browser only as the generic text", async () => {
      script["/v1/auth/login"] = { status: 500, body: { message: "Internal server error", code: "INTERNAL_ERROR" } };
      const res = await login();
      expect(res.status).toBe(500);
      expect(await errorOf(res)).toMatchObject({ message: "Internal server error", data: { code: "INTERNAL_SERVER_ERROR", upstreamCode: "INTERNAL_ERROR" } });
    });

    it("other 5xx stay INTERNAL_SERVER_ERROR", async () => {
      script["/v1/auth/login"] = { status: 502, body: { message: "Bad gateway" } };
      const res = await login();
      expect(res.status).toBe(500);
      expect((await errorOf(res)).data.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
