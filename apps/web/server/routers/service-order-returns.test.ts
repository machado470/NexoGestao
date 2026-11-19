import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { serviceOrdersRouter } from "./service-orders";
const fetch = vi.mocked(nexoFetch),
  orderId = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const caller = (authenticated = true) =>
  serviceOrdersRouter.createCaller({
    user: authenticated
      ? { role: "STAFF", validated: true, token: "test" }
      : null,
    req: { headers: {} },
    res: {},
  } as any);
const record = {
  id,
  kind: "WARRANTY",
  title: "Avaliar equipamento",
  reason: "Equipamento precisa de nova avaliação.",
  originalTitle: "Original",
  sourceAcceptanceId: null,
  createdByName: "Profissional",
  createdAt: "2026-11-19T12:00:00Z",
  child: { id, title: "Avaliar equipamento", status: "OPEN" },
  original: { id: orderId, title: "Original", status: "DONE" },
};
beforeEach(() => fetch.mockReset());
describe("service returns BFF", () => {
  it("validates paginated history and scoped paths", async () => {
    fetch.mockResolvedValue({
      items: [record],
      origin: null,
      issues: [],
      page: 1,
      pages: 1,
      total: 1,
    });
    expect(
      (await caller().returns({ serviceOrderId: orderId, page: 1 })).items[0]
        .child.id
    ).toBe(id);
    expect(fetch.mock.calls[0][1]).toBe(
      `/service-orders/${orderId}/returns?page=1`
    );
    await expect(
      caller(false).returns({ serviceOrderId: orderId, page: 1 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller().returns({ serviceOrderId: orderId, page: 0 })
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves the attempt key and refuses forged company/customer/billing inputs", async () => {
    const body = {
      serviceOrderId: orderId,
      entryKey: id,
      kind: "WARRANTY" as const,
      title: record.title,
      reason: record.reason,
    };
    fetch.mockResolvedValue(record);
    await caller().createReturn(body);
    expect(fetch.mock.calls[0][1]).toBe(`/service-orders/${orderId}/returns`);
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string)).toEqual({
      entryKey: id,
      kind: "WARRANTY",
      title: record.title,
      reason: record.reason,
    });
    for (const change of [
      { orgId: id },
      { customerId: id },
      { amountCents: 999 },
      { createdByUserId: id },
      { reason: " " },
      { kind: "FREE" },
    ])
      await expect(
        caller().createReturn({ ...body, ...change } as any)
      ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed output instead of showing a fabricated return", async () => {
    fetch.mockResolvedValue({
      items: [{ id }],
      origin: null,
      issues: [],
      page: 1,
      pages: 1,
      total: 1,
    });
    await expect(
      caller().returns({ serviceOrderId: orderId, page: 1 })
    ).rejects.toThrow();
  });
});
