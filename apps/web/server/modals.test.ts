import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { customers, appointments, serviceOrders } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("CRUD Operations", async () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      console.warn("Database not available for tests");
    }
  });

  describe("Customers", () => {
    it("should create a customer", async () => {
      if (!db) {
        console.warn("Skipping test: database not available");
        return;
      }

      const result = await db.insert(customers).values({
        organizationId: 1,
        name: "Test Customer",
        phone: "11999999999",
        email: "customer@test.com",
        active: true,
      });

      expect(result).toBeDefined();
    });

    it("should retrieve customers", async () => {
      if (!db) {
        console.warn("Skipping test: database not available");
        return;
      }

      const result = await db.select().from(customers);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Appointments", () => {
    it("should create an appointment", async () => {
      if (!db) {
        console.warn("Skipping test: database not available");
        return;
      }

      // First create a customer
      const customerResult = await db
        .insert(customers)
        .values({
          organizationId: 1,
          name: "Appointment Customer",
          phone: "11988888888",
          email: "appt@test.com",
          active: true,
        });

      // Get the inserted customer
      const allCustomers = await db.select().from(customers).where(eq(customers.phone, "11988888888"));
      const customer = allCustomers[0];

      const result = await db.insert(appointments).values({
        organizationId: 1,
        customerId: customer.id,
        title: "Test Appointment",
        startsAt: new Date(),
        status: "SCHEDULED",
      });

      expect(result).toBeDefined();
    });
  });

  describe("Service Orders", () => {
    it("should create a service order", async () => {
      if (!db) {
        console.warn("Skipping test: database not available");
        return;
      }

      // First create a customer
      const customerResult = await db
        .insert(customers)
        .values({
          organizationId: 1,
          name: "Service Order Customer",
          phone: "11977777777",
          email: "service@test.com",
          active: true,
        });

      // Get the inserted customer
      const allCustomers = await db.select().from(customers).where(eq(customers.phone, "11977777777"));
      const customer = allCustomers[0];

      const result = await db.insert(serviceOrders).values({
        organizationId: 1,
        customerId: customer.id,
        title: "Test Service Order",
        description: "Test Description",
        status: "OPEN",
        priority: "MEDIUM",
      });

      expect(result).toBeDefined();
    });
  });
});
