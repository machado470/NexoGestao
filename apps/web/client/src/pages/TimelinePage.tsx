import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function TimelinePage() {
  const [customerId, setCustomerId] = useState<string>("");

  const customersQuery = trpc.nexo.customers.list.useQuery();
  const timelineQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId, limit: 100 },
    { enabled: !!customerId }
  );

  const customers = Array.isArray(customersQuery.data)
    ? customersQuery.data
    : customersQuery.data?.data ?? [];

  const events = Array.isArray(timelineQuery.data?.data)
    ? timelineQuery.data.data
    : Array.isArray(timelineQuery.data)
      ? timelineQuery.data
      : [];

  useEffect(() => {
    if (!customerId && customers.length > 0 && customers[0]?.id) {
      setCustomerId(String(customers[0].id));
    }
  }, [customerId, customers]);

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Timeline do Cliente</h1>
        <p className="text-sm opacity-70">
          Histórico de eventos vinculados ao cliente selecionado.
        </p>
      </div>

      <div className="rounded border p-4 space-y-3">
        <label className="block text-sm font-medium">Cliente</label>

        {customersQuery.isLoading ? (
          <div className="text-sm opacity-70">Carregando clientes...</div>
        ) : customers.length === 0 ? (
          <div className="text-sm opacity-70">Nenhum cliente encontrado.</div>
        ) : (
          <select
            className="w-full rounded border px-3 py-2"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Eventos</h2>

        {!customerId ? (
          <div className="text-sm opacity-70">
            Selecione um cliente para ver a timeline.
          </div>
        ) : timelineQuery.isLoading ? (
          <div className="text-sm opacity-70">Carregando eventos...</div>
        ) : events.length === 0 ? (
          <div className="text-sm opacity-70">
            Nenhum evento encontrado para este cliente.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event: any) => (
              <div key={event.id} className="rounded border p-3">
                <div className="font-medium">
                  {event.action ?? event.type ?? "Evento"}
                </div>

                <div className="text-sm opacity-70">
                  {event.description ?? "Sem descrição"}
                </div>

                <div className="mt-1 text-xs opacity-60">
                  {event.createdAt
                    ? new Date(event.createdAt).toLocaleString("pt-BR")
                    : "Data indisponível"}
                </div>

                {event.metadata ? (
                  <pre className="mt-3 overflow-auto rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
