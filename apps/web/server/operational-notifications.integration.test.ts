import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import {
  __resetOperationalNotificationsForTests,
  emitOperationalNotification,
} from "./_core/operationalNotifications";

const ORG_10_ID = "00000000-0000-0000-0000-000000000010";
const ORG_20_ID = "00000000-0000-0000-0000-000000000020";

function createCtx(orgId: string) {
  return {
    req: { headers: { cookie: "nexo_token=test-token" } },
    res: {},
    user: {
      id: 1,
      organizationId: orgId,
      role: "admin",
      token: "test-token",
      validated: true,
    },
  } as any;
}

describe("Operational notifications integration", () => {
  beforeEach(async () => {
    await __resetOperationalNotificationsForTests();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ id: "entity-1", data: { id: "entity-1" } }),
      }))
    );
  });

  it("records risk-level change notification through governance router", async () => {
    const caller = appRouter.createCaller(createCtx(ORG_10_ID));

    await caller.governance.changeRiskLevel({
      entityId: "customer-1",
      previousLevel: "LOW",
      newLevel: "HIGH",
    });

    const notifications = await caller.dashboard.notifications({ limit: 10 });
    const types = notifications.map((n) => n.type);

    expect(types).toContain("RISK_LEVEL_CHANGED");
    expect(notifications.every((n) => n.orgId === ORG_10_ID)).toBe(true);
  });

  it("scopes notifications by orgId and keeps them visible in dashboard query", async () => {
    const callerOrg10 = appRouter.createCaller(createCtx(ORG_10_ID));
    const callerOrg20 = appRouter.createCaller(createCtx(ORG_20_ID));

    await emitOperationalNotification({
      orgId: ORG_10_ID,
      type: "APPOINTMENT_CONFIRMED",
      metadata: { appointmentId: "apt-10" },
    });
    await emitOperationalNotification({
      orgId: ORG_20_ID,
      type: "APPOINTMENT_CONFIRMED",
      metadata: { appointmentId: "apt-20" },
    });

    const org10Notifications = await callerOrg10.dashboard.notifications({ limit: 10 });
    const org20Notifications = await callerOrg20.dashboard.notifications({ limit: 10 });

    expect(org10Notifications.length).toBe(1);
    expect(org20Notifications.length).toBe(1);

    expect(org10Notifications[0]?.metadata).toMatchObject({ appointmentId: "apt-10" });
    expect(org20Notifications[0]?.metadata).toMatchObject({ appointmentId: "apt-20" });
    expect(org10Notifications[0]?.orgId).toBe(ORG_10_ID);
    expect(org20Notifications[0]?.orgId).toBe(ORG_20_ID);
  });
});
