import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from "../_core/nexoClient";
import { serviceOrdersRouter } from "./service-orders";
const fetch = vi.mocked(nexoFetch);
const order = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const caller = (role = "STAFF") =>
  serviceOrdersRouter.createCaller({
    user: { role, validated: true, token: "test" },
    req: { headers: {} },
    res: {},
  } as any);
const input = {
  serviceOrderId: order,
  entryKey: id,
  description: "Registro da execução",
  imageBase64: "/9j/2Q==",
  professionalConfirmed: true as const,
};
const photo = {
  id,
  description: input.description,
  uploadedByUserId: id,
  uploadedByName: "Profissional",
  createdAt: "2026-11-19T12:00:00Z",
};
beforeEach(() => fetch.mockReset());
describe("private order evidence BFF", () => {
  it("validates metadata and requests images only through authenticated paths", async () => {
    fetch.mockResolvedValue([photo]);
    expect(await caller().evidence({ serviceOrderId: order })).toEqual([photo]);
    expect(fetch.mock.calls[0][1]).toBe(`/service-orders/${order}/evidence`);
    fetch.mockResolvedValue({ imageBase64: "/9j/2Q==" });
    await caller().evidenceImage({ serviceOrderId: order, id });
    expect(fetch.mock.calls[1][1]).toBe(
      `/service-orders/${order}/evidence/${id}`
    );
    fetch.mockResolvedValue({ imageBase64: "<svg />" });
    await expect(
      caller().evidenceImage({ serviceOrderId: order, id })
    ).rejects.toThrow();
  });
  it("forwards only validated photo fields, preserving the retry key", async () => {
    fetch.mockResolvedValue(photo);
    await caller().addEvidence(input);
    expect(fetch.mock.calls[0][1]).toBe(`/service-orders/${order}/evidence`);
    const payload = JSON.parse(fetch.mock.calls[0][2]!.body as string);
    expect(payload.entryKey).toBe(id);
    expect(payload.serviceOrderId).toBeUndefined();
    await expect(
      caller().addEvidence({ ...input, orgId: id, uploadedByUserId: id } as any)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects missing confirmation, invalid content and oversized data before forwarding", async () => {
    for (const change of [
      { professionalConfirmed: false },
      { imageBase64: "<svg />" },
      { imageBase64: "A".repeat(87385) },
      { description: "   " },
    ])
      await expect(
        caller().addEvidence({ ...input, ...change } as any)
      ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires a validated session", async () => {
    const anonymous = serviceOrdersRouter.createCaller({
      user: null,
      req: { headers: {} },
    } as any);
    await expect(
      anonymous.evidence({ serviceOrderId: order })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
