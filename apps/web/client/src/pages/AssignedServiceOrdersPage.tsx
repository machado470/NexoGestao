import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ServiceOrderChecklist } from "@/components/ServiceOrderChecklist";
import { ServiceOrderEvidence } from "@/components/ServiceOrderEvidence";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganizationLocale } from "@/contexts/OrganizationLocaleContext";
import { formatOrganizationDate } from "@/lib/organization-locale";
import { trpc } from "@/lib/trpc";

const statusLabels = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

export default function AssignedServiceOrdersPage() {
  const { logout } = useAuth();
  const { timezone } = useOrganizationLocale();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const orders = trpc.serviceOrders.assigned.useQuery({ page });
  const detail = trpc.serviceOrders.assignedDetail.useQuery(
    { id: selectedId ?? "" },
    { enabled: Boolean(selectedId), gcTime: 0, refetchOnWindowFocus: "always" }
  );

  const showList = () => {
    setSelectedId(null);
    void orders.refetch();
  };

  return (
    <main className="mx-auto grid w-full max-w-3xl min-w-0 gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Minhas ordens de serviço</h1>
        <Button variant="outline" className="min-h-11" onClick={() => void logout()}>Sair</Button>
      </header>
      {selectedId ? (
        <>
          <Button variant="outline" className="min-h-11 justify-self-start" onClick={showList}>
            Voltar às ordens
          </Button>
          {detail.isPending ? <p role="status">Carregando O.S.</p> : detail.isError ? (
            <div role="alert" className="grid gap-2">
              <p>Não foi possível abrir esta O.S. Verifique se ela continua atribuída a você.</p>
              <Button variant="outline" className="justify-self-start" onClick={() => void detail.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <section className="grid min-w-0 gap-4">
              <div>
                <h2 className="break-words text-xl font-semibold">{detail.data.title}</h2>
                <p>{statusLabels[detail.data.status]}</p>
                {detail.data.description && <p className="mt-2 whitespace-pre-wrap break-words">{detail.data.description}</p>}
              </div>
              <ServiceOrderChecklist key={`checklist-${detail.data.id}`} serviceOrderId={detail.data.id} status={detail.data.status} canWrite allowTaskCreation={false} />
              <ServiceOrderEvidence key={detail.data.id} serviceOrderId={detail.data.id} status={detail.data.status} canWrite />
            </section>
          )}
        </>
      ) : orders.isPending ? <p role="status">Carregando ordens.</p> : orders.isError ? (
        <div role="alert" className="grid gap-2">
          <p>Não foi possível consultar suas ordens.</p>
          <Button variant="outline" className="justify-self-start" onClick={() => void orders.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          {orders.data.items.length === 0 && <p>Nenhuma O.S. nesta página.</p>}
          <ul className="grid gap-2">
            {orders.data.items.map(order => (
              <li key={order.id}>
                <button type="button" className="grid min-h-11 w-full min-w-0 gap-1 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2" onClick={() => setSelectedId(order.id)}>
                  <span className="break-words font-semibold">{order.title}</span>
                  <span className="text-sm">{statusLabels[order.status]}{order.scheduledFor ? ` · ${formatOrganizationDate(order.scheduledFor, timezone)}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          {(page > 1 || orders.data.nextPage) && (
            <nav aria-label="Páginas das ordens" className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" disabled={!orders.data.nextPage} onClick={() => setPage(page + 1)}>Próxima</Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
