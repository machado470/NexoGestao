import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { __resetOperationalNotificationsForTests } from "./_core/operationalNotifications";

function createCtx(orgId: number) {
  return {
    req: { headers: { cookie: "nexo_token=test-token" } },
    res: {},
    user: {
      id: 1,
      organizationId: orgId,
      role: "admin",
    },
  } as any;
}

describe("Operational notifications integration", () => {
  beforeEach(() => {
    __resetOperationalNotificationsForTests();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ id: "entity-1", data: { id: "entity-1" } }),
      }))
    );
  });

  it("generates notifications for required operational events", async () => {
    const caller = appRouter.createCaller(createCtx(10));

    await caller.data.appointments.update({ id: "apt-1", status: "CONFIRMED" });
    await caller.data.appointments.update({ id: "apt-2", status: "NO_SHOW" });
    await caller.data.serviceOrders.update({ id: "so-1", status: "DONE" });
    await caller.finance.charges.update({ id: "ch-1", status: "OVERDUE" });
    await caller.governance.governance.changeRiskLevel({
      entityId: "customer-1",
      previousLevel: "LOW",
      newLevel: "HIGH",
    });

    const notifications = await caller.dashboard.notifications({ limit: 10 });
    const types = notifications.map((n) => n.type);

    expect(types).toContain("APPOINTMENT_CONFIRMED");
    expect(types).toContain("APPOINTMENT_NO_SHOW");
    expect(types).toContain("SERVICE_ORDER_COMPLETED");
    expect(types).toContain("PAYMENT_OVERDUE");
    expect(types).toContain("RISK_LEVEL_CHANGED");
  });

  it("scopes notifications by orgId and keeps them visible in dashboard query", async () => {
    const callerOrg10 = appRouter.createCaller(createCtx(10));
    const callerOrg20 = appRouter.createCaller(createCtx(20));

    await callerOrg10.data.appointments.update({ id: "apt-10", status: "CONFIRMED" });
    await callerOrg20.data.appointments.update({ id: "apt-20", status: "CONFIRMED" });

    const org10Notifications = await callerOrg10.dashboard.notifications({ limit: 10 });
    const org20Notifications = await callerOrg20.dashboard.notifications({ limit: 10 });

    expect(org10Notifications.length).toBe(1);
    expect(org20Notifications.length).toBe(1);

    expect(org10Notifications[0]?.metadata).toMatchObject({ appointmentId: "apt-10" });
    expect(org20Notifications[0]?.metadata).toMatchObject({ appointmentId: "apt-20" });
  });
});
