import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const context = {
  req: { headers: { cookie: "nexo_token=trusted" }, cookies: { nexo_token: "trusted" } },
  res: { cookie: vi.fn(), clearCookie: vi.fn() },
  user: { token: "trusted", validated: true },
} as any;

const at = "2026-11-20T12:00:00.000Z";
const orgId = "org-1";

function customer() {
  return {
    id: "customer-1",
    orgId,
    name: "Cliente Real",
    phone: "+5511999999999",
    email: null,
    cpfCnpj: null,
    address: null,
    notes: null,
    active: true,
    createdAt: at,
    updatedAt: at,
  };
}

function serviceOrder() {
  return {
    id: "service-order-1",
    orgId,
    customerId: "customer-1",
    idempotencyKey: null,
    appointmentId: null,
    assignedToPersonId: null,
    title: "Manutenção",
    billingTreatment: "STANDARD",
    description: null,
    status: "DONE",
    priority: 2,
    scheduledFor: null,
    startedAt: at,
    finishedAt: at,
    amountCents: 15000,
    dueDate: null,
    cancellationReason: null,
    outcomeSummary: null,
    createdAt: at,
    updatedAt: at,
  };
}

function payment(withRefunds = true) {
  return {
    id: "payment-1",
    orgId,
    chargeId: "charge-1",
    amountCents: 5000,
    method: "PIX",
    paidAt: at,
    notes: null,
    externalRef: null,
    createdAt: at,
    ...(withRefunds ? { refunds: [] } : {}),
  };
}

function chargeBase() {
  return {
    id: "charge-1",
    orgId,
    customerId: "customer-1",
    idempotencyKey: null,
    serviceOrderId: "service-order-1",
    amountCents: 15000,
    currency: "BRL",
    status: "OVERDUE",
    dueDate: at,
    paidAt: null,
    canceledAt: null,
    cancellationReason: null,
    canceledByUserId: null,
    notes: null,
    createdAt: at,
    updatedAt: at,
    customer: customer(),
    serviceOrder: serviceOrder() as Record<string, unknown> | null,
    payments: [payment()],
    paidAmountCents: 5000,
    balanceCents: 10000,
  };
}

/** Shape of GET /finance/charges/:id (FinanceService.getCharge). */
function upstreamDetail() {
  return {
    ...chargeBase(),
    refundedAmountCents: 0,
    netReceivedAmountCents: 5000,
    daysOverdue: 3,
    evaluatedAt: at,
  };
}

/** Shape of one GET /finance/operational-queue item (FinanceService.getOperationalQueue). */
function upstreamQueueItem() {
  return {
    ...chargeBase(),
    payments: [payment(false)],
    financialOperationalSummary: {
      priority: "MEDIUM",
      priorityReason: "3 dia(s) de atraso, 10000 centavos em aberto, risco null",
      daysOverdue: 3,
      lastPaymentDate: at,
      lastContactDate: null,
      lastChargeReminderDate: null,
      riskLevel: null,
      recommendedAction: "SEND_PAYMENT_LINK",
      recommendedActionTarget: "CUSTOMER",
      evaluatedAt: at,
    },
    nextBestCollectionAction: "SEND_PAYMENT_LINK",
  };
}

/** What the browser must receive: same data without tenant id and billingTreatment. */
function toPublic<T extends Record<string, any>>(charge: T) {
  const { orgId: _o, customer: c, serviceOrder: so, payments, ...rest } = charge;
  const { orgId: _co, ...publicCustomer } = c;
  let publicOrder: Record<string, unknown> | null = null;
  if (so) {
    const { orgId: _so, billingTreatment: _bt, ...order } = so;
    publicOrder = order;
  }
  return {
    ...rest,
    customer: publicCustomer,
    serviceOrder: publicOrder,
    payments: payments.map(({ orgId: _po, ...p }: Record<string, unknown>) => p),
  };
}

function respond(body: unknown) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: body }), { status: 200 }));
}

