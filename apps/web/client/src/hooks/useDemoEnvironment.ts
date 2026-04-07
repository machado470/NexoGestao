import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function extractEntityId(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";

  const asRecord = payload as Record<string, unknown>;
  const direct = asRecord.id;
  if (typeof direct === "string" && direct.trim()) return direct;

  const data = asRecord.data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).id;
    if (typeof nested === "string" && nested.trim()) return nested;
  }

  return "";
}

export function useDemoEnvironment() {
  const utils = trpc.useUtils();

  const createCustomer = trpc.nexo.customers.create.useMutation();
  const createAppointment = trpc.nexo.appointments.create.useMutation();
  const createServiceOrder = trpc.nexo.serviceOrders.create.useMutation();
  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation();
  const createCharge = trpc.finance.charges.create.useMutation();
  const payCharge = trpc.finance.charges.pay.useMutation();
  const sendWhatsApp = trpc.nexo.whatsapp.send.useMutation();

  const isGenerating =
    createCustomer.isPending ||
    createAppointment.isPending ||
    createServiceOrder.isPending ||
    updateServiceOrder.isPending ||
    createCharge.isPending ||
    payCharge.isPending ||
    sendWhatsApp.isPending;

  const generateDemoEnvironment = async () => {
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");

    try {
      const customerPayload = await createCustomer.mutateAsync({
        name: `Cliente Demo ${stamp}`,
        phone: "+5547999999999",
        email: `demo+${stamp}@nexogestao.app`,
        notes: "Gerado automaticamente para prova de fluxo operacional.",
      });

      const customerId = extractEntityId(customerPayload);
      if (!customerId) {
        throw new Error("Não foi possível criar cliente demo.");
      }

      const startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

      await createAppointment.mutateAsync({
        customerId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "DONE",
        notes: "Agendamento demo finalizado para puxar execução.",
      });

      const serviceOrderPayload = await createServiceOrder.mutateAsync({
        customerId,
        title: "Troca de peça e revisão preventiva (demo)",
        description: "Ordem criada pelo gerador demo para provar execução → cobrança.",
        priority: 4,
      });

      const serviceOrderId = extractEntityId(serviceOrderPayload);
      if (!serviceOrderId) {
        throw new Error("Não foi possível criar O.S. demo.");
      }

      await updateServiceOrder.mutateAsync({
        id: serviceOrderId,
        status: "DONE",
        outcome: "SUCCESS",
      });

      const amountCents = 18900;
      const dueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const chargePayload = await createCharge.mutateAsync({
        customerId,
        amountCents,
        dueDate,
        notes: "Cobrança demo vinculada à O.S. concluída.",
        serviceOrderId,
      });

      const chargeId = extractEntityId(chargePayload);
      if (!chargeId) {
        throw new Error("Não foi possível criar cobrança demo.");
      }

      await payCharge.mutateAsync({
        chargeId,
        method: "PIX",
        amountCents,
      });

      await sendWhatsApp.mutateAsync({
        customerId,
        content:
          "Mensagem demo: pagamento recebido e operação concluída. Histórico atualizado no NexoGestão.",
        entityType: "CHARGE",
        entityId: chargeId,
        messageType: "PAYMENT_REMINDER",
        chargeId,
        serviceOrderId,
      });

      await Promise.all([
        utils.dashboard.alerts.invalidate(),
        utils.nexo.customers.list.invalidate(),
        utils.nexo.appointments.list.invalidate(),
        utils.nexo.serviceOrders.list.invalidate(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
        utils.nexo.timeline.listByOrg.invalidate(),
      ]);

      toast.success("Ambiente demo gerado com sucesso.");
      return { customerId, serviceOrderId, chargeId };
    } catch (error: any) {
      const message =
        error?.message || "Falha ao gerar ambiente de demonstração.";
      toast.error(message);
      throw error;
    }
  };

  return {
    isGenerating,
    generateDemoEnvironment,
  };
}
