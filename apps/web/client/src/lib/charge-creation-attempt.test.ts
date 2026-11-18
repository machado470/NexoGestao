import { describe, expect, it, vi } from "vitest";
import { createChargeCreationAttempt } from "./charge-creation-attempt";
const draft = {
  customerId: "customer-1",
  amountCents: 15000,
  dueDate: "2026-11-20T15:00:00Z",
};
describe("charge creation attempt", () => {
  it("reuses the key after an uncertain response, including after another draft", () => {
    const makeKey = vi
      .fn()
      .mockReturnValueOnce("first-key")
      .mockReturnValueOnce("other-key");
    const attempt = createChargeCreationAttempt(makeKey);
    expect(attempt.begin(draft)).toBe("first-key");
    attempt.settle();
    expect(attempt.begin({ ...draft, amountCents: 20000 })).toBe("other-key");
    attempt.settle();
    expect(attempt.begin({ ...draft })).toBe("first-key");
    expect(makeKey).toHaveBeenCalledTimes(2);
  });
  it("blocks a second submission immediately while pending", () => {
    const attempt = createChargeCreationAttempt(() => "key");
    expect(attempt.begin(draft)).toBe("key");
    expect(attempt.pending).toBe(true);
    expect(attempt.begin(draft)).toBeNull();
    expect(attempt.begin({ ...draft, notes: "different" })).toBeNull();
    attempt.settle();
    expect(attempt.pending).toBe(false);
  });
  it("allows a deliberate identical new charge only after confirmation", () => {
    const makeKey = vi
      .fn()
      .mockReturnValueOnce("confirmed-key")
      .mockReturnValueOnce("new-key");
    const attempt = createChargeCreationAttempt(makeKey);
    expect(attempt.begin(draft)).toBe("confirmed-key");
    attempt.confirm();
    expect(attempt.begin(draft)).toBeNull();
    attempt.settle();
    expect(attempt.begin(draft)).toBe("new-key");
  });
  it.each(["customerId", "amountCents", "dueDate", "notes"] as const)(
    "separates attempts when %s changes",
    field => {
      let serial = 0;
      const attempt = createChargeCreationAttempt(() => String(++serial));
      expect(attempt.begin(draft)).toBe("1");
      attempt.settle();
      expect(
        attempt.begin({
          ...draft,
          [field]: field === "amountCents" ? 20000 : "different",
        })
      ).toBe("2");
    }
  );
});
