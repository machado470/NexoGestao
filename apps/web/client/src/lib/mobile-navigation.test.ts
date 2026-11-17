import { describe, expect, it } from "vitest";
import { canVisitMobileRoute } from "./mobile-navigation";
describe("mobile route permissions", () => {
  it.each(["ADMIN", "MANAGER"] as const)(
    "allows %s to reach finance records",
    role => {
      expect(canVisitMobileRoute(role, "/finances?chargeId=charge-1")).toBe(
        true
      );
    }
  );
  it.each(["STAFF", "VIEWER"] as const)(
    "keeps finance and administration restricted for %s",
    role => {
      expect(canVisitMobileRoute(role, "/finances?chargeId=charge-1")).toBe(
        false
      );
      expect(canVisitMobileRoute(role, "/settings")).toBe(false);
      expect(
        canVisitMobileRoute(role, "/service-orders?serviceOrderId=order-1")
      ).toBe(true);
      expect(
        canVisitMobileRoute(role, "/appointments?appointmentId=appointment-1")
      ).toBe(true);
    }
  );
  it.each([
    "https://example.com",
    "//example.com",
    "/finances-elsewhere",
    "/unknown",
  ])("rejects unsupported destinations: %s", path => {
    expect(canVisitMobileRoute("ADMIN", path)).toBe(false);
  });
  it("does not authorize a missing role", () => {
    expect(canVisitMobileRoute(null, "/customers")).toBe(false);
    expect(canVisitMobileRoute("STAFF", "/settings/access")).toBe(false);
  });
});
