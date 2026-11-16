import { describe, expect, it, vi } from "vitest";
import {
  createManualPaymentFlow,
  parseManualPaymentCents,
  type ManualPaymentInput,
} from "./manual-payment-flow";
const input: ManualPaymentInput = {
  chargeId: "charge-1",
  amountCents: 10000,
  method: "PIX",
};
const confirmation = {
  ok: true as const,
  paymentId: "payment-1",
  idempotent: false,
};

describe("manual payment values", () => {
  it.each([
    "",
    " ",
    "0",
    "-1",
    "1.5",
    "1e3",
    "0x10",
    "Infinity",
    "NaN",
    "100,00",
    "9007199254740992",
  ])("rejects noncanonical cent values: %s", value => {
    expect(parseManualPaymentCents(value)).toBeNull();
  });
  it.each([
    ["1", 1],
    [" 10000 ", 10000],
    ["00125", 125],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("accepts exact integer cents %s", (value, expected) => {
    expect(parseManualPaymentCents(String(value))).toBe(expected);
  });
});

describe("manual payment attempts", () => {
  it("reuses the key after a lost response and confirms the existing server payment", async () => {
    const key = vi.fn(() => "attempt-key-1");
    const flow = createManualPaymentFlow(key);
    const payments = new Map<string, typeof confirmation>();
    const send = vi.fn(
      async (payload: ManualPaymentInput & { idempotencyKey: string }) => {
        const stored = payments.get(payload.idempotencyKey);
        if (stored) return { ...stored, idempotent: true };
        payments.set(payload.idempotencyKey, confirmation);
        throw new Error("Response lost after commit");
      }
    );
    const onConfirmed = vi.fn();
    const refresh = vi.fn(async () => true);
    expect(await flow.run(input, { send, onConfirmed, refresh })).toMatchObject(
      { status: "failed" }
    );
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(await flow.run(input, { send, onConfirmed, refresh })).toMatchObject(
      {
        status: "confirmed",
        payment: { paymentId: "payment-1", idempotent: true },
      }
    );
    expect(payments.size).toBe(1);
    expect(key).toHaveBeenCalledTimes(1);
    expect(send.mock.calls.map(([payload]) => payload.idempotencyKey)).toEqual([
      "attempt-key-1",
      "attempt-key-1",
    ]);
  });
  it("uses a new key for a changed payload while retaining the earlier key if the operator restores it", async () => {
    let count = 0;
    const flow = createManualPaymentFlow(() => `attempt-key-${++count}`);
    const send = vi.fn(async (_payload: any) => {
      throw new Error("rejected");
    });
    const actions = {
      send,
      onConfirmed: vi.fn(),
      refresh: vi.fn(async () => true),
    };
    await flow.run(input, actions);
    await flow.run({ ...input, method: "CASH" }, actions);
    await flow.run({ ...input, amountCents: 9999 }, actions);
    await flow.run({ ...input, chargeId: "charge-2" }, actions);
    await flow.run(input, actions);
    expect(send.mock.calls.map(([payload]) => payload.idempotencyKey)).toEqual([
      "attempt-key-1",
      "attempt-key-2",
      "attempt-key-3",
      "attempt-key-4",
      "attempt-key-1",
    ]);
  });
  it("blocks simultaneous submissions before the first render can disable the form", async () => {
    let resolve!: (value: typeof confirmation) => void;
    const send = vi.fn(
      () =>
        new Promise<typeof confirmation>(done => {
          resolve = done;
        })
    );
    const flow = createManualPaymentFlow(() => "attempt-key-1");
    const actions = {
      send,
      onConfirmed: vi.fn(),
      refresh: vi.fn(async () => true),
    };
    const first = flow.run(input, actions);
    expect(flow.pending).toBe(true);
    expect(await flow.run(input, actions)).toEqual({ status: "busy" });
    expect(send).toHaveBeenCalledTimes(1);
    resolve(confirmation);
    await expect(first).resolves.toMatchObject({ status: "confirmed" });
    expect(flow.pending).toBe(false);
  });
  it.each(["reject", "error-result"])(
    "confirms before refreshing and preserves success when refresh fails (%s)",
    async failure => {
      const calls: string[] = [];
      const flow = createManualPaymentFlow(() => "attempt-key-1");
      const outcome = await flow.run(input, {
        send: async () => {
          calls.push("write");
          return confirmation;
        },
        onConfirmed: () => calls.push("confirmed"),
        refresh: async () => {
          calls.push("refresh");
          if (failure === "reject") throw new Error("read unavailable");
          return false;
        },
      });
      expect(calls).toEqual(["write", "confirmed", "refresh"]);
      expect(outcome).toMatchObject({
        status: "confirmed",
        refreshed: false,
        payment: confirmation,
      });
      expect(flow.pending).toBe(false);
    }
  );
  it("keeps the synchronous lock until the post-confirmation refresh settles", async () => {
    let finish!: (value: boolean) => void;
    const refresh = vi.fn(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        })
    );
    const send = vi.fn(async () => confirmation);
    const onConfirmed = vi.fn();
    const flow = createManualPaymentFlow(() => "attempt-key-1");
    const first = flow.run(input, { send, onConfirmed, refresh });
    await vi.waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
    expect(
      await flow.run(
        { ...input, chargeId: "other" },
        { send, onConfirmed, refresh }
      )
    ).toEqual({ status: "busy" });
    expect(send).toHaveBeenCalledTimes(1);
    finish(true);
    await expect(first).resolves.toMatchObject({
      status: "confirmed",
      refreshed: true,
    });
  });
  it("rejects unsafe values before transport or generating a request key", async () => {
    const key = vi.fn();
    const flow = createManualPaymentFlow(key);
    const send = vi.fn();
    expect(
      await flow.run(
        { ...input, amountCents: Infinity },
        { send, onConfirmed: vi.fn(), refresh: vi.fn() }
      )
    ).toMatchObject({ status: "failed" });
    expect(send).not.toHaveBeenCalled();
    expect(key).not.toHaveBeenCalled();
  });
});
