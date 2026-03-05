import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Briefcase, CalendarClock, CheckCircle2, Clock3, CreditCard, PlayCircle, RefreshCw, Users } from "lucide-react";

type Customer = { id: string; name: string; phone?: string; email?: string; active?: boolean };

const appointmentActions = ["SCHEDULED", "CONFIRMED", "DONE", "NO_SHOW", "CANCELED"] as const;
const serviceOrderActions = ["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "CANCELED"] as const;
const chargeActions = ["PENDING", "OVERDUE", "PAID", "CANCELED"] as const;

function statusTone(status?: string) {
  if (!status) return "bg-gray-100 text-gray-700";
  if (["DONE", "PAID", "CONFIRMED"].includes(status)) return "bg-green-100 text-green-700";
  if (["IN_PROGRESS", "ASSIGNED", "OVERDUE", "NO_SHOW"].includes(status)) return "bg-amber-100 text-amber-700";
  if (["CANCELED"].includes(status)) return "bg-rose-100 text-rose-700";
  return "bg-blue-100 text-blue-700";
}

export default function OperationalWorkflowPage() {
  const utils = trpc.useUtils();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [completionAmount, setCompletionAmount] = useState<string>("0");
  const [completionDueDate, setCompletionDueDate] = useState<string>(new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10));

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { refetchOnWindowFocus: false });

  const customers = useMemo(() => {
    return (customersQuery.data?.data ?? customersQuery.data ?? []) as Customer[];
  }, [customersQuery.data]);

  const selectedId = selectedCustomerId || customers[0]?.id;

  const workspaceQuery = trpc.nexo.customers.workspace.useQuery(
    { id: selectedId ?? "" },
    { enabled: Boolean(selectedId), refetchOnWindowFocus: false },
  );

  const workspace = workspaceQuery.data?.data ?? workspaceQuery.data;

  const updateAppointment = trpc.nexo.appointments.update.useMutation({
    onSuccess: async () => {
      toast.success("Status do agendamento atualizado");
      await workspaceQuery.refetch();
      await utils.nexo.timeline.listByCustomer.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: async () => {
      toast.success("Ordem de serviço atualizada");
      await workspaceQuery.refetch();
      await utils.nexo.timeline.listByCustomer.invalidate();
      await utils.nexo.finance.charges.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCharge = trpc.nexo.finance.charges.update.useMutation({
    onSuccess: async () => {
      toast.success("Cobrança atualizada");
      await workspaceQuery.refetch();
      await utils.nexo.timeline.listByCustomer.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-orange-500" />
            Workflow Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Fluxo canônico: Cliente → Agendamento → Ordem de Serviço → Execução → Cobrança/Pagamento → Timeline.
          </p>
        </div>
        <Button variant="outline" onClick={() => void workspaceQuery.refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar workspace
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Workspace do cliente</CardTitle>
          <CardDescription>Selecione um cliente para ver e operar o ciclo completo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="h-10 w-full rounded-md border px-3"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {workspace?.customer && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-3"><span className="text-muted-foreground">Cliente</span><p className="font-medium">{workspace.customer.name}</p></div>
              <div className="rounded border p-3"><span className="text-muted-foreground">Agendamentos</span><p className="font-medium">{workspace.appointments?.length ?? 0}</p></div>
              <div className="rounded border p-3"><span className="text-muted-foreground">Ordens de serviço</span><p className="font-medium">{workspace.serviceOrders?.length ?? 0}</p></div>
              <div className="rounded border p-3"><span className="text-muted-foreground">Cobranças</span><p className="font-medium">{workspace.charges?.length ?? 0}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Ciclo de Agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(workspace?.appointments ?? []).map((a: any) => (
              <div key={a.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.title || "Agendamento"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.startsAt).toLocaleString("pt-BR")}</p>
                  </div>
                  <Badge className={statusTone(a.status)}>{a.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {appointmentActions.map((status) => (
                    <Button key={status} size="sm" variant={a.status === status ? "default" : "outline"} onClick={() => updateAppointment.mutate({ id: a.id, data: { status } })}>
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Briefcase className="w-4 h-4" /> Ciclo da Ordem de Serviço + Execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(workspace?.serviceOrders ?? []).map((so: any) => (
              <div key={so.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{so.title}</p>
                    <p className="text-xs text-muted-foreground">Prioridade: {so.priority}</p>
                  </div>
                  <Badge className={statusTone(so.status)}>{so.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {serviceOrderActions.map((status) => (
                    <Button key={status} size="sm" variant={so.status === status ? "default" : "outline"} onClick={() => updateServiceOrder.mutate({ id: so.id, data: { status } })}>
                      {status}
                    </Button>
                  ))}
                  <Button size="sm" onClick={() => updateServiceOrder.mutate({ id: so.id, data: { status: "IN_PROGRESS" } })}>
                    <Clock3 className="w-4 h-4 mr-1" /> Iniciar execução
                  </Button>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input type="number" min={1} placeholder="Valor (R$)" value={completionAmount} onChange={(e) => setCompletionAmount(e.target.value)} />
                  <Input type="date" value={completionDueDate} onChange={(e) => setCompletionDueDate(e.target.value)} />
                  <Button onClick={() => updateServiceOrder.mutate({ id: so.id, data: { status: "DONE", amountCents: Math.round(Number(completionAmount || 0) * 100), dueDate: new Date(`${completionDueDate}T12:00:00`).toISOString() } })}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Concluir + gerar cobrança
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Financeiro: cobrança e pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(workspace?.charges ?? []).map((charge: any) => (
              <div key={charge.id} className="rounded border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">R$ {(Number(charge.amountCents || 0) / 100).toFixed(2)}</p>
                  <Badge className={statusTone(charge.status)}>{charge.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Venc.: {charge.dueDate ? new Date(charge.dueDate).toLocaleDateString("pt-BR") : "-"}</p>
                <div className="flex flex-wrap gap-2">
                  {chargeActions.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={charge.status === status ? "default" : "outline"}
                      onClick={() => updateCharge.mutate({ id: charge.id, data: { status, paidAt: status === "PAID" ? new Date().toISOString() : undefined } })}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline do Cliente</CardTitle>
            <CardDescription>Visualização cronológica dos eventos operacionais.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[420px] overflow-y-auto">
              {(workspace?.timeline ?? []).map((event: any) => (
                <div key={event.id} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <div className="rounded border p-3">
                    <p className="font-medium text-sm">{event.action}</p>
                    <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                    {event.description && <p className="text-sm mt-1">{event.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
