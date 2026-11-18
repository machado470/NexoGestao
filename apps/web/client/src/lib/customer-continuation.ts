export type CustomerNextStep =
  "schedule" | "message" | "billing" | "only_register";

/** Explicit navigation only: no message, charge or appointment is created here. */
export function customerContinuation(
  customerId: string,
  step: CustomerNextStep
) {
  if (!customerId.trim() || step === "only_register") return null;
  const params = new URLSearchParams({
    customerId,
    source: "customer_created",
  });
  if (step === "message")
    return { label: "Abrir WhatsApp", href: `/whatsapp?${params}` };
  params.set("action", "create");
  return step === "schedule"
    ? { label: "Criar agendamento", href: `/appointments?${params}` }
    : { label: "Criar cobrança", href: `/finances?${params}` };
}
