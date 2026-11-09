import { describe, expect, it } from "vitest";
import { can, type Role } from "./rbac";

describe("canonical UI access", () => {
  it.each(["ADMIN", "MANAGER"] as const)(
    "offers the declared financial page to %s",
    role => {
      expect(can(role, "finance:read")).toBe(true);
      expect(can(role, "finance:update")).toBe(true);
    }
  );
  it.each(["STAFF", "VIEWER"] as const)(
    "does not offer financial routes restricted by the API to %s",
    role => {
      expect(can(role, "finance:read")).toBe(false);
      expect(can(role, "finance:update")).toBe(false);
    }
  );
  it("keeps VIEWER read-only across customer, appointment and service-order workflows", () => {
    for (const domain of ["customers", "appointments", "orders"] as const) {
      expect(can("VIEWER", `${domain}:read`)).toBe(true);
      expect(can("VIEWER", `${domain}:create`)).toBe(false);
      expect(can("VIEWER", `${domain}:update`)).toBe(false);
    }
  });
  it("preserves operator capabilities without granting administrative privileges", () => {
    expect(can("STAFF", "orders:update")).toBe(true);
    expect(can("STAFF", "appointments:update")).toBe(true);
    expect(can("STAFF", "customers:create")).toBe(true);
    expect(can("STAFF", "settings:manage")).toBe(false);
  });
  it("denies missing or unknown roles", () => {
    expect(can("UNKNOWN" as Role, "finance:read")).toBe(false);
  });
});
