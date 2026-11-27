import { useEffect, useRef, useState } from "react";
import { AppSelect } from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export function ServiceOrderMaterials({ serviceOrderId, status }: {
  serviceOrderId: string;
  status: string;
}) {
  const active = status !== "DONE" && status !== "CANCELED";
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const attempts = useRef(new Map<string, string>());
  const previousStatus = useRef(status);
  const utils = trpc.useUtils();
  const reservations = trpc.commerce.reservations.useQuery({ serviceOrderId }, {
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const { refetch } = reservations;
  useEffect(() => {
    if (previousStatus.current !== status) {
      previousStatus.current = status;
      void refetch();
    }
  }, [status, refetch]);
  const products = trpc.commerce.products.useQuery({ q: query, page: 1 }, { enabled: active && editing });
  const reserve = trpc.commerce.reserve.useMutation();
  const consume = trpc.commerce.consumeReservation.useMutation();
  const release = trpc.commerce.releaseReservation.useMutation();

  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível confirmar a operação.");
    } finally {
      await Promise.allSettled([
        reservations.refetch(),
        utils.commerce.products.invalidate(),
        utils.commerce.movements.invalidate(),
      ]);
      lock.current = false;
      setBusy(false);
    }
  }

  async function saveReservation() {
    const count = Number(quantity);
    if (!productId || !Number.isInteger(count) || count < 1 || count > 1000000000) {
      setError("Selecione a peça e informe uma quantidade inteira válida.");
      return;
    }

    const fingerprint = JSON.stringify([productId, count]);
    const entryKey = attempts.current.get(fingerprint) ?? crypto.randomUUID();
    attempts.current.set(fingerprint, entryKey);
    await reserve.mutateAsync({ serviceOrderId, productId, quantity: count, entryKey });
    attempts.current.delete(fingerprint);
    setProductId("");
    setQuantity("1");
    setEditing(false);
  }

  return (
    <section aria-label="Materiais da O.S." className="grid min-w-0 gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Materiais da O.S.</h3>
        {active && !editing && <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Reservar peça</Button>}
      </div>
      {editing && active && (
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm">
            Buscar peça por nome ou SKU
            <Input type="search" maxLength={120} value={search} disabled={busy} onChange={e => setSearch(e.target.value)} />
          </label>
          <Button type="button" variant="outline" className="justify-self-start" disabled={busy} onClick={() => { setProductId(""); setQuery(search.trim()); }}>
            Buscar peças
          </Button>
          <AppSelect ariaLabel="Peça para reservar" value={productId}
            onValueChange={id => { if (!lock.current) setProductId(id); }} options={(products.data?.items ?? [])
              .filter(product => product.kind !== "PARENT" && product.onHand > product.reservedQuantity)
              .map(product => ({
                value: product.id,
                label: `${product.sku} · ${product.name} (${product.onHand - product.reservedQuantity} disponíveis)`,
              }))}
          />
          {products.isError && <p role="alert">Não foi possível consultar as peças.</p>}
          <label className="grid gap-1 text-sm">
            Quantidade
            <Input type="number" min={1} max={1000000000} step={1} value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy || !productId || products.isPending || products.isError} onClick={() => void run(saveReservation)}>Confirmar reserva</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>Fechar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {reservations.isPending && <p role="status">Carregando materiais.</p>}
      {reservations.isError && (
        <div role="alert">
          <p>Não foi possível consultar os materiais.</p>
          <Button type="button" variant="outline" onClick={() => void reservations.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {reservations.isSuccess && !reservations.data.length && <p className="text-sm">Nenhuma reserva nesta O.S.</p>}
      {reservations.isSuccess && reservations.data.map(item => {
        const pending = !item.consumedAt && !item.releasedAt;
        return (
          <div key={item.id} className="grid min-w-0 gap-2 border-t pt-2">
            <p className="break-words text-sm font-medium">{item.product.sku} · {item.product.name}</p>
            <p className="text-sm">{item.quantity} un. · {item.consumedAt ? "Consumida" : item.releasedAt ? "Liberada" : "Reservada"}</p>
            {active && pending && (
              <div className="flex flex-wrap gap-2">
                {status === "IN_PROGRESS" && (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => consume.mutateAsync({ id: item.id }))}>Confirmar consumo</Button>
                )}
                <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => release.mutateAsync({ id: item.id }))}>Liberar reserva</Button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
