export type ManualPaymentInput = {
  chargeId: string;
  amountCents: number;
  method: "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER";
};
export type PaymentConfirmation = {
  ok: true;
  paymentId: string;
  idempotent: boolean;
};

export function parseManualPaymentCents(value: string): number | null {
  const digits = value.trim();
  if (!/^\d+$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

type PaymentOutcome<T> =
  | { status: "busy" }
  | { status: "failed"; error: unknown }
  | { status: "confirmed"; payment: T; refreshed: boolean };

/** One page session: retries of the same payload share a key, including modal reopen. */
export function createManualPaymentFlow(
  createKey: () => string = () => crypto.randomUUID()
) {
  const attempts = new Map<string, string>();
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    async run<T extends PaymentConfirmation>(
      input: ManualPaymentInput,
      actions: {
        send: (
          payload: ManualPaymentInput & { idempotencyKey: string }
        ) => Promise<T>;
        onConfirmed: (payment: T) => void;
        refresh: () => Promise<boolean>;
      }
    ): Promise<PaymentOutcome<T>> {
      if (pending) return { status: "busy" };
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) {
        return {
          status: "failed",
          error: new Error(
            "Informe um valor inteiro maior que zero, em centavos."
          ),
        };
      }
      pending = true;
      try {
        const fingerprint = JSON.stringify([
          input.chargeId,
          input.amountCents,
          input.method,
        ]);
        let idempotencyKey = attempts.get(fingerprint);
        if (!idempotencyKey) {
          idempotencyKey = createKey();
          attempts.set(fingerprint, idempotencyKey);
        }
        let payment: T;
        try {
          payment = await actions.send({ ...input, idempotencyKey });
        } catch (error) {
          return { status: "failed", error };
        }
        // A refresh failure must never turn a confirmed payment into a retryable write.
        actions.onConfirmed(payment);
        let refreshed = false;
        try {
          refreshed = await actions.refresh();
        } catch {
          refreshed = false;
        }
        return { status: "confirmed", payment, refreshed };
      } finally {
        pending = false;
      }
    },
  };
}
