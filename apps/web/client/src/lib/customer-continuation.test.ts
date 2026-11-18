import { describe, expect, it } from "vitest";
import {
  customerContinuation,
  canChooseCustomerNextStep,
} from "./customer-continuation";

describe("confirmed customer continuation", () => {
  it.each([
    ["schedule", "/appointments", "Criar agendamento"],
    ["billing", "/finances", "Criar cobrança"],
  ] as const)("opens %s with the saved customer", (step, path, label) => {
    const next = customerContinuation("customer-1", step)!;
    const url = new URL(next.href, "https://local.test");
    expect(next.label).toBe(label);
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get("customerId")).toBe("customer-1");
    expect(url.searchParams.get("action")).toBe("create");
  });
  it("opens WhatsApp context without automatically sending", () => {
    const url = new URL(
      customerContinuation("customer-1", "message")!.href,
      "https://local.test"
    );
    expect(url.pathname).toBe("/whatsapp");
    expect(url.searchParams.get("customerId")).toBe("customer-1");
    expect(url.searchParams.has("action")).toBe(false);
  });
  it("keeps registration-only optional and rejects an empty identifier", () => {
    expect(customerContinuation("customer-1", "only_register")).toBeNull();
    expect(customerContinuation("  ", "schedule")).toBeNull();
  });
  it("encodes the identifier rather than accepting extra navigation parameters", () => {
    const url = new URL(
      customerContinuation("customer &action=delete", "billing")!.href,
      "https://local.test"
    );
    expect(url.searchParams.get("customerId")).toBe("customer &action=delete");
    expect(url.searchParams.getAll("action")).toEqual(["create"]);
  });
});

describe("customer continuation permissions", () => {
  it.each([
    ["ADMIN", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["VIEWER", false],
    [null, false],
  ] as const)(
    "offers billing to %s only with canonical finance access",
    (role, allowed) => {
      expect(canChooseCustomerNextStep(role, "billing")).toBe(allowed);
    }
  );
  it.each(["schedule", "message", "only_register"] as const)(
    "keeps %s for staff",
    step => {
      expect(canChooseCustomerNextStep("STAFF", step)).toBe(true);
    }
  );
  it.each(["schedule", "message", "billing", "only_register"] as const)(
    "does not offer creation continuation %s to viewers",
    step => {
      expect(canChooseCustomerNextStep("VIEWER", step)).toBe(false);
      expect(canChooseCustomerNextStep(null, step)).toBe(false);
    }
  );
});
