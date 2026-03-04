// Stub de Stripe pra compilar sem dependency/config.

export async function createCheckoutSession() {
  return {
    ok: false,
    reason: "STRIPE_NOT_CONFIGURED"
  };
}
