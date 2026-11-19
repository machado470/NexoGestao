import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { serviceCatalogRouter } from "./service-catalog";
import { can } from "../../client/src/lib/rbac";
import { canVisitMobileRoute } from "../../client/src/lib/mobile-navigation";
const fetch = vi.mocked(nexoFetch),
  id = "11111111-1111-4111-8111-111111111111";
const values = {
  code: "VISITA",
  name: "Visita técnica",
  description: "Avaliação inicial",
  priceCents: 15000,
  durationMinutes: 60,
  expectedCurrency: "BRL",
};
const item = {
  id,
  code: values.code,
  name: values.name,
  description: values.description,
  priceCents: 15000,
  durationMinutes: 60,
  currency: "BRL",
  active: true,
  version: 0,
  createdAt: "2026-11-19T12:00:00Z",
  updatedAt: "2026-11-19T12:00:00Z",
};
const caller = (logged = true) =>
  serviceCatalogRouter.createCaller({
    user: logged ? { validated: true, token: "test", role: "MANAGER" } : null,
    req: { headers: {} },
    res: {},
  } as any);
beforeEach(() => fetch.mockReset());
describe("service catalog BFF", () => {
  it("validates paginated reads, prices and revision snapshots", async () => {
    fetch.mockResolvedValue({ items: [item], page: 1, pages: 1, total: 1 });
    expect(
      (
        await caller().list({
          page: 1,
          q: "visita & inspeção",
          state: "active",
        })
      ).items[0].priceCents
    ).toBe(15000);
    expect(fetch.mock.calls[0][1]).toBe(
      "/service-catalog?page=1&q=visita%20%26%20inspe%C3%A7%C3%A3o&state=active"
    );
    const { id: _, version, createdAt, updatedAt, ...snapshot } = item;
    fetch.mockResolvedValue({
      items: [
        {
          id,
          version,
          snapshot,
          reason: "Cadastro inicial do serviço",
          actorName: "Gestora",
          createdAt,
        },
      ],
      page: 1,
      pages: 1,
      total: 1,
    });
    expect(
      (await caller().history({ id, page: 1 })).items[0].snapshot.currency
    ).toBe("BRL");
    fetch.mockResolvedValue({ ...item, priceCents: 0 });
    expect(
      (await caller().create({ ...values, priceCents: 0, entryKey: id }))
        .priceCents
    ).toBe(0);
    fetch.mockResolvedValue({ ...item, priceCents: null });
    expect(
      (await caller().create({ ...values, priceCents: null, entryKey: id }))
        .priceCents
    ).toBeNull();
  });
  it("forwards versioned edits and rejects forged/coerced payloads before reaching API", async () => {
    const body = {
      ...values,
      id,
      expectedVersion: 0,
      active: false,
      reason: "Arquivamento por revisão do catálogo.",
    };
    fetch.mockResolvedValue({ ...item, active: false, version: 1 });
    expect((await caller().edit(body)).active).toBe(false);
    const { id: _, ...expected } = body;
    expect(fetch.mock.calls[0][1]).toBe("/service-catalog/" + id);
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string)).toEqual(
      expected
    );
    fetch.mockClear();
    for (const change of [
      { orgId: id },
      { actorName: "Fake" },
      { priceCents: "15000" },
      { priceCents: -1 },
      { durationMinutes: 0 },
      { active: "false" },
      { expectedVersion: "0" },
      { reason: " " },
    ])
      await expect(
        caller().edit({ ...body, ...change } as any)
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      caller(false).create({ ...values, entryKey: id })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("keeps the mobile route readable to all roles with management limited to leaders", () => {
    for (const role of ["ADMIN", "MANAGER", "STAFF", "VIEWER"] as const) {
      expect(canVisitMobileRoute(role, "/service-catalog")).toBe(true);
      expect(can(role, "catalog:manage")).toBe(
        role === "ADMIN" || role === "MANAGER"
      );
    }
  });
});
