type MutationRuntime = {
  generateChargeFromServiceOrder: (serviceOrderId: string) => Promise<unknown>;
  payCharge: (input: {
    chargeId: string;
    amountCents: number;
    method: "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER";
  }) => Promise<unknown>;
  invalidateOperationalData: () => Promise<void>;
};

type MutationPayload = Record<string, unknown> | undefined;

function readString(payload: MutationPayload, key: string) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(payload: MutationPayload, key: string) {
  const value = payload?.[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return null;
}

export async function runExecutionMutation(
  mutationKey: string,
  payload: MutationPayload,
  runtime: MutationRuntime
) {
  if (mutationKey === "service_order.generate_charge") {
    const serviceOrderId = readString(payload, "serviceOrderId");
    if (!serviceOrderId) {
      throw new Error("serviceOrderId é obrigatório para gerar cobrança.");
    }

    await runtime.generateChargeFromServiceOrder(serviceOrderId);
    await runtime.invalidateOperationalData();
    return { message: "Cobrança gerada com sucesso." };
  }

  if (mutationKey === "finance.charge.mark_paid") {
    const chargeId = readString(payload, "chargeId");
    const amountCents = readNumber(payload, "amountCents");

    if (!chargeId || amountCents === null) {
      throw new Error("chargeId e amountCents são obrigatórios para registrar pagamento.");
    }

    await runtime.payCharge({
      chargeId,
      amountCents,
      method: "PIX",
    });
    await runtime.invalidateOperationalData();
    return { message: "Pagamento registrado com sucesso." };
  }

  throw new Error(`Mutation não mapeada: ${mutationKey}`);
}
