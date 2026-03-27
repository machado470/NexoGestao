import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Wrench,
  PlayCircle,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { useChargeActions } from "@/hooks/useChargeActions";
import { formatCurrency } from "@/lib/utils";

export default function OperationalWorkflowPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  //  controle por chargeId
  const [sendingIds, setSendingIds] = useState<string[]>([]);

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const chargesQuery = trpc.nexo.finance.charges.list.useQuery({
    page: 1,
    limit: 50,
  });

  const sendWhatsApp = trpc.nexo.whatsapp.send.useMutation({
    onSuccess: (_data, variables: any) => {
      utils.nexo.whatsapp.messages.invalidate();
      toast.success("Mensagem enviada via WhatsApp");

      setSendingIds((prev) =>
        prev.filter((id) => id !== variables.meta?.chargeId)
      );
    },
    onError: (err, variables: any) => {
      toast.error(err.message || "Erro ao enviar mensagem");

      setSendingIds((prev) =>
        prev.filter((id) => id !== variables.meta?.chargeId)
      );
    },
  });

  const serviceOrders = serviceOrdersQuery.data?.data ?? [];
  const charges = chargesQuery.data?.data ?? [];

  const actionableOrders = useMemo(
    () =>
      serviceOrders.filter(
        (o) => o.status === "OPEN" || o.status === "ASSIGNED"
      ),
    [serviceOrders]
  );

  const doneWithoutCharge = useMemo(
    () =>
      serviceOrders.filter(
        (o) => o.status === "DONE" && !o.chargeId
      ),
    [serviceOrders]
  );

  const overdueCharges = useMemo(
    () => charges.filter((c) => c.status === "OVERDUE"),
    [charges]
  );

  const pendingCharges = useMemo(
    () => charges.filter((c) => c.status === "PENDING"),
    [charges]
  );

  const { registerPayment, generateCheckout, isSubmitting } =
    useChargeActions({
      navigate,
      returnPath: "/dashboard/operations",
    });

  const handleStart = (id: string) => {
    trpc.nexo.serviceOrders.update.mutate({
      id,
      data: { status: "IN_PROGRESS" },
    });
  };

  const handleFinish = (id: string) => {
    trpc.nexo.serviceOrders.update.mutate({
      id,
      data: { status: "DONE" },
    });
  };

  //  envio por chargeId
  const handleSendWhatsApp = (c: any) => {
    if (sendingIds.includes(c.id)) return;

    const firstName = c.customer?.name?.split(" ")[0] || "cliente";

    const message = `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida no valor de ${formatCurrency(
      c.amountCents
    )}. Posso te enviar o link de pagamento?`;

    setSendingIds((prev) => [...prev, c.id]);

    sendWhatsApp.mutate({
      customerId: c.customerId,
      content: message,
      meta: { chargeId: c.id }, //  chave
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wrench className="h-6 w-6 text-orange-500" />
          Workflow Operacional
        </h1>

        <Button
          variant="outline"
          onClick={() => {
            chargesQuery.refetch();
            serviceOrdersQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* EXECUTAR */}
      <Card>
        <CardHeader>
          <CardTitle>Executar agora</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {actionableOrders.map((o) => (
            <div key={o.id} className="border rounded-lg p-3">
              <p className="font-semibold">{o.title}</p>

              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => handleStart(o.id)}>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>

                <Button size="sm" onClick={() => handleFinish(o.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Concluir
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* COBRAR */}
      <Card>
        <CardHeader>
          <CardTitle>Cobrar agora</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {doneWithoutCharge.map((o) => (
            <div key={o.id} className="border rounded-lg p-3">
              <p className="font-semibold">{o.title}</p>

              <Button
                size="sm"
                onClick={() =>
                  navigate(`/finances?serviceOrderId=${o.id}`)
                }
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Gerar cobrança
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* VENCIDAS */}
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            Cobranças vencidas
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {overdueCharges.map((c) => {
            const isSending = sendingIds.includes(c.id);

            return (
              <div key={c.id} className="border rounded-lg p-3">
                <p>{c.customer?.name}</p>
                <p>{formatCurrency(c.amountCents)}</p>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => generateCheckout(c)}
                    disabled={isSubmitting}
                  >
                    Cobrar
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendWhatsApp(c)}
                    disabled={isSending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    {isSending ? "Enviando..." : "WhatsApp"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* PENDENTES */}
      <Card>
        <CardHeader>
          <CardTitle>Cobranças pendentes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {pendingCharges.map((c) => (
            <div key={c.id} className="border rounded-lg p-3">
              <p>{c.customer?.name}</p>
              <p>{formatCurrency(c.amountCents)}</p>

              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  onClick={() => generateCheckout(c)}
                  disabled={isSubmitting}
                >
                  Checkout
                </Button>

                <Button
                  size="sm"
                  onClick={() => registerPayment(c, "PIX")}
                  disabled={isSubmitting}
                >
                  Baixar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
