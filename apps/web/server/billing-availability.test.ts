import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
const context = { req: { headers: { cookie: "nexo_token=trusted" }, cookies: { nexo_token: "trusted" } }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user: { token: "trusted", validated: true, organizationId: "20000000-0000-4000-8000-000000000001" } } as any;
afterEach(() => vi.restoreAllMocks());
describe("billing availability boundary", () => {
  it.each(["disabled", "unavailable", "simulation", "available"])("accepts the API's %s capability", async status => {
    const payload = { status, checkoutPlans: status === "available" ? ["PRO"] : [], cancellationAvailable: false };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: payload }), { status: 200 }));
    await expect(appRouter.createCaller(context).billing.availability()).resolves.toEqual(payload);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/billing/availability");
  });
  it.each([{ status: "available" }, { status: "enabled", checkoutPlans: [], cancellationAvailable: false }, { status: "available", checkoutPlans: ["UNKNOWN"], cancellationAvailable: false }, { status: "available", checkoutPlans: ["PRO"], cancellationAvailable: "false" }])("rejects malformed capabilities instead of enabling checkout", async payload => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    await expect(appRouter.createCaller(context).billing.availability()).rejects.toBeTruthy();
  });
  it("requires an authenticated context", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(appRouter.createCaller({ ...context, user: null }).billing.availability()).rejects.toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
