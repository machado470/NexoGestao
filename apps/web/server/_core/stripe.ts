/**
 * Helpers para integração com Stripe
 * Pagamentos, assinaturas e cobranças
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Cria um cliente no Stripe
 */
export async function createStripeCustomer(data: {
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, string>;
}) {
  return stripe.customers.create({
    email: data.email,
    name: data.name,
    phone: data.phone,
    metadata: data.metadata,
  });
}

/**
 * Cria uma cobrança (charge)
 */
export async function createCharge(data: {
  customerId: string;
  amount: number; // em centavos
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  return stripe.charges.create({
    customer: data.customerId,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    metadata: data.metadata,
  });
}

/**
 * Cria uma intenção de pagamento (Payment Intent)
 */
export async function createPaymentIntent(data: {
  customerId: string;
  amount: number; // em centavos
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}) {
  return stripe.paymentIntents.create({
    customer: data.customerId,
    amount: data.amount,
    currency: data.currency,
    description: data.description,
    metadata: data.metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });
}

/**
 * Cria uma assinatura (subscription)
 */
export async function createSubscription(data: {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}) {
  return stripe.subscriptions.create({
    customer: data.customerId,
    items: [{ price: data.priceId }],
    trial_period_days: data.trialDays,
    metadata: data.metadata,
  });
}

/**
 * Cancela uma assinatura
 */
export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.del(subscriptionId);
}

/**
 * Obtém uma assinatura
 */
export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cria um link de checkout
 */
export async function createCheckoutSession(data: {
  customerId: string;
  lineItems: Array<{
    priceId: string;
    quantity: number;
  }>;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create({
    customer: data.customerId,
    line_items: data.lineItems,
    mode: 'payment',
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    metadata: data.metadata,
  });
}

/**
 * Cria um link de checkout para assinatura
 */
export async function createSubscriptionCheckoutSession(data: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create({
    customer: data.customerId,
    line_items: [
      {
        price: data.priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    subscription_data: {
      trial_period_days: data.trialDays,
      metadata: data.metadata,
    },
  });
}

/**
 * Obtém um evento do webhook
 */
export function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
) {
  return stripe.webhooks.constructEvent(body, signature, secret);
}

/**
 * Refunda um pagamento
 */
export async function refundCharge(chargeId: string, amount?: number) {
  return stripe.refunds.create({
    charge: chargeId,
    amount,
  });
}

/**
 * Obtém o histórico de pagamentos de um cliente
 */
export async function getCustomerCharges(customerId: string, limit: number = 10) {
  return stripe.charges.list({
    customer: customerId,
    limit,
  });
}

/**
 * Atualiza um cliente no Stripe
 */
export async function updateStripeCustomer(
  customerId: string,
  data: {
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }
) {
  return stripe.customers.update(customerId, data);
}

/**
 * Deleta um cliente no Stripe
 */
export async function deleteStripeCustomer(customerId: string) {
  return stripe.customers.del(customerId);
}

/**
 * Cria um cupom de desconto
 */
export async function createCoupon(data: {
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
  metadata?: Record<string, string>;
}) {
  return stripe.coupons.create({
    percent_off: data.percentOff,
    amount_off: data.amountOff,
    currency: data.currency,
    duration: data.duration,
    duration_in_months: data.durationInMonths,
    max_redemptions: data.maxRedemptions,
    metadata: data.metadata,
  });
}

/**
 * Aplica um cupom a uma assinatura
 */
export async function applyDiscountToSubscription(
  subscriptionId: string,
  couponId: string
) {
  return stripe.subscriptions.update(subscriptionId, {
    coupon: couponId,
  });
}
