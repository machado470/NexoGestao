export const BILLABLE_TREATMENTS = ["STANDARD", "RETURN_BILLABLE"] as const;
export function isBillableTreatment(value?: string | null): boolean {
  return value == null || value === "STANDARD" || value === "RETURN_BILLABLE";
}
export function isReturnBillingBlock(error: any): boolean {
  return (
    String(error?.message ?? "") + JSON.stringify(error?.meta ?? {})
  ).includes("NEXO_RETURN_BILLING_BLOCKED");
}
import { BadRequestException } from "@nestjs/common";
export class ReturnBillingBlockedException extends BadRequestException {
  constructor() {
    super("A condição comercial deste retorno não permite cobrança.");
  }
}
