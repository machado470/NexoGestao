import { BadRequestException } from "@nestjs/common";
export const quoteTermsMessage =
  "Esta O.S. preserva o valor, cliente e moeda do orçamento aprovado. Novas condições comerciais exigem outro orçamento.";
export function isQuoteTermsError(error: any) {
  return (
    String(error?.message ?? "") + JSON.stringify(error?.meta ?? {})
  ).includes("NEXO_QUOTE_TERMS_LOCKED");
}
export async function quoteChargeTerms(
  db: any,
  orgId: string,
  serviceOrderId: string,
  amountCents: number,
) {
  // Older unit-test doubles have no delegate; generated production clients always do.
  const terms = await db.serviceQuoteOrder?.findFirst({
    where: { orgId, serviceOrderId },
    select: { amountCents: true, currency: true },
  });
  if (terms && terms.amountCents !== amountCents)
    throw new BadRequestException(quoteTermsMessage);
  return terms ?? null;
}
