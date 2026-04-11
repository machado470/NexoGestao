import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AppNextActions } from "@/components/app/AppNextActions";

function toArray<T>(payload: unknown): T[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

export function GlobalActionEngine() {
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { retry: false, refetchOnWindowFocus: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { retry: false, refetchOnWindowFocus: false });

  const customers = useMemo(() => toArray<any>(customersQuery.data), [customersQuery.data]);
  const appointments = useMemo(() => toArray<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrders = useMemo(() => toArray<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const charges = useMemo(() => toArray<any>(chargesQuery.data), [chargesQuery.data]);

  return (
    <div className="px-3 pb-3 pt-2 md:px-4">
      <AppNextActions
        title="Engine de execução operacional"
        engineInput={{
          customers: customers.map(item => ({
            id: item.id,
            name: item.name,
            phone: item.phone ?? null,
            lastContactAt: item.lastContactAt ?? null,
          })),
          appointments: appointments.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            startsAt: item.startsAt,
          })),
          serviceOrders: serviceOrders.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            delayedMinutes: item.delayedMinutes ?? 0,
            updatedAt: item.updatedAt,
          })),
          charges: charges.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            amountCents: item.amountCents,
            dueDate: item.dueDate,
          })),
        }}
      />
    </div>
  );
}
