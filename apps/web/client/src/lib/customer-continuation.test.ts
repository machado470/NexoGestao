import { describe, expect, it } from "vitest";
import { customerContinuation } from "./customer-continuation";

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
