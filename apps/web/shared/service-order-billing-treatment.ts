import { z } from "zod";

/**
 * Values accepted by the `ServiceOrder_billingTreatment` CHECK constraint
 * (prisma/migrations/20261119220000_quote_order_conversion/migration.sql).
 */
export const SERVICE_ORDER_BILLING_TREATMENTS = [
  "STANDARD",
  "RETURN_PENDING",
  "RETURN_COVERED",
  "RETURN_BILLABLE",
  "QUOTE_NO_CHARGE",
] as const;

export const serviceOrderBillingTreatmentSchema = z.enum(
  SERVICE_ORDER_BILLING_TREATMENTS
);

/**
 * The API keeps `billingTreatment` out of the public ServiceOrder DTO
 * (ServiceOrderPublicShapeInterceptor), but service orders nested in charges
 * and in the customer workspace still carry it. Strict schemas validate the
 * value and then drop it with this helper, so the public shape stays stable.
 */
export function withoutBillingTreatment<
  T extends { billingTreatment?: unknown },
>({ billingTreatment: _private, ...publicOrder }: T): Omit<T, "billingTreatment"> {
  return publicOrder;
}
