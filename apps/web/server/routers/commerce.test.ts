import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { commerceRouter } from "./commerce";
import { can, type Role } from "../../client/src/lib/rbac";
import { canVisitMobileRoute } from "../../client/src/lib/mobile-navigation";
const fetch = vi.mocked(nexoFetch);
const context = (role: Role) =>
  ({
    user: { token: "local-audit-token", validated: true, role },
    req: { headers: {}, cookies: {} },
    res: {},
  }) as any;
const product = {
  id: "p1",
  sku: "FILTRO",
  name: "Filtro",
  barcode: null,
  variant: null,
  minQuantity: 0,
  onHand: 0,
  costCents: 0,
  saleCents: 0,
  currency: "BRL",
  createdAt: "2026-11-19T12:00:00Z",
};
beforeEach(() => fetch.mockReset());
describe("commerce boundary and permissions", () => {
  it.each(["ADMIN", "MANAGER", "STAFF", "VIEWER"] as Role[])(
    "keeps the three sections aligned with API ADMIN access (%s)",
    async role => {
      for (const [path, permission] of [
        ["/inventory", "inventory:manage"],
        ["/fiscal", "fiscal:manage"],
        ["/financial-health", "financial-health:read"],
      ] as const) {
        expect(can(role, permission)).toBe(role === "ADMIN");
        expect(canVisitMobileRoute(role, path)).toBe(role === "ADMIN");
      }
      if (role !== "ADMIN") {
        await expect(
          commerceRouter
            .createCaller(context(role))
            .products({ page: 1, q: "" })
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(fetch).not.toHaveBeenCalled();
      }
    }
  );
  it("validates products returned by the service and encodes searches", async () => {
    fetch.mockResolvedValue({ items: [product], total: 1, page: 1, pages: 1 });
    const caller = commerceRouter.createCaller(context("ADMIN"));
    expect(
      (await caller.products({ page: 1, q: "SKU & peças" })).items[0].sku
    ).toBe("FILTRO");
    expect(fetch.mock.calls[0][1]).toBe(
      "/commerce/products?page=1&q=SKU%20%26%20pe%C3%A7as"
    );
    fetch.mockResolvedValue({
      items: [{ id: "invalid" }],
      total: 1,
      page: 1,
      pages: 1,
    });
    await expect(caller.products({ page: 1, q: "" })).rejects.toThrow();
  });
  it("strips client organization/actor and never forwards unsafe money or movement quantities", async () => {
    const caller = commerceRouter.createCaller(context("ADMIN"));
    fetch.mockResolvedValue(product);
    await caller.createProduct({
      sku: "FILTRO",
      name: "Filtro",
      minQuantity: 0,
      costCents: 0,
      saleCents: 0,
      expectedCurrency: "BRL",
      orgId: "forged",
      actorUserId: "forged",
    } as any);
    const body = JSON.parse(fetch.mock.calls[0][2]!.body as string);
    expect(body.orgId).toBeUndefined();
    expect(body.actorUserId).toBeUndefined();
    fetch.mockReset();
    await expect(
      caller.move({
        productId: "p1",
        quantity: 1.5,
        direction: "OUT",
        reason: "Saída",
        entryKey: "stable-key",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.recordExpense({
        title: "Teste",
        amountCents: NaN,
        occurredAt: "2026-11-19T12:00:00Z",
        expectedCurrency: "BRL",
        entryKey: "stable-key",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.health({ month: "2026-13" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not accept an issued fiscal document as a preparation response", async () => {
    fetch.mockResolvedValue({ emissionAvailable: true, items: [] });
    await expect(
      commerceRouter.createCaller(context("ADMIN")).fiscalDrafts()
    ).rejects.toThrow();
  });
});
