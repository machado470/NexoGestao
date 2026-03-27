import { trpc } from "@/lib/trpc";

export default function OperationalWorkflowPage() {
  const utils = trpc.useUtils();

  const chargesQuery = trpc.nexo.finance.charges.list.useQuery({
    page: 1,
    limit: 50,
  });

  const payMutation = trpc.finance.charges.pay.useMutation({
    onSuccess: () => {
      utils.finance.charges.list.invalidate();
      utils.finance.charges.stats.invalidate();
    },
  });

  const charges = chargesQuery.data?.items ?? [];

  const overdue = charges.filter((c) => c.status === "OVERDUE");
  const pending = charges.filter((c) => c.status === "PENDING");

  const handlePay = async (charge: any) => {
    await payMutation.mutateAsync({
      chargeId: charge.id,
      amountCents: charge.amountCents,
      method: "CASH",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Workflow Operacional</h1>

      {/* PRIORIDADE */}
      {overdue.length > 0 && (
        <div className="bg-red-900 p-4 rounded border border-red-500">
          <h2 className="font-semibold mb-3 text-red-400">
            🔴 AÇÃO URGENTE — Cobranças vencidas
          </h2>

          {overdue.map((c) => (
            <div
              key={c.id}
              className="flex justify-between items-center p-2 border-b border-red-700"
            >
              <div>
                <p>{c.customer?.name}</p>
                <p className="text-sm">
                  R$ {(c.amountCents / 100).toFixed(2)}
                </p>
              </div>

              <button
                onClick={() => handlePay(c)}
                className="bg-green-600 px-3 py-1 rounded text-sm"
              >
                Marcar como pago
              </button>
            </div>
          ))}
        </div>
      )}

      {/* PENDENTES */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="font-semibold mb-3">
          🟡 Cobranças pendentes ({pending.length})
        </h2>

        {pending.map((c) => (
          <div
            key={c.id}
            className="flex justify-between items-center p-2 border-b border-gray-700"
          >
            <div>
              <p>{c.customer?.name}</p>
              <p className="text-sm">
                R$ {(c.amountCents / 100).toFixed(2)}
              </p>
            </div>

            <button
              onClick={() => handlePay(c)}
              className="bg-blue-600 px-3 py-1 rounded text-sm"
            >
              Receber agora
            </button>
          </div>
        ))}

        {pending.length === 0 && (
          <p className="text-gray-400">Nada pendente.</p>
        )}
      </div>

      {/* ESTADO LIMPO */}
      {pending.length === 0 && overdue.length === 0 && (
        <div className="bg-green-900 p-4 rounded border border-green-500">
          <h2 className="text-green-400 font-semibold">
            ✅ Tudo em dia
          </h2>
          <p className="text-sm text-gray-300">
            Nenhuma cobrança pendente ou vencida.
          </p>
        </div>
      )}
    </div>
  );
}
