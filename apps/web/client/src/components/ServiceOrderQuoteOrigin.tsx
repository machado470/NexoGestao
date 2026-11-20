import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { transientReadOptions } from "@/lib/read-query-retry";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { QuoteSummary, quoteMoney } from "./QuoteSummary";
import { Button } from "./ui/button";
export function ServiceOrderQuoteOrigin({
  serviceOrderId,
}: {
  serviceOrderId: string;
}) {
  const [, navigate] = useLocation(),
    { timezone, currency } = useOrganizationLocale(),
    query = trpc.serviceQuotes.orderOrigin.useQuery(
      { serviceOrderId },
      transientReadOptions
    );
  if (query.isLoading)
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Consultando origem comercial...
      </p>
    );
  if (query.isError)
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] p-3">
        <p className="text-sm">
          Não foi possível consultar a origem comercial. Os demais dados da O.S.
          continuam disponíveis.
        </p>
        <Button
          variant="outline"
          className="mt-2"
          onClick={() => void query.refetch()}
        >
          Consultar origem novamente
        </Button>
      </div>
    );
  const origin = query.data;
  if (!origin) return null;
  return (
    <section
      aria-label="Orçamento de origem"
      className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4"
    >
      <h3 className="font-semibold">Origem: orçamento aprovado</h3>
      <p className="mt-2 text-sm">
        Versão {origin.quoteVersion + 1} ·{" "}
        {quoteMoney(origin.amountCents, origin.currency)}
      </p>
      <p className="mt-2 break-words text-xs text-[var(--text-muted)]">
        Convertido por {origin.createdByName} ·{" "}
        {formatOrganizationDate(origin.createdAt, timezone)}
      </p>
      {origin.amountCents === 0 && (
        <p className="mt-2 text-sm">
          Total zero aprovado. Esta O.S. não gera cobrança vinculada.
        </p>
      )}
      {currency && currency !== origin.currency && (
        <p className="mt-2 text-sm">
          O valor aprovado permanece em {origin.currency}, mesmo com a moeda
          atual da empresa diferente.
        </p>
      )}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Valor e cliente da O.S. seguem o orçamento aprovado. Novas condições
        comerciais exigem outro orçamento; cancelamento da O.S. não cancela a
        aprovação.
      </p>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm">
          Ver itens e condições aprovados
        </summary>
        <QuoteSummary snapshot={origin.snapshot} />
      </details>
      <Button
        variant="outline"
        className="mt-3 min-h-11"
        onClick={() => navigate("/quotes?id=" + origin.quoteId)}
      >
        Ver orçamento de origem
      </Button>
    </section>
  );
}
