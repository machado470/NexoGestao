import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

function makeReq(token = "token-1") {
  return {
    headers: { cookie: `nexo_token=${token}` },
    cookies: { nexo_token: token },
  } as any;
}

function makeRes() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any;
}

function makeAuthedCaller() {
  return appRouter.createCaller({
    req: makeReq(),
    res: makeRes(),
    user: { id: "u1", organizationId: "org-server", token: "token-1", validated: true },
  } as any);
}

describe("BFF↔API contract: critical frontend consumers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("session.me -> chama /me e mantém envelope da API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: "u1" }, token: "token-1" }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: null } as any);
    const result = await caller.session.me();

    expect(result).toEqual(expect.objectContaining({ id: "u1", token: "token-1", validated: true }));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/me"), expect.any(Object));
  });

  it("nexo.me -> sem sessão válida retorna UNAUTHORIZED previsível", async () => {
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: null } as any);
    await expect(caller.nexo.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("nexo.me -> com sessão válida chama /me e retorna payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u1", organizationId: "org-server" }), { status: 200 }),
    );

    const result = await makeAuthedCaller().nexo.me();

    expect(result).toEqual({ id: "u1", organizationId: "org-server" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/me"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-1" }) }),
    );
  });

  it("nexo.me -> normaliza payload operacional envelopado para o perfil", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: {
          success: true,
          data: {
            user: { id: "u1", email: "paula@nexo.dev", role: "ADMIN", personId: "p1", person: { id: "p1", name: "Paula Almeida", active: true } },
            organization: { id: "org-1", name: "Oficina" },
            operational: { state: "NORMAL" },
            assignments: [],
          },
        },
      }), { status: 200 }),
    );

    const result = await makeAuthedCaller().nexo.me();

    expect(result).toEqual(expect.objectContaining({
      id: "u1",
      personId: "p1",
      name: "Paula Almeida",
      role: "ADMIN",
      organization: { id: "org-1", name: "Oficina" },
      operational: { state: "NORMAL" },
    }));
  });

  it("settings.get -> chama endpoint correto e propaga formato", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ timezone: "America/Sao_Paulo", currency: "BRL" }), { status: 200 }),
    );

    const result = await makeAuthedCaller().nexo.settings.get();

    expect(result).toEqual({ timezone: "America/Sao_Paulo", currency: "BRL" });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/organization-settings"), expect.any(Object));
  });

  it("settings.update -> ignora orgId arbitrário do client", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await makeAuthedCaller().nexo.settings.update({ name: "Nexo Oficina", timezone: "UTC", orgId: "org-forged" });

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({ name: "Nexo Oficina", timezone: "UTC" });
    expect(body.orgId).toBeUndefined();
  });

  it("audit.listEvents -> chama endpoint administrativo tenant-scoped e normaliza envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { data: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 } } }), { status: 200 }),
    );

    const result = await makeAuthedCaller().nexo.audit.listEvents({ page: 1, limit: 25, orgId: "forged" } as any);

    expect(result).toEqual({ data: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 } });
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/audit/events?page=1&limit=25"), expect.any(Object));
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).not.toContain("orgId");
  });

  it("people.list e people.statsLinked -> normalizam envelopes compatíveis com frontend", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: [{ id: "p1", name: "Ana" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { linked: 4, unlinked: 1 } }), { status: 200 }));

    const caller = makeAuthedCaller();
    const people = await caller.people.list();
    const stats = await caller.people.statsLinked();

    expect(people).toEqual([{ id: "p1", name: "Ana" }]);
    expect(stats).toEqual({ linked: 4, unlinked: 1 });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/people"), expect.any(Object));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/people/stats/linked"), expect.any(Object));
  });

  it("people.list -> 401 upstream é tratado como UNAUTHORIZED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 }),
    );

    await expect(makeAuthedCaller().people.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