function caller() {
  return appRouter.createCaller(context);
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach(item => collectKeys(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe("finance.charges.getById output contract", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("devolve a cobrança sem orgId e sem billingTreatment em nenhum nível", async () => {
    const upstream = upstreamDetail();
    respond(upstream);

    const result = await caller().finance.charges.getById({ id: "charge-1" });

    expect(result).toEqual(toPublic(upstream));
    const keys = collectKeys(result);
    expect(keys.has("orgId")).toBe(false);
    expect(keys.has("billingTreatment")).toBe(false);
  });

  it("preserva os campos usados por Finanças e pelo modal de cobrança", async () => {
    respond(upstreamDetail());
    const result = await caller().finance.charges.getById({ id: "charge-1" });
    expect(result).toMatchObject({
      id: "charge-1",
      customerId: "customer-1",
      status: "OVERDUE",
      balanceCents: 10000,
      currency: "BRL",
      amountCents: 15000,
      dueDate: at,
      updatedAt: at,
      notes: null,
      customer: { name: "Cliente Real" },
      serviceOrder: { id: "service-order-1", title: "Manutenção" },
    });
  });

  it("aceita cobrança sem O.S. e sem pagamentos", async () => {
    const upstream = { ...upstreamDetail(), serviceOrderId: null, serviceOrder: null, payments: [] };
    respond(upstream);
    await expect(caller().finance.charges.getById({ id: "charge-1" })).resolves.toEqual(
      toPublic(upstream)
    );
  });

  it.each([
    ["chave desconhecida na cobrança", (c: any) => { c.internalNote = "x"; }],
    ["chave desconhecida no pagamento", (c: any) => { c.payments[0].providerPayload = {}; }],
    ["chave desconhecida no cliente", (c: any) => { c.customer.secret = "x"; }],
    ["billingTreatment fora do contrato", (c: any) => { c.serviceOrder.billingTreatment = "FREE"; }],
    ["método de pagamento inválido", (c: any) => { c.payments[0].method = "BOLETO"; }],
    ["orgId ausente no upstream", (c: any) => { delete c.orgId; }],
    ["status inválido", (c: any) => { c.status = "REFUNDED"; }],
  ])("rejeita %s vindo do upstream", async (_label, mutate) => {
    const upstream = upstreamDetail();
    mutate(upstream);
    respond(upstream);
    await expect(caller().finance.charges.getById({ id: "charge-1" })).rejects.toBeTruthy();
  });
});

describe("finance.operationalQueue output contract", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("devolve a fila sem orgId e sem billingTreatment, preservando o resumo oficial", async () => {
    const item = upstreamQueueItem();
    respond({ items: [item], meta: { limit: 50, total: 1 } });

    const result = await caller().finance.operationalQueue({ limit: 50 });

    expect(result).toEqual({ items: [toPublic(item)], meta: { limit: 50, total: 1 } });
    const keys = collectKeys(result);
    expect(keys.has("orgId")).toBe(false);
    expect(keys.has("billingTreatment")).toBe(false);
    expect(result.items[0].financialOperationalSummary).toEqual(item.financialOperationalSummary);
  });

  it("aceita fila vazia", async () => {
    respond({ items: [], meta: { limit: 50, total: 0 } });
    await expect(caller().finance.operationalQueue()).resolves.toEqual({
      items: [],
      meta: { limit: 50, total: 0 },
    });
  });

  it.each(["NORMAL", "WARNING", "RESTRICTED", "SUSPENDED", null] as const)(
    "aceita riskLevel %s",
    async riskLevel => {
      const item = upstreamQueueItem();
      item.financialOperationalSummary.riskLevel = riskLevel as any;
      respond({ items: [item], meta: { limit: 50, total: 1 } });
      await expect(caller().finance.operationalQueue()).resolves.toMatchObject({
        items: [{ financialOperationalSummary: { riskLevel } }],
      });
    }
  );

  it.each([
    ["ação recomendada desconhecida", (i: any) => { i.financialOperationalSummary.recommendedAction = "SEND_EMAIL"; }],
    ["destino desconhecido", (i: any) => { i.financialOperationalSummary.recommendedActionTarget = "PAYMENT"; }],
    ["chave desconhecida no resumo", (i: any) => { i.financialOperationalSummary.score = 10; }],
    ["chave desconhecida no item", (i: any) => { i.internalNote = "x"; }],
    ["billingTreatment fora do contrato", (i: any) => { i.serviceOrder.billingTreatment = "FREE"; }],
  ])("rejeita %s vindo do upstream", async (_label, mutate) => {
    const item = upstreamQueueItem();
    mutate(item);
    respond({ items: [item], meta: { limit: 50, total: 1 } });
    await expect(caller().finance.operationalQueue()).rejects.toBeTruthy();
  });
});
