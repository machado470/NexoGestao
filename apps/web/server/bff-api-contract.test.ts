import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

function makeReq(token = "token-1", authHeader?: string) {
  return {
    headers: {
      cookie: `nexo_token=${token}`,
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    cookies: { nexo_token: token },
  } as any;
}

function makeRes() {
  return { cookie: vi.fn(), clearCookie: vi.fn() } as any;
}

describe("BFF↔API contract - lote 1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("session.me chama /me e normaliza dados essenciais", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { user: { id: "u1", orgId: "org-ctx", role: "ADMIN", email: "admin@nexo.dev" } } }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: null } as any);
    const result = await caller.session.me();

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/me$/), expect.objectContaining({ method: "GET" }));
    expect(result).toEqual(expect.objectContaining({ id: "u1", organizationId: "org-ctx", role: "ADMIN", email: "admin@nexo.dev" }));
  });

  it("nexo.me retorna UNAUTHORIZED sem sessão", async () => {
    const caller = appRouter.createCaller({ req: { headers: {}, cookies: {} }, res: makeRes(), user: null } as any);
    await expect(caller.nexo.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("nexo.me chama /me com bearer do usuário autenticado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq("cookie-token", "Bearer forged-token"), res: makeRes(), user: { token: "trusted-user-token", validated: true } } as any);
    await caller.nexo.me();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/me$/),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer trusted-user-token" }) }),
    );
  });

  it("nexo.settings.get e update usam /organization-settings e preservam payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "Oficina Antiga", timezone: "America/Sao_Paulo", currency: "BRL" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "Oficina Nova", timezone: "UTC", currency: "BRL" }), { status: 200 }));

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);

    const getResult = await caller.nexo.settings.get();
    const updateResult = await caller.nexo.settings.update({ name: "Oficina Nova", timezone: "UTC", orgId: "evil-org" });

    expect(getResult).toEqual({ name: "Oficina Antiga", timezone: "America/Sao_Paulo", currency: "BRL" });
    expect(updateResult).toEqual({ name: "Oficina Nova", timezone: "UTC", currency: "BRL" });

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/\/organization-settings$/), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer t1" }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/\/organization-settings$/), expect.objectContaining({ method: "PATCH" }));
    const [, patchOptions] = fetchMock.mock.calls[1];
    expect(JSON.parse(String((patchOptions as RequestInit).body))).toEqual({ name: "Oficina Nova", timezone: "UTC" });
  });

  it("analytics.assigneeWarningSummary usa endpoint tenant-scoped, valida ISO e rejeita orgId do client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ totals: { shown: 2, confirmed: 1, confirmationRatePct: 50 } }), { status: 200 }),
    );
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true, organizationId: "org-trusted" } } as any);

    await caller.analytics.assigneeWarningSummary({ from: "2026-05-01T00:00:00.000Z", to: "2026-05-30T00:00:00.000Z" });

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/analytics/assignee-warning-summary?from=2026-05-01T00%3A00%3A00.000Z&to=2026-05-30T00%3A00%3A00.000Z");
    expect(String(url)).not.toContain("orgId");
    await expect(caller.analytics.assigneeWarningSummary({ from: "not-iso" } as any)).rejects.toBeDefined();
    await expect(caller.analytics.assigneeWarningSummary({ from: "2026-05-30T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" })).rejects.toBeDefined();
    await expect(caller.analytics.assigneeWarningSummary({ orgId: "forged" } as any)).rejects.toBeDefined();
  });

  it("people.operationalSummary usa endpoint tenant-scoped sem aceitar orgId do client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ people: [] }), { status: 200 }),
    );
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true, organizationId: "org-trusted" } } as any);

    await caller.people.operationalSummary();

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/people\/operational-summary$/);
    expect((options as RequestInit).body).toBeUndefined();
    expect(String(url)).not.toContain("orgId");
  });

  it("people availability exceptions usam endpoints tenant-scoped e rejeitam orgId do client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "ex-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true, organizationId: "org-trusted" } } as any);
    await caller.people.listAvailabilityExceptions({ personId: "person-1" });
    await caller.people.createAvailabilityException({ personId: "person-1", startsAt: "2026-05-30T12:00:00.000Z", endsAt: "2026-05-30T14:00:00.000Z", reason: "Consulta" });
    await caller.people.deleteAvailabilityException({ personId: "person-1", exceptionId: "ex-1" });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([expect.stringMatching(/\/people\/person-1\/availability-exceptions$/), expect.stringMatching(/\/people\/person-1\/availability-exceptions\/ex-1$/)]));
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({ startsAt: "2026-05-30T12:00:00.000Z", endsAt: "2026-05-30T14:00:00.000Z", reason: "Consulta" });
    await expect(caller.people.createAvailabilityException({ personId: "person-1", startsAt: "2026-05-30T12:00:00.000Z", endsAt: "2026-05-30T14:00:00.000Z", orgId: "forged" } as any)).rejects.toBeDefined();
  });


  it("people.assignees usa endpoint operacional tenant-scoped do calendário", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [{ id: "p1", name: "Ana" }] }), { status: 200 }),
    );
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true, organizationId: "org-trusted" } } as any);

    const result = await caller.people.assignees();

    expect(result).toEqual([{ id: "p1", name: "Ana" }]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/people\/assignees$/);
    expect(String(url)).not.toContain("orgId");
    expect((options as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: "Bearer t1" }));
  });

  it("people.list e people.statsLinked usam endpoints corretos e não aceitam orgId do client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "p1" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { linked: 3, unlinked: 1 } }), { status: 200 }));

    const caller = appRouter.createCaller({ req: makeReq("cookie-token", "Bearer forged-token"), res: makeRes(), user: { token: "trusted-user-token", validated: true, organizationId: "org-trusted" } } as any);

    const list = await caller.people.list();
    const stats = await caller.people.statsLinked();

    expect(list).toEqual([{ id: "p1" }]);
    expect(stats).toEqual({ linked: 3, unlinked: 1 });

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calledUrls[0]).toMatch(/\/people$/);
    expect(calledUrls[1]).toMatch(/\/people\/stats\/linked$/);
    expect(calledUrls.join(" ")).not.toContain("orgId=");

    for (const [, options] of fetchMock.mock.calls) {
      expect((options as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: "Bearer trusted-user-token" }));
    }
  });


  it("finance.charges.list normaliza envelope simples data.items/meta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { items: [{ id: "ch-1" }], meta: { page: 1, limit: 20, total: 1, pages: 1 } } }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);
    const result = await caller.finance.charges.list({ page: 1, limit: 20 });

    expect(result).toEqual({ data: [{ id: "ch-1" }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  });

  it("finance.charges.list normaliza envelope duplo data.data.items/meta", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true, data: { items: [{ id: "ch-2" }], meta: { page: 1, limit: 20, total: 1, pages: 1 } } } }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);
    const result = await caller.finance.charges.list({ page: 1, limit: 20 });

    expect(result).toEqual({ data: [{ id: "ch-2" }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } });
  });

  it("finance.charges.list mantém falha clara para payload inválido", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true, data: { items: null, meta: null } } }), { status: 200 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);
    await expect(caller.finance.charges.list({ page: 1, limit: 20 })).rejects.toBeDefined();
  });

  it("propaga erro de autenticação da API como UNAUTHORIZED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "token expired", code: "AUTH_EXPIRED" }), { status: 401 }),
    );

    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);
    await expect(caller.nexo.settings.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("BFF↔API contract - pagamento manual", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("finance.charges.pay repassa paidAt e notes sem aceitar orgId do client", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { paymentId: "pay-1" } }), { status: 200 }),
    );
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true, organizationId: "org-trusted" } } as any);

    await caller.finance.charges.pay({
      chargeId: "ch-1",
      amountCents: 1000,
      method: "PIX",
      paidAt: "2026-01-15T12:00:00.000Z",
      notes: "Pago no caixa",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/finance\/charges\/ch-1\/pay$/);
    expect(JSON.parse(String((options as RequestInit).body))).toEqual({
      method: "PIX",
      amountCents: 1000,
      paidAt: "2026-01-15T12:00:00.000Z",
      notes: "Pago no caixa",
    });
    expect(String((options as RequestInit).body)).not.toContain("orgId");
  });

  it("finance.charges.pay rejeita paidAt inválido no BFF", async () => {
    const caller = appRouter.createCaller({ req: makeReq(), res: makeRes(), user: { token: "t1", validated: true } } as any);
    await expect(caller.finance.charges.pay({ chargeId: "ch-1", amountCents: 1000, method: "PIX", paidAt: "data-invalida" })).rejects.toBeDefined();
  });
});
