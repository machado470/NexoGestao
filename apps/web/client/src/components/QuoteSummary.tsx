import { formatRecordedMoney } from "@/lib/organization-locale";
export const quoteMoney = (value: number, currency: string) =>
  formatRecordedMoney(value, currency, "Indisponível");
export function QuoteSummary({
  snapshot,
}: {
  snapshot: {
    title: string;
    conditions: string;
    currency: string;
    totalCents: number;
    items: Array<{
      name: string;
      description: string;
      quantity: number;
      unitCents: number;
      lineCents: number;
    }>;
  };
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <h2 className="break-words text-lg font-semibold">{snapshot.title}</h2>
      <ul className="grid min-w-0 gap-3">
        {snapshot.items.map((line, index) => (
          <li
            key={index}
            className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
          >
            <p className="break-words font-medium">{line.name}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {line.quantity} × {quoteMoney(line.unitCents, snapshot.currency)}
            </p>
            <p className="mt-1 font-semibold">
              {quoteMoney(line.lineCents, snapshot.currency)}
            </p>
            {line.description && (
              <details className="mt-2 text-sm">
                <summary className="min-h-11 cursor-pointer py-3">
                  Descrição do item
                </summary>
                <p className="whitespace-pre-wrap break-words">
                  {line.description}
                </p>
              </details>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xl font-semibold">
        Total: {quoteMoney(snapshot.totalCents, snapshot.currency)}
      </p>
      <div>
        <h3 className="font-semibold">Condições do orçamento</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">
          {snapshot.conditions}
        </p>
      </div>
    </div>
  );
}
