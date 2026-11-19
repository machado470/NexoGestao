import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { serviceOrdersRouter } from "./service-orders";
const fetch = vi.mocked(nexoFetch),
  order = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const caller = () =>
  serviceOrdersRouter.createCaller({
    user: { role: "STAFF", validated: true, token: "test" },
    req: { headers: {} },
    res: {},
  } as any);
const item = {
  id,
  title: "Testar funcionamento",
  completed: false,
  completedAt: null,
  completedByName: null,
  version: 0,
  createdAt: "2026-11-19T12:00:00Z",
};
beforeEach(() => fetch.mockReset());
describe("checklist BFF boundaries", () => {
  it("uses private scoped paths and validates metadata", async () => {
    fetch.mockResolvedValue([item]);
    expect(await caller().checklist({ serviceOrderId: order })).toEqual([item]);
    expect(fetch.mock.calls[0][1]).toBe(`/service-orders/${order}/checklist`);
    fetch.mockResolvedValue([{ ...item, version: -1 }]);
    await expect(
      caller().checklist({ serviceOrderId: order })
    ).rejects.toThrow();
  });
  it("forwards stable keys and versions without accepting identity fields", async () => {
    fetch.mockResolvedValue(item);
    await caller().createChecklistItem({
      serviceOrderId: order,
      entryKey: id,
      title: item.title,
    });
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string)).toEqual({
      entryKey: id,
      title: item.title,
    });
    await caller().changeChecklistItem({
      serviceOrderId: order,
      id,
      completed: false,
      expectedVersion: 2,
      reason: "Repetir teste",
    });
    expect(fetch.mock.calls[1][1]).toBe(
      `/service-orders/${order}/checklist/${id}/state`
    );
    await expect(
      caller().createChecklistItem({
        serviceOrderId: order,
        entryKey: id,
        title: item.title,
        orgId: id,
      } as any)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("requires undo reason and strict boolean/version values", async () => {
    for (const change of [
      { completed: false },
      { completed: "false" },
      { expectedVersion: -1 },
    ])
      await expect(
        caller().changeChecklistItem({
          serviceOrderId: order,
          id,
          completed: true,
          expectedVersion: 0,
          ...change,
        } as any)
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
