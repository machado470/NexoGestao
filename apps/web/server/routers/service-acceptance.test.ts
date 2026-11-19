import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../_core/nexoClient", () => ({
  nexoFetch: vi.fn(),
  nexoPublicFetch: vi.fn(),
}));
import { nexoFetch, nexoPublicFetch } from "../_core/nexoClient";
import { serviceAcceptanceRouter } from "./service-acceptance";
const fetch = vi.mocked(nexoFetch),
  publicFetch = vi.mocked(nexoPublicFetch);
const id = "11111111-1111-4111-8111-111111111111",
  token = "a".repeat(64);
const headers = vi.fn();
const context = (authenticated = false) =>
  ({
    req: { headers: {} },
    res: { setHeader: headers },
    user: authenticated
      ? { token: "session", role: "STAFF", validated: true }
      : null,
  }) as any;
const receipt = {
  companyName: "Empresa",
  publicTitle: "Serviço entregue",
  publicSummary: "Descrição revisada do serviço.",
  expiresAt: "2026-11-22T12:00:00Z",
  decision: null,
  respondedAt: null,
};
beforeEach(() => {
  fetch.mockReset();
  publicFetch.mockReset();
  headers.mockReset();
});
describe("customer acceptance BFF", () => {
  it("reads anonymously by POST with a body token and no-store response", async () => {
    publicFetch.mockResolvedValue({
      success: true,
      data: {
        ...receipt,
        orgId: id,
        tokenHash: "hidden",
        customer: { phone: "private" },
      },
    });
    const data = await serviceAcceptanceRouter
      .createCaller(context())
      .view({ token });
    expect(data).toEqual(receipt);
    expect(publicFetch.mock.calls[0][1]).toBe("/service-acceptance/view");
    expect(publicFetch.mock.calls[0][2]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ token }),
    });
    expect(headers).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  it("validates response and refuses forged identity/organization or missing confirmation", async () => {
    const caller = serviceAcceptanceRouter.createCaller(context());
    const body = {
      token,
      responseKey: id,
      decision: "ACCEPTED" as const,
      respondentName: "Cliente",
      confirmed: true as const,
    };
    publicFetch.mockResolvedValue({
      ...receipt,
      decision: "ACCEPTED",
      respondedAt: "2026-11-19T12:00:00Z",
    });
    await caller.respond(body);
    expect(publicFetch.mock.calls[0][1]).toBe("/service-acceptance/respond");
    for (const changed of [
      { confirmed: false },
      { confirmed: "false" },
      { orgId: id },
      { decision: "ISSUE", responseNote: "curto" },
      { respondentName: " " },
    ])
      await expect(
        caller.respond({ ...body, ...changed } as any)
      ).rejects.toThrow();
    expect(publicFetch).toHaveBeenCalledTimes(1);
  });
  it("protects internal creation/history and keeps stable keys", async () => {
    const body = {
      serviceOrderId: id,
      entryKey: id,
      publicTitle: receipt.publicTitle,
      publicSummary: receipt.publicSummary,
    };
    await expect(
      serviceAcceptanceRouter.createCaller(context()).create(body)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    fetch.mockResolvedValue({ id, token, expiresAt: receipt.expiresAt });
    await serviceAcceptanceRouter.createCaller(context(true)).create(body);
    expect(fetch.mock.calls[0][1]).toBe(`/service-orders/${id}/acceptances`);
    expect(JSON.parse(fetch.mock.calls[0][2]!.body as string)).toEqual({
      entryKey: id,
      publicTitle: receipt.publicTitle,
      publicSummary: receipt.publicSummary,
    });
    await expect(
      serviceAcceptanceRouter
        .createCaller(context(true))
        .create({ ...body, createdByUserId: id } as any)
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid link tokens before any request", async () => {
    for (const invalid of ["invalid", "x".repeat(64), "a".repeat(65)])
      await expect(
        serviceAcceptanceRouter.createCaller(context()).view({ token: invalid })
      ).rejects.toThrow();
    expect(publicFetch).not.toHaveBeenCalled();
  });
});
