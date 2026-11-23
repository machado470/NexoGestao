import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SERVICE_ORDER_BILLING_TREATMENTS,
  serviceOrderBillingTreatmentSchema,
  withoutBillingTreatment,
} from "../shared/service-order-billing-treatment";

const migrationsDir = path.resolve("../../prisma/migrations");

/** Values of the newest ServiceOrder_billingTreatment CHECK constraint. */
function latestCheckConstraintValues(): string[] {
  const pattern =
    /ADD CONSTRAINT "ServiceOrder_billingTreatment" CHECK \("billingTreatment" IN \(([^)]*)\)\)/g;
  let latest: string[] = [];
  for (const dir of readdirSync(migrationsDir).sort()) {
    const file = path.join(migrationsDir, dir, "migration.sql");
    let sql: string;
    try {
      sql = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const match of sql.matchAll(pattern)) {
      latest = match[1].split(",").map(value => value.trim().replace(/^'|'$/g, ""));
    }
  }
  return latest;
}

describe("ServiceOrder billingTreatment contract", () => {
  it("matches the newest database CHECK constraint", () => {
    const values = latestCheckConstraintValues();
    expect(values.length).toBeGreaterThan(0);
    expect([...SERVICE_ORDER_BILLING_TREATMENTS].sort()).toEqual([...values].sort());
  });

  it("rejects values outside the contract", () => {
    expect(serviceOrderBillingTreatmentSchema.safeParse("FREE").success).toBe(false);
    expect(serviceOrderBillingTreatmentSchema.safeParse(null).success).toBe(false);
  });

  it("drops only the private field", () => {
    expect(withoutBillingTreatment({ id: "so-1", billingTreatment: "STANDARD" })).toEqual({ id: "so-1" });
    expect(withoutBillingTreatment({ id: "so-1" })).toEqual({ id: "so-1" });
  });
});
