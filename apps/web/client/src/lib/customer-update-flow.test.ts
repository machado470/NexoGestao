import { describe, expect, it, vi } from "vitest";
import { executeCustomerUpdate } from "./customer-update-flow";

describe("customer edit commit boundary", () => {
  it("leaves a rejected edit retryable and never confirms or refreshes it", async () => {
    const conflict = new Error("conflict");
    const confirm = vi.fn(),
      synchronize = vi.fn();
    const result = await executeCustomerUpdate({
      persist: async () => {
        throw conflict;
      },
      confirm,
      synchronize,
    });
    expect(result).toEqual({ status: "failed", error: conflict });
    expect(confirm).not.toHaveBeenCalled();
    expect(synchronize).not.toHaveBeenCalled();
  });
  it("confirms server-normalized values before a follow-up read finishes", async () => {
    const customer = {
      id: "customer",
      name: "Nome normalizado",
      updatedAt: "version-2",
    };
    let finish!: () => void;
    const read = new Promise<void>(resolve => {
      finish = resolve;
    });
    const events: string[] = [];
    const pending = executeCustomerUpdate({
      persist: async () => customer,
      confirm: value => {
        expect(value).toBe(customer);
        events.push("confirmed");
      },
      synchronize: () => {
        events.push("reading");
        return read;
      },
    });
    await Promise.resolve();
    expect(events).toEqual(["confirmed", "reading"]);
    finish();
    expect(await pending).toEqual({
      status: "saved",
      customer,
      synchronized: true,
    });
  });
  it("keeps a committed edit successful when the follow-up read fails", async () => {
    let storedName = "Original";
    const persist = vi.fn(async () => {
      storedName = "Atualizado";
      return { name: storedName };
    });
    const confirm = vi.fn();
    const result = await executeCustomerUpdate({
      persist,
      confirm,
      synchronize: async () => {
        throw new Error("503");
      },
    });
    expect(result).toEqual({
      status: "saved",
      customer: { name: "Atualizado" },
      synchronized: false,
    });
    expect(storedName).toBe("Atualizado");
    expect(persist).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("does not classify a post-commit callback failure as a rejected write", async () => {
    const result = await executeCustomerUpdate({
      persist: async () => ({ id: "saved" }),
      confirm: () => {
        throw new Error("callback failed");
      },
      synchronize: vi.fn(),
    });
    expect(result).toEqual({
      status: "saved",
      customer: { id: "saved" },
      synchronized: false,
    });
  });
});
