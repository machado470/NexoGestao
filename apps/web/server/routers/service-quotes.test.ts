import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({
  nexoFetch: vi.fn(),
  nexoPublicFetch: vi.fn(),
}));
import { nexoFetch, nexoPublicFetch } from "../_core/nexoClient";
import { serviceQuotesRouter } from "./service-quotes";
import { canVisitMobileRoute } from "../../client/src/lib/mobile-navigation";
const fetch = vi.mocked(nexoFetch),
  publicFetch = vi.mocked(nexoPublicFetch),
  id = "11111111-1111-4111-8111-111111111111",
  token = "a".repeat(64);
const values = {
  title: "Visita técnica",
  conditions: "Atendimento em horário comercial, pagamento após serviço.",
  expectedCurrency: "BRL",
  items: [{ serviceId: id, serviceVersion: 0, quantity: 2, unitCents: 15000 }],
};
const snapshot = {
  title: values.title,
  conditions: values.conditions,
  currency: "BRL",
  totalCents: 30000,
  items: [
    {
      ...values.items[0],
      code: "VISITA",
      name: "Visita técnica",
      description: "Avaliar equipamento",
      durationMinutes: 60,
      lineCents: 30000,
    },
  ],
};
const record = {
  id,
  customerId: id,
  customerName: "Cliente",
  version: 0,
  status: "DRAFT",
  snapshot,
  createdAt: "2026-11-19T12:00:00Z",
  updatedAt: "2026-11-19T12:00:00Z",
};
const caller = (logged = true) =>
  serviceQuotesRouter.createCaller({
    user: logged ? { validated: true, token: "test", role: "MANAGER" } : null,
    req: { headers: {} },
    res: { setHeader: vi.fn() },
  } as any);
beforeEach(() => {
  fetch.mockReset();
  publicFetch.mockReset();
});
describe("service quotes BFF", () => {
  it("preserves line versions and validates paginated records/revisions", async () => {
    fetch.mockResolvedValue(record);
    expect(
      (await caller().create({ ...values, customerId: id, entryKey: id }))
        .snapshot.totalCents
    ).toBe(30000);
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string).items).toEqual(
      values.items
    );
    fetch.mockResolvedValue({
      quote: record,
      revisions: [
        {
          version: 0,
          snapshot,
          reason: "Orçamento inicial registrado",
          actorName: "Gestora",
          createdAt: record.createdAt,
        },
      ],
      approvals: [],
      page: 1,
      pages: 1,
    });
    expect(
      (await caller().detail({ id, page: 1 })).revisions[0].snapshot.items[0]
        .serviceVersion
    ).toBe(0);
    expect(fetch.mock.calls[1][1]).toBe("/service-quotes/" + id + "?page=1");
    fetch.mockResolvedValue({ ...record, version: 1 });
    await caller().revise({
      ...values,
      id,
      expectedVersion: 0,
      reason: "Condições revisadas com o cliente.",
    });
    expect(fetch.mock.calls[2][1]).toBe("/service-quotes/" + id + "/revise");
  });
  it("rejects forged totals/tenants, unsafe versions and malformed line amounts before transport", async () => {
    const input = { ...values, customerId: id, entryKey: id };
    for (const change of [
      { orgId: id },
      { totalCents: 1 },
      { status: "ACCEPTED" },
      { items: [{ ...values.items[0], unitCents: "15000" }] },
      { items: [{ ...values.items[0], quantity: 0 }] },
      { items: [{ ...values.items[0], serviceVersion: "0" }] },
      { items: [] },
    ])
      await expect(
        caller().create({ ...input, ...change } as any)
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await expect(caller(false).list({ page: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("keeps bearer tokens in POST bodies and requires explicit confirmation for public decisions", async () => {
    const publicRecord = {
      companyName: "Empresa",
      version: 0,
      title: snapshot.title,
      conditions: snapshot.conditions,
      currency: "BRL",
      totalCents: 30000,
      items: snapshot.items.map(
        ({
          name,
          description,
          quantity,
          unitCents,
          lineCents,
          durationMinutes,
        }) => ({
          name,
          description,
          quantity,
          unitCents,
          lineCents,
          durationMinutes,
        })
      ),
      expiresAt: "2026-11-22T12:00:00Z",
      decision: null,
      respondedAt: null,
    };
    publicFetch.mockResolvedValue(publicRecord);
    expect((await caller(false).view({ token })).items[0].quantity).toBe(2);
    expect(publicFetch.mock.calls[0][1]).toBe("/quote-approval/view");
    expect(JSON.parse(publicFetch.mock.calls[0][2]!.body as string)).toEqual({
      token,
    });
    const answer = {
      token,
      responseKey: id,
      decision: "ACCEPTED" as const,
      respondentName: "Cliente",
      confirmed: true as const,
    };
    publicFetch.mockResolvedValue({
      ...publicRecord,
      decision: "ACCEPTED",
      respondedAt: record.createdAt,
    });
    expect((await caller(false).respond(answer)).decision).toBe("ACCEPTED");
    publicFetch.mockClear();
    for (const change of [
      { confirmed: "true" },
      { confirmed: false },
      { orgId: id },
      { decision: "PAID" },
      { decision: "REJECTED", responseNote: "curto" },
    ])
      await expect(
        caller(false).respond({ ...answer, ...change } as any)
      ).rejects.toThrow();
    expect(publicFetch).not.toHaveBeenCalled();
  });
  it("makes the mobile quotes route readable under existing catalog permissions", () => {
    for (const role of ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const)
      expect(canVisitMobileRoute(role, "/quotes")).toBe(true);
  });
});
