import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type StepKey =
  | "company"
  | "customer"
  | "appointment"
  | "serviceOrder"
  | "charge";

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
  const { user, isAuthenticated, isInitializing } = useAuth();
  const utils = trpc.useUtils();

  const canQuery = isAuthenticated && !isInitializing;

  const [progress, setProgress] = useState<Progress>(BASE_PROGRESS);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("Primeiro atendimento");
  const [serviceOrderTitle, setServiceOrderTitle] = useState("Primeira ordem de serviço");
  const [chargeAmount, setChargeAmount] = useState("150");

  const storageKey = useMemo(
    () => `pilot-onboarding:${user?.id ?? "anon"}`,
    [user?.id]
  );

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    {
      page: 1,
      limit: 20,
    } as any,
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page: 1,
      limit: 20,
    } as any,
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 20,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const companyMutation = trpc.nexo.settings.update.useMutation();
  const customerMutation = trpc.nexo.customers.create.useMutation();
  const appointmentMutation = trpc.nexo.appointments.create.useMutation();
  const serviceOrderMutation = trpc.nexo.serviceOrders.create.useMutation();
  const chargeMutation = trpc.finance.charges.create.useMutation();
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
    if (!canQuery) return;

    const customersPayload =
      (customersQuery.data as any)?.data ?? customersQuery.data ?? [];
    const appointmentsPayload =
      (appointmentsQuery.data as any)?.data ??
      (appointmentsQuery.data as any)?.items ??
      appointmentsQuery.data ??
      [];
    const serviceOrdersPayload =
      (serviceOrdersQuery.data as any)?.data ??
      (serviceOrdersQuery.data as any)?.items ??
      serviceOrdersQuery.data ??
      [];
    const chargesPayload =
      (chargesQuery.data as any)?.data ??
      (chargesQuery.data as any)?.items ??
      chargesQuery.data ??
      [];

    const hasCustomer = Array.isArray(customersPayload) && customersPayload.length > 0;
    const hasAppointment =
      Array.isArray(appointmentsPayload) && appointmentsPayload.length > 0;
    const hasServiceOrder =
      Array.isArray(serviceOrdersPayload) && serviceOrdersPayload.length > 0;
    const hasCharge = Array.isArray(chargesPayload) && chargesPayload.length > 0;

    setProgress((prev) => ({
      ...prev,
      customer: prev.customer || hasCustomer,
      appointment: prev.appointment || hasAppointment,
      serviceOrder: prev.serviceOrder || hasServiceOrder,
      charge: prev.charge || hasCharge,
    }));
  }, [
    canQuery,
    customersQuery.data,
    appointmentsQuery.data,
    serviceOrdersQuery.data,
    chargesQuery.data,
  ]);

  const firstCustomer =
    ((customersQuery.data as any)?.data ?? customersQuery.data ?? [])[0];

  const canRun = {
    company: true,
    customer: progress.company,
    appointment: progress.customer,
    serviceOrder: progress.appointment,
    charge: progress.serviceOrder,
  } as const;

  const completeStep = (key: StepKey) =>
    setProgress((prev) => ({ ...prev, [key]: true }));

  const finish = async () => {
    await completeOnboardingMutation.mutateAsync();
    navigate("/dashboard");
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
            Carregando sessão...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
            Faça login para continuar o onboarding.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Onboarding guiado (piloto)</h1>
        <p className="text-sm opacity-75">
          Fluxo persistente: empresa → cliente → agendamento → OS → cobrança.
        </p>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">1) Perfil da empresa</h2>
          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            placeholder="Nome fantasia"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <Button
            className="mt-2"
            disabled={!canRun.company || progress.company || companyMutation.isPending}
            onClick={async () => {
              setError(null);

              try {
                if (!companyName.trim()) {
                  throw new Error("Informe o nome da empresa.");
                }

                await companyMutation.mutateAsync({
                  name: companyName.trim(),
                });

                completeStep("company");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {progress.company ? "Concluído" : "Salvar perfil"}
          </Button>
        </section>

        <section className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">2) Primeiro cliente</h2>

          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            placeholder="Nome do cliente"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            placeholder="Telefone (WhatsApp)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />

          <p className="mt-1 text-xs opacity-70">
            Pode informar com +55 ou só números. O backend normaliza.
          </p>

          <Button
            className="mt-2"
            disabled={!canRun.customer || progress.customer || customerMutation.isPending}
            onClick={async () => {
              setError(null);

              try {
                if (!customerName.trim()) {
                  throw new Error("Informe o nome do cliente.");
                }

                if (!customerPhone.trim()) {
                  throw new Error("Informe o telefone do cliente.");
                }

                await customerMutation.mutateAsync({
                  name: customerName.trim(),
                  phone: customerPhone.trim(),
                });

                await utils.nexo.customers.list.invalidate();
                completeStep("customer");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {progress.customer ? "Concluído" : "Criar cliente"}
          </Button>
        </section>

        <section className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">3) Primeiro agendamento</h2>
          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            value={appointmentNotes}
            onChange={(e) => setAppointmentNotes(e.target.value)}
            placeholder="Observação do agendamento"
          />
          <Button
            className="mt-2"
            disabled={
              !canRun.appointment ||
              progress.appointment ||
              appointmentMutation.isPending
            }
            onClick={async () => {
              setError(null);

              try {
                if (!firstCustomer?.id) {
                  throw new Error("Crie um cliente primeiro.");
                }

                const startsAt = new Date();
                const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

                await appointmentMutation.mutateAsync({
                  customerId: String(firstCustomer.id),
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  notes: appointmentNotes.trim() || "Primeiro atendimento",
                  status: "SCHEDULED",
                });

                await utils.nexo.appointments.list.invalidate();
                completeStep("appointment");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {progress.appointment ? "Concluído" : "Criar agendamento"}
          </Button>
        </section>

        <section className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">4) Primeira ordem de serviço</h2>
          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            value={serviceOrderTitle}
            onChange={(e) => setServiceOrderTitle(e.target.value)}
          />
          <Button
            className="mt-2"
            disabled={
              !canRun.serviceOrder ||
              progress.serviceOrder ||
              serviceOrderMutation.isPending
            }
            onClick={async () => {
              setError(null);

              try {
                if (!firstCustomer?.id) {
                  throw new Error("Crie um cliente primeiro.");
                }

                if (!serviceOrderTitle.trim()) {
                  throw new Error("Informe o título da ordem de serviço.");
                }

                await serviceOrderMutation.mutateAsync({
                  customerId: String(firstCustomer.id),
                  title: serviceOrderTitle.trim(),
                  priority: 2,
                });

                await utils.nexo.serviceOrders.list.invalidate();
                completeStep("serviceOrder");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {progress.serviceOrder ? "Concluído" : "Criar OS"}
          </Button>
        </section>

        <section className="rounded-xl border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">5) Primeira cobrança</h2>
          <input
            className="mt-2 w-full rounded border p-2 dark:bg-zinc-950"
            type="number"
            min="1"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
          />
          <Button
            className="mt-2"
            disabled={!canRun.charge || progress.charge || chargeMutation.isPending}
            onClick={async () => {
              setError(null);

              try {
                if (!firstCustomer?.id) {
                  throw new Error("Crie um cliente primeiro.");
                }

                const amount = Number(chargeAmount);
                if (!amount || amount <= 0) {
                  throw new Error("Informe um valor de cobrança válido.");
                }

                await chargeMutation.mutateAsync({
                  customerId: String(firstCustomer.id),
                  amount,
                  dueDate: new Date(),
                  notes: "Primeira cobrança",
                });

                await utils.finance.charges.list.invalidate();
                completeStep("charge");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {progress.charge ? "Concluído" : "Criar cobrança"}
          </Button>
        </section>

        <Button
          disabled={!progress.charge || completeOnboardingMutation.isPending}
          onClick={() => void finish()}
        >
          Finalizar onboarding
        </Button>
      </div>
    </div>
  );
}
