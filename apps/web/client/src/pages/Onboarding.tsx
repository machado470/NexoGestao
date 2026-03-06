import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type StepKey = "company" | "customer" | "appointment" | "serviceOrder" | "charge";

type Progress = Record<StepKey, boolean>;

const BASE_PROGRESS: Progress = {
  company: false,
  customer: false,
  appointment: false,
  serviceOrder: false,
  charge: false,
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [progress, setProgress] = useState<Progress>(BASE_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [appointmentTitle, setAppointmentTitle] = useState("Primeiro atendimento");
  const [serviceOrderTitle, setServiceOrderTitle] = useState("Primeira ordem de serviço");
  const [chargeAmount, setChargeAmount] = useState("150");

  const storageKey = useMemo(() => `pilot-onboarding:${user?.id ?? "anon"}`, [user?.id]);

  const customersQuery = trpc.nexo.customers.list.useQuery();
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery({ page: 1, limit: 20 });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 20 });
  const chargesQuery = trpc.nexo.finance.charges.list.useQuery({ page: 1, limit: 20 });

  const companyMutation = trpc.nexo.settings.update.useMutation();
  const customerMutation = trpc.nexo.customers.create.useMutation();
  const appointmentMutation = trpc.nexo.appointments.create.useMutation();
  const serviceOrderMutation = trpc.nexo.serviceOrders.create.useMutation();
  const chargeMutation = trpc.nexo.finance.charges.create.useMutation();
  const completeOnboardingMutation = trpc.nexo.onboarding.complete.useMutation();

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setProgress({ ...BASE_PROGRESS, ...JSON.parse(raw) });
      } catch {
        setProgress(BASE_PROGRESS);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [progress, storageKey]);

  useEffect(() => {
    const hasCustomer = ((customersQuery.data as any)?.data ?? customersQuery.data ?? []).length > 0;
    const hasAppointment = ((appointmentsQuery.data as any)?.data ?? []).length > 0;
    const hasServiceOrder = ((serviceOrdersQuery.data as any)?.data ?? []).length > 0;
    const hasCharge = ((chargesQuery.data as any)?.data ?? []).length > 0;

    setProgress((prev) => ({
      ...prev,
      customer: prev.customer || hasCustomer,
      appointment: prev.appointment || hasAppointment,
      serviceOrder: prev.serviceOrder || hasServiceOrder,
      charge: prev.charge || hasCharge,
    }));
  }, [customersQuery.data, appointmentsQuery.data, serviceOrdersQuery.data, chargesQuery.data]);

  const firstCustomer = ((customersQuery.data as any)?.data ?? customersQuery.data ?? [])[0];

  const canRun = {
    company: true,
    customer: progress.company,
    appointment: progress.customer,
    serviceOrder: progress.appointment,
    charge: progress.serviceOrder,
  } as const;

  const completeStep = (key: StepKey) => setProgress((p) => ({ ...p, [key]: true }));

  const finish = async () => {
    await completeOnboardingMutation.mutateAsync();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Onboarding guiado (piloto)</h1>
        <p className="text-sm opacity-75">Fluxo persistente: empresa → cliente → agendamento → OS → cobrança.</p>

        {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold">1) Perfil da empresa</h2>
          <input className="mt-2 w-full rounded border p-2 dark:bg-zinc-950" placeholder="Nome fantasia" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <Button className="mt-2" disabled={!canRun.company || progress.company || companyMutation.isPending} onClick={async () => {
            setError(null);
            try {
              if (!companyName.trim()) throw new Error("Informe o nome da empresa.");
              await companyMutation.mutateAsync({ companyName: companyName.trim() });
              completeStep("company");
            } catch (e) {
              setError((e as Error).message);
            }
          }}>{progress.company ? "Concluído" : "Salvar perfil"}</Button>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold">2) Primeiro cliente</h2>
          <input className="mt-2 w-full rounded border p-2 dark:bg-zinc-950" placeholder="Nome do cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Button className="mt-2" disabled={!canRun.customer || progress.customer || customerMutation.isPending} onClick={async () => {
            setError(null);
            try {
              if (!customerName.trim()) throw new Error("Informe o nome do cliente.");
              await customerMutation.mutateAsync({ name: customerName.trim() });
              await utils.nexo.customers.list.invalidate();
              completeStep("customer");
            } catch (e) {
              setError((e as Error).message);
            }
          }}>{progress.customer ? "Concluído" : "Criar cliente"}</Button>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold">3) Primeiro agendamento</h2>
          <input className="mt-2 w-full rounded border p-2 dark:bg-zinc-950" value={appointmentTitle} onChange={(e) => setAppointmentTitle(e.target.value)} />
          <Button className="mt-2" disabled={!canRun.appointment || progress.appointment || appointmentMutation.isPending} onClick={async () => {
            setError(null);
            try {
              if (!firstCustomer?.id) throw new Error("Crie um cliente primeiro.");
              await appointmentMutation.mutateAsync({ customerId: String(firstCustomer.id), title: appointmentTitle, startsAt: new Date().toISOString() });
              await utils.nexo.appointments.list.invalidate();
              completeStep("appointment");
            } catch (e) {
              setError((e as Error).message);
            }
          }}>{progress.appointment ? "Concluído" : "Criar agendamento"}</Button>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold">4) Primeira ordem de serviço</h2>
          <input className="mt-2 w-full rounded border p-2 dark:bg-zinc-950" value={serviceOrderTitle} onChange={(e) => setServiceOrderTitle(e.target.value)} />
          <Button className="mt-2" disabled={!canRun.serviceOrder || progress.serviceOrder || serviceOrderMutation.isPending} onClick={async () => {
            setError(null);
            try {
              if (!firstCustomer?.id) throw new Error("Crie um cliente primeiro.");
              await serviceOrderMutation.mutateAsync({ customerId: String(firstCustomer.id), title: serviceOrderTitle, priority: "MEDIUM" });
              await utils.nexo.serviceOrders.list.invalidate();
              completeStep("serviceOrder");
            } catch (e) {
              setError((e as Error).message);
            }
          }}>{progress.serviceOrder ? "Concluído" : "Criar OS"}</Button>
        </section>

        <section className="rounded-xl border p-4 bg-white dark:bg-zinc-900">
          <h2 className="font-semibold">5) Primeira cobrança</h2>
          <input className="mt-2 w-full rounded border p-2 dark:bg-zinc-950" type="number" min="1" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
          <Button className="mt-2" disabled={!canRun.charge || progress.charge || chargeMutation.isPending} onClick={async () => {
            setError(null);
            try {
              if (!firstCustomer?.id) throw new Error("Crie um cliente primeiro.");
              const amount = Math.round(Number(chargeAmount) * 100);
              if (!amount) throw new Error("Informe um valor de cobrança válido.");
              await chargeMutation.mutateAsync({ customerId: String(firstCustomer.id), description: "Primeira cobrança", amountCents: amount, dueDate: new Date().toISOString() });
              await utils.nexo.finance.charges.list.invalidate();
              completeStep("charge");
            } catch (e) {
              setError((e as Error).message);
            }
          }}>{progress.charge ? "Concluído" : "Criar cobrança"}</Button>
        </section>

        <Button disabled={!progress.charge || completeOnboardingMutation.isPending} onClick={finish}>
          Finalizar onboarding
        </Button>
      </div>
    </div>
  );
}
