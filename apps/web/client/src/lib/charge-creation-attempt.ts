export type ChargeDraft = {
  customerId: string;
  amountCents: number;
  dueDate: string;
  notes?: string;
};

/** Retain an uncertain attempt's key; a confirmed creation allows a new intentional charge. */
export function createChargeCreationAttempt(makeKey: () => string) {
  const keys = new Map<string, string>();
  let current: string | undefined;
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    begin(input: ChargeDraft) {
      if (pending) return null;
      const fingerprint = JSON.stringify([
        input.customerId,
        input.amountCents,
        input.dueDate,
        input.notes ?? "",
      ]);
      let key = keys.get(fingerprint);
      if (!key) {
        key = makeKey();
        keys.set(fingerprint, key);
      }
      current = fingerprint;
      pending = true;
      return key;
    },
    confirm() {
      if (current) keys.delete(current);
    },
    settle() {
      pending = false;
      current = undefined;
    },
  };
}
